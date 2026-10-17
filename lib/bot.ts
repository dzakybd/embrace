// Telegram desk. The webhook answers commands, filters noise and enforces limits with plain code (no AI);
// only a real report reaches the AI pipeline, as a Pub/Sub job so the webhook can return at once.
import { AGENCIES, DEFAULT_AGENCY, getAgency, liveAgencies, loadAgencies } from './agencies'
import { publishTo, pubsubOn } from './events'
import { addFollowup, submit } from './service'
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

const publicUrl = () => process.env.EMBRACE_PUBLIC_URL || 'https://embrace.nalaria.ai.id'

export interface ReportJob {
  update_id: number
  chat_id: string
  agency_id: string
  text: string
  media: { file_id: string; mime: string }[]
  no_ai?: string
}

/** Sends without failing the request: a blocked bot or a bad chat id must never break case handling. */
async function say(chatId: string | number, text: string, buttons?: Button[][]) {
  try {
    await send(chatId, text, buttons)
  } catch (err) {
    console.error('telegram send failed', String(err))
  }
}

/** A live agency (templates and deleted agencies fall back to the default office). */
const live = (id: string) => { const a = getAgency(id); return a && !a.template ? a : AGENCIES[DEFAULT_AGENCY] }
const agencyButtons = (): Button[][] => liveAgencies().map((a) => [{ text: a.short_name, callback_data: `agency:${a.id}` }])
const menu = (): Button[][] => [
  [{ text: 'New report', callback_data: 'new' }, { text: 'Track my report', callback_data: 'track' }],
  [{ text: 'Emergency numbers', callback_data: 'emergency' }, { text: 'Change office', callback_data: 'office' }],
]

async function chatState(chatId: string): Promise<ChatState> {
  return (await STORE.getChat(chatId)) ?? { agency_id: DEFAULT_AGENCY }
}

async function welcome(chatId: string) {
  await say(chatId,
    '<b>Embrace</b> helps you reach social services: social aid, disability and elderly care, homelessness, disaster relief, violence and child protection.\n\n' +
      'Write what happened in your own words and language, or send a voice note or photo. A real caseworker reviews every reply.\n\nFirst, which office should receive your report?',
    agencyButtons())
}

async function emergency(chatId: string, agencyId: string) {
  const a = live(agencyId)
  await say(chatId, `If anyone is in danger right now, call ${esc(a.emergency_line)}. Then tell us what happened here; urgent reports alert a supervisor at once.`)
}

async function track(chatId: string, state: ChatState, id?: string) {
  const ticketId = id || state.open_ticket
  const t = ticketId ? await STORE.get(ticketId) : null
  if (!t || t.telegram_chat_id !== chatId) {
    await say(chatId, 'No open report found for this chat. Send /new to make one.')
    return
  }
  const a = live(t.agency_id)
  const status = t.resolved_at ? 'resolved' : t.responded_at ? 'replied, still open' : t.status === 'escalated' ? 'urgent, a supervisor has been alerted' : 'with the team'
  await say(chatId, `Report <b>${t.id}</b>: ${status}.\nTeam: ${esc(t.policy ? a.queues[t.policy.queue] ?? '' : '')}`, [[{ text: 'Open status page', url: `${publicUrl()}/track/${t.id}` }]])
}

/** Handles one webhook update without any model call. Returns a job when the AI pipeline should run. */
export async function handleUpdate(u: TgUpdate): Promise<ReportJob | null> {
  await loadAgencies()
  if (!(await STORE.claim(`tg-${u.update_id}`))) return null // Telegram retried an update we already handled

  if (u.callback_query) {
    const cq = u.callback_query
    await answerCallback(cq.id)
    const chatId = String(cq.message?.chat.id ?? cq.from.id)
    const state = await chatState(chatId)
    const data = cq.data ?? ''
    if (data.startsWith('agency:') && live(data.slice(7)).id === data.slice(7)) {
      const a = live(data.slice(7))
      await STORE.setChat(chatId, { agency_id: a.id, awaiting: 'report', open_ticket: null })
      await say(chatId, `Your report goes to <b>${esc(a.name)}</b>.\nTell us what happened, where and when. You can also send a voice note or a photo.`)
    } else if (data === 'new') {
      await STORE.setChat(chatId, { awaiting: 'report', open_ticket: null })
      await say(chatId, 'Tell us what happened, where and when. A voice note or photo is fine too.')
    } else if (data === 'track') await track(chatId, state)
    else if (data === 'emergency') await emergency(chatId, state.agency_id)
    else if (data === 'office') await say(chatId, 'Which office should receive your report?', agencyButtons())
    return null
  }

  const m = u.message
  if (!m || m.chat.type !== 'private') return null
  const chatId = String(m.chat.id)

  // Flood control: drop bursts, warn once per ten minutes.
  if (!(await STORE.hit(`tg-flood-${chatId}`, LIMITS.flood.limit, LIMITS.flood.window))) {
    const st = await chatState(chatId)
    if (!st.warned_at || Date.now() - Date.parse(st.warned_at) > 10 * MIN) {
      await STORE.setChat(chatId, { warned_at: now() })
      await say(chatId, 'You are sending messages very fast. Please wait a minute; nothing you sent before is lost.')
    }
    return null
  }

  const text = (m.text ?? m.caption ?? '').trim()
  const cmd = text.startsWith('/') ? text.split(/\s+/)[0].split('@')[0].toLowerCase() : ''
  const state = await chatState(chatId)
  if (cmd === '/start' || cmd === '/office') return welcome(chatId).then(() => null)
  if (cmd === '/new') {
    await STORE.setChat(chatId, { awaiting: 'report', open_ticket: null })
    await say(chatId, 'Tell us what happened, where and when. A voice note or photo is fine too.')
    return null
  }
  if (cmd === '/track') return track(chatId, state, text.split(/\s+/)[1]).then(() => null)
  if (cmd === '/emergency') return emergency(chatId, state.agency_id).then(() => null)
  if (cmd) {
    await say(chatId, 'Commands: /new report, /track your report, /emergency numbers, /office to change office.', menu())
    return null
  }

  const media = mediaOf(m)
  if (!text && !media.length) {
    await say(chatId, 'Please describe the problem in words, a voice note or a photo.')
    return null
  }
  const agency = live(state.agency_id)
  const lowered = text.toLowerCase()
  if ([...DANGER, ...agency.escalation.keywords].some((k) => lowered.includes(k))) await emergency(chatId, agency.id)

  // A message after a report joins that case for 24 hours, unless the citizen started a new report.
  if (state.open_ticket && state.awaiting !== 'report' && state.open_since && Date.now() - Date.parse(state.open_since) < FOLLOWUP_WINDOW_MS) {
    await addFollowup(state.open_ticket, text || (media.length ? `[${media.map((x) => x.mime.split('/')[0]).join(', ')} sent on Telegram]` : ''))
    await say(chatId, `Added to your report <b>${state.open_ticket}</b>; the person in charge has been notified.`, menu())
    return null
  }
  if (!media.length && (text.length < 12 || GREETING.test(text))) {
    await say(chatId, `Hello! To make a report to <b>${esc(agency.short_name)}</b>, tell us what happened, where and when, in a sentence or two. You can also send a voice note.`, menu())
    return null
  }

  if (!(await STORE.hit(`tg-rh-${chatId}`, LIMITS.reportsHour.limit, LIMITS.reportsHour.window)) ||
      !(await STORE.hit(`tg-rd-${chatId}`, LIMITS.reportsDay.limit, LIMITS.reportsDay.window))) {
    await say(chatId, 'You have sent several reports recently. Please add details to your last report, or try again later. If anyone is in danger, call the emergency number now.', menu())
    return null
  }
  const aiOk = await STORE.hit('ai-daily', LIMITS.aiDay.limit, LIMITS.aiDay.window)
  await STORE.setChat(chatId, { agency_id: agency.id, awaiting: null })
  await say(chatId, 'Thank you. We received your report and are reading it now…')
  await typing(chatId)
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
  if (!(await STORE.claim(`job-${job.update_id}`))) return // Pub/Sub redelivery
  const media: { mime: string; data: string }[] = []
  for (const f of job.media) {
    const data = await download(f.file_id).catch(() => null)
    if (data) media.push({ mime: f.mime, data })
  }
  let ticket = null
  for await (const ev of submit(job.agency_id, job.text, 'telegram', {}, media, { telegramChatId: job.chat_id, noAi: job.no_ai })) {
    if (ev.type === 'done') ticket = ev.ticket
  }
  if (!ticket?.policy) return
  const a = live(job.agency_id)
  await STORE.setChat(job.chat_id, { open_ticket: ticket.id, open_since: now(), awaiting: null })
  const urgent = ticket.policy.route === 'escalated'
  await say(job.chat_id,
    `Your report number is <b>${ticket.id}</b>.\n` +
      (urgent ? `<b>Marked urgent: a supervisor has been alerted now.</b> If anyone is in danger right now, call ${esc(a.emergency_line)}.\n` : '') +
      `It is with the <b>${esc(a.queues[ticket.policy.queue] ?? ticket.policy.queue)}</b>. You will hear back within ${ticket.policy.sla_hours} hours; a caseworker reviews every reply before it is sent.\n\n` +
      'Anything you send here in the next 24 hours is added to this report.',
    [[{ text: 'Track this report', url: `${publicUrl()}/track/${ticket.id}` }], [{ text: 'New report', callback_data: 'new' }]])
}
