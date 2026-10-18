// Telegram desk, one bot per agency. The webhook answers commands, filters noise and enforces limits with plain
// code (no AI); only a real report reaches the AI pipeline, as a Pub/Sub job so the webhook can return at once.
import { getAgency, loadAgencies } from './agencies'
import { publicUrl, telegramBot, type TelegramBot } from './channels'
import { localize, translator, type Lang } from './i18n'
import { publishTo, pubsubOn } from './events'
import { QUESTION, type Slot } from './details'
import { addDetails, addFollowup, submit } from './service'
import { STORE, now, type ChatState } from './store'
import { answerCallback, download, esc, send, typing, type Button, type TgMessage, type TgUpdate } from './telegram'

export const JOB_TOPIC = 'telegram-reports'
const FOLLOWUP_WINDOW_MS = 24 * 3600_000
const MIN = 60_000
const HOUR = 3600_000
export const LIMITS = {
  flood: { limit: 15, window: MIN }, // messages per chat per minute
  reportsHour: { limit: 3, window: HOUR }, // AI-processed reports per chat
  reportsDay: { limit: 10, window: 24 * HOUR },
  aiDay: { limit: 300, window: 24 * HOUR }, // all chats; past this, cases are routed by rules only
}
// Danger words in a few languages, checked in code before any AI so the emergency number goes out immediately.
const DANGER = ['suicide', 'kill myself', 'bunuh diri', 'help me now', 'tolong sekarang', 'he will kill', 'trapped', 'bleeding', 'berdarah', 'diperkosa', 'raped']
const GREETING = /^(hi|hello|hey|halo|hallo|hai|pagi|siang|sore|malam|assalamu.?alaikum|test|tes|p|ping|\/?menu)\W*$/i

export interface ReportJob {
  update_id: number
  chat_id: string
  agency_id: string
  text: string
  media: { file_id: string; mime: string }[]
  no_ai?: string
  /** Answers to the missing-detail questions, to join the case and re-run the agents. */
  details?: { ticket_id: string; answers: Record<string, string> }
}

/** One conversation with an agency's bot: the same person chatting with two agencies has two separate states. */
class Chat {
  readonly key: string
  lang: Lang = 'en'
  constructor(readonly bot: TelegramBot, readonly id: string) {
    this.key = `${bot.agency_id}:${id}`
  }
  /** The agency with its name in the chat's language. */
  get agency() {
    return localize(getAgency(this.bot.agency_id)!, this.lang)
  }
  t(s: string, vars?: Record<string, string | number>) {
    return translator(this.lang)(s, vars)
  }
  /** Loads the chat state and its language: the one picked in the chat, else the Telegram app language. */
  async open(appLang?: string): Promise<ChatState> {
    const st = await this.state()
    this.lang = st.lang ?? (appLang?.toLowerCase().startsWith('id') ? 'id' : 'en')
    return st
  }
  /** Sends without failing the request: a blocked bot or a bad chat id must never break case handling. */
  async say(text: string, buttons?: Button[][]) {
    try {
      await send(this.bot.token, this.id, text, buttons)
    } catch (err) {
      console.error('telegram send failed', String(err))
    }
  }
  async state(): Promise<ChatState> {
    return (await STORE.getChat(this.key)) ?? { agency_id: this.bot.agency_id }
  }
  set(fields: Partial<ChatState>) {
    return STORE.setChat(this.key, { agency_id: this.bot.agency_id, ...fields })
  }
}

const menu = (c: Chat): Button[][] => [
  [{ text: c.t('New report'), callback_data: 'new' }, { text: c.t('Track my report'), callback_data: 'track' }],
  [{ text: c.t('Emergency numbers'), callback_data: 'emergency' }],
  [c.lang === 'id' ? { text: 'English', callback_data: 'lang:en' } : { text: 'Bahasa Indonesia', callback_data: 'lang:id' }],
]

async function welcome(c: Chat) {
  await c.say(
    `<b>${esc(c.agency.name)}</b>\n\n` +
      c.t('Tell us what happened, where and when, in your own words. You can also send a voice note or a photo. Urgent reports reach the duty supervisor at once, and a real caseworker reviews every reply.') + '\n\n' +
      c.t('If anyone is in danger right now, call {line}.', { line: esc(c.agency.emergency_line) }) + '\n\n' +
      c.t('Only {agency} staff see your report. By sending it, you agree to how it is handled.', { agency: esc(c.agency.short_name) }) +
      ` <a href="${publicUrl()}/privacy">${c.t('How your report is handled')}</a>`,
    menu(c))
}

async function emergency(c: Chat) {
  await c.say(c.t('If anyone is in danger right now, call {line}. Then tell us what happened here; urgent reports alert a supervisor at once.', { line: esc(c.agency.emergency_line) }))
}

/** Asks one missing detail, with a way to skip the rest. */
async function askDetail(c: Chat, slot: string, first: boolean) {
  const lead = first ? c.t('To help the team act faster:') + ' ' : ''
  await c.say(lead + c.t(QUESTION[slot as Slot] ?? slot), [[{ text: c.t('Skip'), callback_data: 'skip' }]])
}

/** Ends the questions; the answers given so far go to the agents as a job. */
async function finishDetails(c: Chat, state: ChatState, updateId: number, answers: Record<string, string>): Promise<ReportJob | null> {
  await c.set({ awaiting: null, pending: [], answers: {} })
  if (!state.open_ticket || !Object.keys(answers).length) {
    await c.say(c.t('No problem. Anything you send here in the next 24 hours is added to your report.'))
    return null
  }
  await c.say(c.t('Thank you. Your answers were added to report <b>{id}</b> and the team is updating the case.', { id: state.open_ticket }))
  return { update_id: updateId, chat_id: c.id, agency_id: c.bot.agency_id, text: '', media: [], details: { ticket_id: state.open_ticket, answers } }
}

/** Switches the chat's language and greets again in it. */
async function setLang(c: Chat, lang: Lang) {
  c.lang = lang
  await c.set({ lang })
  await welcome(c)
}

async function track(c: Chat, state: ChatState, id?: string) {
  const ticketId = id || state.open_ticket
  const t = ticketId ? await STORE.get(ticketId) : null
  if (!t || t.telegram_chat_id !== c.id || t.agency_id !== c.bot.agency_id) {
    await c.say(c.t('No open report found for this chat. Send /new to make one.'))
    return
  }
  const a = c.agency
  const status = c.t(t.resolved_at ? 'resolved' : t.responded_at ? 'replied, still open' : t.status === 'escalated' ? 'urgent, a supervisor has been alerted' : 'with the team')
  await c.say(`${c.t('Report')} <b>${t.id}</b>: ${status}.\n${c.t('Team')}: ${esc(t.policy ? a.queues[t.policy.queue] ?? '' : '')}`, [[{ text: c.t('Open status page'), url: `${publicUrl()}/track/${t.id}` }]])
}

/** Handles one webhook update for an agency's bot without any model call. Returns a job when the AI should run. */
export async function handleUpdate(bot: TelegramBot, u: TgUpdate): Promise<ReportJob | null> {
  await loadAgencies()
  if (!getAgency(bot.agency_id)) return null
  // Telegram retried an update we already handled (update ids are per bot)
  if (!(await STORE.claim(`tg-${bot.agency_id}-${u.update_id}`))) return null

  if (u.callback_query) {
    const cq = u.callback_query
    await answerCallback(bot.token, cq.id)
    const c = new Chat(bot, String(cq.message?.chat.id ?? cq.from.id))
    const state = await c.open(cq.from.language_code)
    const data = cq.data ?? ''
    if (data === 'new') {
      await c.set({ awaiting: 'report', open_ticket: null })
      await c.say(c.t('Tell us what happened, where and when. A voice note or photo is fine too.'))
    } else if (data === 'lang:en' || data === 'lang:id') await setLang(c, data === 'lang:id' ? 'id' : 'en')
    else if (data === 'track') await track(c, state)
    else if (data === 'emergency') await emergency(c)
    else if (data === 'skip' && state.awaiting === 'details') return finishDetails(c, state, u.update_id, state.answers ?? {})
    return null
  }

  const m = u.message
  if (!m || m.chat.type !== 'private') return null
  const c = new Chat(bot, String(m.chat.id))
  const chatId = c.id
  await c.open(m.from?.language_code)

  // Flood control: drop bursts, warn once per ten minutes.
  if (!(await STORE.hit(`tg-flood-${chatId}`, LIMITS.flood.limit, LIMITS.flood.window))) {
    const st = await c.state()
    if (!st.warned_at || Date.now() - Date.parse(st.warned_at) > 10 * MIN) {
      await c.set({ warned_at: now() })
      await c.say(c.t('You are sending messages very fast. Please wait a minute; nothing you sent before is lost.'))
    }
    return null
  }

  const text = (m.text ?? m.caption ?? '').trim()
  const cmd = text.startsWith('/') ? text.split(/\s+/)[0].split('@')[0].toLowerCase() : ''
  const state = await c.state()
  if (cmd === '/start') return welcome(c).then(() => null)
  if (cmd === '/new') {
    await c.set({ awaiting: 'report', open_ticket: null })
    await c.say(c.t('Tell us what happened, where and when. A voice note or photo is fine too.'))
    return null
  }
  if (cmd === '/language' || cmd === '/bahasa') return setLang(c, c.lang === 'id' ? 'en' : 'id').then(() => null)
  if (cmd === '/track') return track(c, state, text.split(/\s+/)[1]).then(() => null)
  if (cmd === '/emergency') return emergency(c).then(() => null)
  if (cmd) {
    await c.say(c.t('Commands: /new report, /track your report, /emergency numbers, /language to switch language.'), menu(c))
    return null
  }

  const media = mediaOf(m)
  if (!text && !media.length) {
    await c.say(c.t('Please describe the problem in words, a voice note or a photo.'))
    return null
  }
  const agency = c.agency
  const lowered = text.toLowerCase()
  if ([...DANGER, ...agency.escalation.keywords].some((k) => lowered.includes(k))) await emergency(c)

  // Multi-turn intake: the answer to the pending question; the last answer re-runs the agents on the fuller report.
  if (state.awaiting === 'details' && state.open_ticket && state.pending?.length && text) {
    const [slot, ...rest] = state.pending
    const answers = { ...state.answers, [slot]: text.slice(0, 300) }
    if (rest.length) {
      await c.set({ pending: rest, answers })
      await askDetail(c, rest[0], false)
      return null
    }
    return finishDetails(c, state, u.update_id, answers)
  }

  // A message after a report joins that case for 24 hours, unless the citizen started a new report.
  if (state.open_ticket && state.awaiting !== 'report' && state.open_since && Date.now() - Date.parse(state.open_since) < FOLLOWUP_WINDOW_MS) {
    await addFollowup(state.open_ticket, text || (media.length ? `[${media.map((x) => x.mime.split('/')[0]).join(', ')} sent on Telegram]` : ''))
    await c.say(c.t('Added to your report <b>{id}</b>; the person in charge has been notified.', { id: state.open_ticket }), menu(c))
    return null
  }
  if (!media.length && (text.length < 12 || GREETING.test(text))) {
    await c.say(c.t('Hello! To make a report to <b>{agency}</b>, tell us what happened, where and when, in a sentence or two. You can also send a voice note.', { agency: esc(agency.short_name) }), menu(c))
    return null
  }

  if (!(await STORE.hit(`tg-rh-${chatId}`, LIMITS.reportsHour.limit, LIMITS.reportsHour.window)) ||
      !(await STORE.hit(`tg-rd-${chatId}`, LIMITS.reportsDay.limit, LIMITS.reportsDay.window))) {
    await c.say(c.t('You have sent several reports recently. Please add details to your last report, or try again later. If anyone is in danger, call the emergency number now.'), menu(c))
    return null
  }
  const aiOk = await STORE.hit('ai-daily', LIMITS.aiDay.limit, LIMITS.aiDay.window)
  await c.set({ awaiting: null })
  await c.say(c.t('Thank you. We received your report and are reading it now…'))
  await typing(bot.token, chatId)
  return { update_id: u.update_id, chat_id: chatId, agency_id: agency.id, text, media, ...(aiOk ? {} : { no_ai: 'Daily AI budget reached; routed by rules' }) }
}

function mediaOf(m: TgMessage): { file_id: string; mime: string }[] {
  const out: { file_id: string; mime: string }[] = []
  if (m.voice) out.push({ file_id: m.voice.file_id, mime: (m.voice.mime_type ?? 'audio/ogg').split(';')[0] })
  if (m.audio) out.push({ file_id: m.audio.file_id, mime: (m.audio.mime_type ?? 'audio/mpeg').split(';')[0] })
  if (m.photo?.length) out.push({ file_id: m.photo[m.photo.length - 1].file_id, mime: 'image/jpeg' })
  return out
}

/** Hands the job to Pub/Sub in the cloud; runs it inline locally. */
export async function dispatch(job: ReportJob) {
  if (pubsubOn()) await publishTo(JOB_TOPIC, job)
  else await processReport(job)
}

/** Runs the AI pipeline for a Telegram report and tells the citizen where it went. */
export async function processReport(job: ReportJob) {
  await loadAgencies()
  if (!(await STORE.claim(`job-${job.agency_id}-${job.update_id}`))) return // Pub/Sub redelivery
  const bot = await telegramBot(job.agency_id)
  if (!bot) return
  const c = new Chat(bot, job.chat_id)
  await c.open()
  if (job.details) {
    const before = await STORE.get(job.details.ticket_id)
    if (!before || before.telegram_chat_id !== job.chat_id) return
    const t = await addDetails(job.details.ticket_id, job.details.answers)
    if (t?.policy?.route === 'escalated' && before.policy?.route !== 'escalated') {
      await c.say(`<b>${c.t('Marked urgent: a supervisor has been alerted now.')}</b> ${c.t('If anyone is in danger right now, call {line}.', { line: esc(c.agency.emergency_line) })}`)
    }
    return
  }
  const media: { mime: string; data: string }[] = []
  for (const f of job.media) {
    const data = await download(bot.token, f.file_id).catch(() => null)
    if (data) media.push({ mime: f.mime, data })
  }
  let ticket = null
  for await (const ev of submit(job.agency_id, job.text, 'telegram', {}, media, { telegramChatId: job.chat_id, noAi: job.no_ai })) {
    if (ev.type === 'done') ticket = ev.ticket
  }
  if (!ticket?.policy) return
  const a = c.agency
  await c.set({ open_ticket: ticket.id, open_since: now(), awaiting: null })
  const urgent = ticket.policy.route === 'escalated'
  await c.say(
    c.t('Your report number is <b>{id}</b>.', { id: ticket.id }) + '\n' +
      (urgent ? `<b>${c.t('Marked urgent: a supervisor has been alerted now.')}</b> ${c.t('If anyone is in danger right now, call {line}.', { line: esc(a.emergency_line) })}\n` : '') +
      c.t('It is with the <b>{team}</b>. You will hear back within {h} hours; a caseworker reviews every reply before it is sent.', { team: esc(a.queues[ticket.policy.queue] ?? ticket.policy.queue), h: ticket.policy.sla_hours }) + '\n\n' +
      c.t('Anything you send here in the next 24 hours is added to this report.'),
    [[{ text: c.t('Track this report'), url: `${publicUrl()}/track/${ticket.id}` }], [{ text: c.t('New report'), callback_data: 'new' }]])
  const missing = ticket.details?.missing ?? []
  if (missing.length) {
    await c.set({ awaiting: 'details', pending: missing, answers: {} })
    await askDetail(c, missing[0], true)
  }
}
