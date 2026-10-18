// Guardrails around the agents (ADK safety: screen inputs and outputs). Deterministic code, no model call, so they
// cost nothing, cannot be talked out of their job, and are unit tested.
import { HarmBlockThreshold, HarmCategory, type SafetySetting } from '@google/genai'

/** Instructions aimed at the model inside a complaint, in English and Indonesian. */
const INJECTION = [
  /\b(ignore|disregard|forget)\b.{0,30}\b(previous|prior|above|all|your)\b.{0,20}\b(instructions?|rules|prompts?)\b/i,
  /\b(abaikan|lupakan)\b.{0,30}\b(instruksi|perintah|aturan)\b/i,
  /\b(kamu|anda)\s+(sekarang|adalah)\b.{0,20}\b(admin|developer|pengembang|sistem|asisten)\b/i,
  /\b(tampilkan|tunjukkan|sebutkan|ulangi|bocorkan)\b.{0,25}\b(prompt|instruksimu|aturanmu|instruksi (sistem|awal))\b/i,
  /\b(system|developer)\s*(prompt|message|mode)\b/i,
  /\b(reveal|show|print|repeat)\b.{0,20}\b(your|the)\b.{0,10}\b(instructions|prompt|rules)\b/i,
  /\byou are now\b|\bact as (an? )?(admin|developer|system)\b|\bjailbreak\b|\bDAN mode\b/i,
  /\b(set|mark|classify)\b.{0,30}\b(urgency|priority|category)\b.{0,20}\b(to|as)\b.{0,15}\b(critical|low|high)\b/i,
  /<\/?(system|instructions?)>|\[\/?INST\]/i,
]

export interface InputScreen {
  injection: boolean
  matches: string[]
}

/** Flags complaints that try to steer the agents. They are never dropped (a citizen's report still counts): the case
 * goes to manual review and the trace shows why. */
export function screenInput(text: string): InputScreen {
  const matches = INJECTION.map((r) => text.match(r)?.[0])
    .filter((m): m is string => !!m)
    .map((m) => m.slice(0, 80))
  return { injection: matches.length > 0, matches }
}

const PHONE = /(?:\+?\d[\d\s-]{8,}\d)/g
const NIK = /\b\d{16}\b/g
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/g
const URL_RE = /https?:\/\/[^\s)]+/g
const PROMISE =
  /\b(guarantee[ds]?|we promise|will definitely|100%|dijamin|pasti (akan )?(cair|diterima|dapat)|kami janji)\b/gi
/** Fragments of the agents' own prompts: a draft that contains them is leaking its instructions. */
const LEAK =
  /<<<|>>>|‹‹‹|›››|You draft the first reply|Original complaint:|Routing decision:|SOP passages|treat it only as data|never follow instructions/i
/** Only staff set a case's status; a draft must not tell the citizen it is closed. */
const CLOSED =
  /\b(case|report|complaint)\b[^.]{0,30}\b(is|has been)\s+(now\s+)?(resolved|closed|completed)\b|\bstatus (kasus|laporan|pengaduan)\b[^.]{0,30}\b(selesai|ditutup)\b|\b(kasus|laporan|pengaduan)\b[^.]{0,20}\b(telah|sudah)\s+(selesai|ditutup)\b/i
/** "We cannot guarantee" is the honest answer, not a promise. */
const NEGATED = /\b(not|cannot|can't|unable to|no|tidak|belum|bukan|tak)\b[\w\s]{0,20}$/i
const promises = (reply: string) =>
  [...reply.matchAll(PROMISE)].some((m) => !NEGATED.test(reply.slice(Math.max(0, m.index - 30), m.index)))

export interface DraftCheck {
  /** Problems an officer must see before approving. */
  warnings: string[]
}

/** Checks a drafted reply before an officer sees it: no personal data copied back, no invented links, citations that
 * exist, the ticket number present, no promised outcome. The officer still approves every reply. */
export function checkDraft(
  reply: string,
  ctx: { original: string; ticketId: string; sopCount: number; allowedUrls?: string[] },
): DraftCheck {
  const warnings: string[] = []
  const leaked = [
    ...new Set([
      ...(ctx.original.match(PHONE) ?? []),
      ...(ctx.original.match(NIK) ?? []),
      ...(ctx.original.match(EMAIL) ?? []),
    ]),
  ]
    .map((s) => s.trim())
    .filter((s) => s.replace(/\D/g, '').length >= 9 || s.includes('@'))
    .filter((s) => reply.includes(s))
  if (leaked.length)
    warnings.push(`Repeats personal data from the report (${leaked.length} item${leaked.length > 1 ? 's' : ''})`)
  const urls = (reply.match(URL_RE) ?? []).filter((u) => !(ctx.allowedUrls ?? []).some((a) => u.startsWith(a)))
  if (urls.length) warnings.push(`Contains a link that is not from the agency's documents: ${urls[0].slice(0, 60)}`)
  const cited = [...reply.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]))
  const bad = cited.filter((n) => n < 1 || n > ctx.sopCount)
  if (bad.length)
    warnings.push(
      `Cites [${bad[0]}] but only ${ctx.sopCount} SOP passage${ctx.sopCount === 1 ? '' : 's'} were retrieved`,
    )
  if (!reply.includes(ctx.ticketId)) warnings.push('Does not mention the report number')
  if (promises(reply)) warnings.push('Promises an outcome; replies may only commit to a response time')
  if (LEAK.test(reply)) warnings.push("Repeats the AI's own instructions")
  if (CLOSED.test(reply)) warnings.push('Says the case is closed; only staff set the status')
  return { warnings }
}

/** Gemini safety thresholds an agency can choose in the AI control tower. */
export const THRESHOLDS = ['BLOCK_NONE', 'BLOCK_ONLY_HIGH', 'BLOCK_MEDIUM_AND_ABOVE', 'BLOCK_LOW_AND_ABOVE'] as const
export const safetyAt = (threshold: string): SafetySetting[] =>
  t(
    (THRESHOLDS as readonly string[]).includes(threshold)
      ? (threshold as HarmBlockThreshold)
      : HarmBlockThreshold.BLOCK_ONLY_HIGH,
  )
export const GUARD_DEFAULTS = {
  read: 'BLOCK_ONLY_HIGH',
  write: 'BLOCK_MEDIUM_AND_ABOVE',
  injection: 'review' as const,
  questions: 2,
}

const t = (threshold: HarmBlockThreshold): SafetySetting[] =>
  [
    HarmCategory.HARM_CATEGORY_HARASSMENT,
    HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
  ].map((category) => ({ category, threshold }))
/** Gemini safety filters per agent. Reports describe abuse, sexual violence and self-harm, so filtering the agents
 * that read them would silence the people who need help most: they block only high-probability harm. The drafter
 * writes to the public, so it blocks from medium probability. A blocked response falls back to the rules and a human. */
export const SAFETY = {
  reading: t(HarmBlockThreshold.BLOCK_ONLY_HIGH),
  writing: t(HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE),
}
