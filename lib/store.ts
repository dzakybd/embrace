// Ticket storage: Firestore in the cloud (EMBRACE_STORE=firestore), an in-memory map for local dev and tests.
import type { Ticket } from './schemas'

export const now = () => new Date().toISOString()

export interface Store {
  put(t: Ticket): Promise<void>
  get(id: string): Promise<Ticket | null>
  update(id: string, fields: Partial<Ticket>): Promise<Ticket>
  list(agencyId: string): Promise<Ticket[]>
  clear(agencyId: string): Promise<void>
  addAlert(alert: { ticket_id: string; agency_id: string; contact: string; urgency: string; summary: string; at: string }): Promise<void>
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
    return [...this.tickets.values()].filter((t) => t.agency_id === agencyId).sort(newestFirst).map((t) => structuredClone(t))
  }
  async clear(agencyId: string) {
    for (const [id, t] of this.tickets) if (t.agency_id === agencyId) this.tickets.delete(id)
  }
  async addAlert() {}
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
  }
  async addAlert(alert: Parameters<Store['addAlert']>[0]) {
    await (await this.db).collection('alerts').add(alert)
  }
}

const g = globalThis as unknown as { __embraceStore?: Store }
export const STORE: Store = (g.__embraceStore ??= process.env.EMBRACE_STORE === 'firestore' ? new FirestoreStore() : new MemoryStore())
