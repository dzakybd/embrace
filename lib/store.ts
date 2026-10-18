// Ticket storage: Firestore in the cloud (EMBRACE_STORE=firestore), an in-memory map for local dev and tests.
import { BUCKET } from './files-url'
import type { Notification, Ticket } from './schemas'

export const now = () => new Date().toISOString()

export interface Store {
  put(t: Ticket): Promise<void>
  get(id: string): Promise<Ticket | null>
  update(id: string, fields: Partial<Ticket>): Promise<Ticket>
  list(agencyId: string): Promise<Ticket[]>
  clear(agencyId: string): Promise<void>
  addNotification(n: Notification): Promise<void>
  listNotifications(agencyId: string, to: string): Promise<Notification[]>
  clearNotifications(agencyId: string): Promise<void>
  /** True the first time a key is seen (deduplicates webhook updates and Pub/Sub redeliveries). */
  claim(key: string): Promise<boolean>
  /** Sliding-window rate limit shared by all instances: records a hit and returns false when `limit` is reached. */
  hit(key: string, limit: number, windowMs: number): Promise<boolean>
  getChat(chatId: string): Promise<ChatState | null>
  setChat(chatId: string, fields: Partial<ChatState>): Promise<void>
  /** Agencies created in the app (built-in packs live in agencies/). */
  listAgencies(): Promise<Record<string, unknown>[]>
  putAgency(a: { id: string }): Promise<void>
  /** Merges fields into a stored agency (e.g. the connected Telegram bot). */
  patchAgency(id: string, fields: Record<string, unknown>): Promise<void>
  deleteAgency(id: string): Promise<void>
  /** Channel credentials per agency (server only; Firestore rules deny all client access). */
  getIntegration(agencyId: string): Promise<Integrations | null>
  setIntegration(agencyId: string, fields: Partial<Integrations>): Promise<void>
  /** Private files (report photos and voice notes): Cloud Storage `reports/...`, never readable by clients. */
  putFile(path: string, mime: string, data: Buffer): Promise<void>
  getFile(path: string): Promise<{ mime: string; data: Buffer } | null>
}

/** Guardrail settings an agency can adjust in the AI control tower (defaults in lib/guardrails.ts). */
export interface GuardConfig {
  /** Gemini safety threshold for the agents that read reports, and for the reply drafter. */
  read: string
  write: string
  /** What a suspected prompt injection does: send the case to a person, or only flag it. */
  injection: 'review' | 'flag'
  /** Missing-detail questions asked after a report (0 turns multi-turn intake off). */
  questions: number
}

export interface Integrations {
  telegram?: { token: string; username: string; secret: string; connected_at: string } | null
  /** Models chosen in the AI control tower, per model setting (see lib/agents/models.ts). */
  ai?: { models: Record<string, string>; guard?: Partial<GuardConfig>; updated_by: string; updated_at: string } | null
}

/** Conversation state of one Telegram chat. */
export interface ChatState {
  agency_id: string
  open_ticket?: string | null
  open_since?: string | null
  awaiting?: 'report' | 'details' | null
  /** Missing-detail questions still to ask, and the answers so far (multi-turn intake). */
  pending?: string[]
  answers?: Record<string, string>
  warned_at?: string | null
  /** Language the bot speaks in this chat; starts from the Telegram app language. */
  lang?: 'en' | 'id'
}

const newestFirst = (a: Ticket, b: Ticket) => b.created_at.localeCompare(a.created_at)

class MemoryStore implements Store {
  private tickets = new Map<string, Ticket>()
  async put(t: Ticket) {
    this.tickets.set(t.id, structuredClone(t))
  }
  async get(id: string) {
    const t = this.tickets.get(id)
    return t ? structuredClone(t) : null
  }
  async update(id: string, fields: Partial<Ticket>) {
    const t = { ...this.tickets.get(id)!, ...fields }
    this.tickets.set(id, t)
    return structuredClone(t)
  }
  async list(agencyId: string) {
    return [...this.tickets.values()]
      .filter((t) => t.agency_id === agencyId)
      .sort(newestFirst)
      .map((t) => structuredClone(t))
  }
  async clear(agencyId: string) {
    for (const [id, t] of this.tickets) if (t.agency_id === agencyId) this.tickets.delete(id)
    for (const path of this.files.keys()) if (path.startsWith(`reports/${agencyId}/`)) this.files.delete(path)
  }
  private files = new Map<string, { mime: string; data: Buffer }>()
  async putFile(path: string, mime: string, data: Buffer) {
    this.files.set(path, { mime, data })
  }
  async getFile(path: string) {
    return this.files.get(path) ?? null
  }
  private claims = new Set<string>()
  private hits = new Map<string, number[]>()
  private chats = new Map<string, ChatState>()
  async claim(key: string) {
    if (this.claims.has(key)) return false
    this.claims.add(key)
    return true
  }
  async hit(key: string, limit: number, windowMs: number) {
    const now = Date.now()
    const ts = (this.hits.get(key) ?? []).filter((t) => t > now - windowMs)
    if (ts.length >= limit) return false
    ts.push(now)
    this.hits.set(key, ts)
    return true
  }
  async getChat(chatId: string) {
    return this.chats.get(chatId) ?? null
  }
  async setChat(chatId: string, fields: Partial<ChatState>) {
    this.chats.set(chatId, { agency_id: '', ...this.chats.get(chatId), ...fields })
  }
  private agencies = new Map<string, Record<string, unknown>>()
  async listAgencies() {
    return [...this.agencies.values()]
  }
  async putAgency(a: { id: string }) {
    this.agencies.set(a.id, a as Record<string, unknown>)
  }
  async patchAgency(id: string, fields: Record<string, unknown>) {
    const a = this.agencies.get(id)
    if (a) this.agencies.set(id, { ...a, ...fields })
  }
  async deleteAgency(id: string) {
    this.agencies.delete(id)
  }
  private integrations = new Map<string, Integrations>()
  async getIntegration(agencyId: string) {
    return this.integrations.get(agencyId) ?? null
  }
  async setIntegration(agencyId: string, fields: Partial<Integrations>) {
    this.integrations.set(agencyId, { ...this.integrations.get(agencyId), ...fields })
  }
  private notes: Notification[] = []
  async addNotification(n: Notification) {
    this.notes.push({ ...n, id: String(this.notes.length + 1) })
  }
  async clearNotifications(agencyId: string) {
    this.notes = this.notes.filter((n) => n.agency_id !== agencyId)
  }
  async listNotifications(agencyId: string, to: string) {
    return this.notes.filter((n) => n.agency_id === agencyId && n.to === to).sort((a, b) => b.at.localeCompare(a.at))
  }
}

class FirestoreStore implements Store {
  private db = (async () => {
    const { initializeApp, getApps } = await import('firebase-admin/app')
    const { getFirestore } = await import('firebase-admin/firestore')
    const app = getApps()[0] ?? initializeApp()
    const db = getFirestore(app)
    db.settings({ ignoreUndefinedProperties: true })
    return db
  })()
  private async col() {
    return (await this.db).collection('tickets')
  }
  async put(t: Ticket) {
    await (await this.col()).doc(t.id).set(t)
  }
  async get(id: string) {
    const snap = await (await this.col()).doc(id).get()
    return snap.exists ? (snap.data() as Ticket) : null
  }
  async update(id: string, fields: Partial<Ticket>) {
    const ref = (await this.col()).doc(id)
    await ref.update(fields)
    return (await ref.get()).data() as Ticket
  }
  async list(agencyId: string) {
    const snap = await (await this.col()).where('agency_id', '==', agencyId).get()
    return snap.docs.map((d) => d.data() as Ticket).sort(newestFirst)
  }
  async clear(agencyId: string) {
    const col = await this.col()
    const snap = await col.where('agency_id', '==', agencyId).get()
    const db = await this.db
    for (let i = 0; i < snap.docs.length; i += 400) {
      const batch = db.batch()
      snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref))
      await batch.commit()
    }
    await (await this.bucket).deleteFiles({ prefix: `reports/${agencyId}/` }).catch(() => undefined)
  }
  private bucket = (async () => {
    const { initializeApp, getApps } = await import('firebase-admin/app')
    const { getStorage } = await import('firebase-admin/storage')
    return getStorage(getApps()[0] ?? initializeApp()).bucket(BUCKET)
  })()
  async putFile(path: string, mime: string, data: Buffer) {
    await (await this.bucket).file(path).save(data, { contentType: mime, resumable: false })
  }
  async getFile(path: string) {
    const file = (await this.bucket).file(path)
    const [exists] = await file.exists()
    if (!exists) return null
    const [[data], [meta]] = await Promise.all([file.download(), file.getMetadata()])
    return { mime: String(meta.contentType ?? 'application/octet-stream'), data }
  }
  async addNotification(n: Notification) {
    await (await this.db).collection('notifications').add(n)
  }
  async clearNotifications(agencyId: string) {
    const db = await this.db
    const snap = await db.collection('notifications').where('agency_id', '==', agencyId).get()
    for (let i = 0; i < snap.docs.length; i += 400) {
      const batch = db.batch()
      snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref))
      await batch.commit()
    }
  }
  async claim(key: string) {
    try {
      await (await this.db).collection('dedupe').doc(key).create({ at: now() })
      return true
    } catch {
      return false // already exists
    }
  }
  async hit(key: string, limit: number, windowMs: number) {
    const db = await this.db
    const ref = db.collection('ratelimits').doc(key.replace(/\//g, '_'))
    return db.runTransaction(async (tx) => {
      const t = Date.now()
      const ts = (((await tx.get(ref)).data()?.ts as number[]) ?? []).filter((x) => x > t - windowMs)
      if (ts.length >= limit) return false
      tx.set(ref, { ts: [...ts, t] })
      return true
    })
  }
  async getChat(chatId: string) {
    const snap = await (await this.db).collection('tg_chats').doc(chatId).get()
    return snap.exists ? (snap.data() as ChatState) : null
  }
  async setChat(chatId: string, fields: Partial<ChatState>) {
    await (await this.db).collection('tg_chats').doc(chatId).set(fields, { merge: true })
  }
  async listAgencies() {
    return (await (await this.db).collection('agencies').get()).docs.map((d) => d.data())
  }
  async putAgency(a: { id: string }) {
    await (await this.db).collection('agencies').doc(a.id).set(a)
  }
  async patchAgency(id: string, fields: Record<string, unknown>) {
    await (await this.db).collection('agencies').doc(id).set(fields, { merge: true })
  }
  async deleteAgency(id: string) {
    await (await this.db).collection('agencies').doc(id).delete()
  }
  async getIntegration(agencyId: string) {
    const snap = await (await this.db).collection('integrations').doc(agencyId).get()
    return snap.exists ? (snap.data() as Integrations) : null
  }
  async setIntegration(agencyId: string, fields: Partial<Integrations>) {
    await (await this.db).collection('integrations').doc(agencyId).set(fields, { merge: true })
  }
  async listNotifications(agencyId: string, to: string) {
    const snap = await (await this.db)
      .collection('notifications')
      .where('agency_id', '==', agencyId)
      .where('to', '==', to)
      .get()
    return snap.docs
      .map((d) => ({ ...(d.data() as Notification), id: d.id }))
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 30)
  }
}

const g = globalThis as unknown as { __embraceStore?: Store }
export const STORE: Store = (g.__embraceStore ??=
  process.env.EMBRACE_STORE === 'firestore' ? new FirestoreStore() : new MemoryStore())
