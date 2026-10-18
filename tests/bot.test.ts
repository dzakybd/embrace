import { beforeEach, describe, expect, it, vi } from 'vitest'

const sent: string[] = []
vi.mock('@/lib/telegram', () => ({
  send: vi.fn(async (_token: string, _chat: string, text: string) => {
    sent.push(text)
  }),
  answerCallback: vi.fn(async () => undefined),
  typing: vi.fn(async () => undefined),
  download: vi.fn(async () => null),
  esc: (s: string) => s,
}))

const bot = await import('@/lib/bot')
const { STORE } = await import('@/lib/store')
const { LIMITS } = bot
const BOT = { agency_id: 'dinsos_demak', token: 't', username: 'embrace_dinsos_demak_bot', secret: 's', managed: true }
const handleUpdate = (u: Parameters<typeof bot.handleUpdate>[1]) => bot.handleUpdate(BOT, u)
const key = (c: number) => `dinsos_demak:${c}`

let nextId = 1000
let chat = 1
const msg = (text: string, c = chat) => ({
  update_id: nextId++,
  message: { message_id: 1, chat: { id: c, type: 'private' }, date: 0, text },
})
const REPORT = 'My food voucher did not arrive this month and my neighbours already got theirs.'

describe('telegram bot gatekeeping (no AI)', () => {
  beforeEach(() => {
    sent.length = 0
    chat += 1
  })

  it('answers greetings and short messages without queuing AI work', async () => {
    expect(await handleUpdate(msg('halo'))).toBeNull()
    expect(await handleUpdate(msg('help pls'))).toBeNull()
    expect(sent.join()).toContain('tell us what happened')
  })

  it('queues a real report as a job for the AI pipeline', async () => {
    const job = await handleUpdate(msg(REPORT))
    expect(job).toMatchObject({ chat_id: String(chat), agency_id: 'dinsos_demak', text: REPORT })
    expect(job?.no_ai).toBeUndefined()
  })

  it('keeps chats with two agencies apart', async () => {
    await STORE.setChat(key(chat), {
      agency_id: 'dinsos_demak',
      open_ticket: 'DMK-TEST',
      open_since: new Date().toISOString(),
      awaiting: null,
    })
    const kpai = { ...BOT, agency_id: 'kpai', username: 'embrace_kpai_bot' }
    const job = await bot.handleUpdate(kpai, msg(REPORT))
    expect(job).toMatchObject({ agency_id: 'kpai' })
  })

  it('ignores a duplicate update', async () => {
    const u = msg(REPORT)
    expect(await handleUpdate(u)).not.toBeNull()
    expect(await handleUpdate(u)).toBeNull()
  })

  it('limits new AI reports per chat per hour', async () => {
    const jobs = []
    for (let i = 0; i < LIMITS.reportsHour.limit + 1; i++) {
      await STORE.setChat(key(chat), { open_ticket: null, awaiting: 'report' })
      jobs.push(await handleUpdate(msg(`${REPORT} (${i})`)))
    }
    expect(jobs.filter(Boolean)).toHaveLength(LIMITS.reportsHour.limit)
    expect(sent.at(-1)).toContain('several reports')
  })

  it('drops floods after the per-minute limit and warns once', async () => {
    for (let i = 0; i < LIMITS.flood.limit + 3; i++) await handleUpdate(msg('hi'))
    expect(sent.filter((s) => s.includes('very fast'))).toHaveLength(1)
  })

  it('sends the emergency number before any AI when danger words appear', async () => {
    await handleUpdate(msg('my neighbour says she will kill myself tonight, please come'))
    expect(sent[0]).toContain('in danger right now')
  })

  it('speaks Indonesian when the Telegram app is in Indonesian, and switches with /language', async () => {
    const id = (text: string) => ({
      update_id: nextId++,
      message: {
        message_id: 1,
        chat: { id: chat, type: 'private' },
        from: { id: chat, language_code: 'id' },
        date: 0,
        text,
      },
    })
    await handleUpdate(id('halo'))
    expect(sent.at(-1)).toContain('ceritakan apa yang terjadi')
    await handleUpdate(id('/language'))
    expect((await STORE.getChat(key(chat)))?.lang).toBe('en')
    expect(sent.at(-1)).toContain('Tell us what happened')
    await handleUpdate(id('halo'))
    expect(sent.at(-1)).toContain('tell us what happened')
  })

  it('asks the missing details one by one, then hands the answers to the agents', async () => {
    await STORE.setChat(key(chat), {
      agency_id: 'dinsos_demak',
      open_ticket: 'DMK-TEST',
      open_since: new Date().toISOString(),
      awaiting: 'details',
      pending: ['location', 'incident_time'],
      answers: {},
    })
    expect(await handleUpdate(msg('Desa Bedono, Sayung'))).toBeNull()
    expect(sent.at(-1)).toContain('When did this happen')
    const job = await handleUpdate(msg('since this morning, still flooding'))
    expect(job).toMatchObject({
      details: {
        ticket_id: 'DMK-TEST',
        answers: { location: 'Desa Bedono, Sayung', incident_time: 'since this morning, still flooding' },
      },
    })
    expect((await STORE.getChat(key(chat)))?.awaiting).toBeNull()
  })

  it('lets the citizen skip the remaining questions', async () => {
    await STORE.setChat(key(chat), {
      agency_id: 'dinsos_demak',
      open_ticket: 'DMK-TEST',
      open_since: new Date().toISOString(),
      awaiting: 'details',
      pending: ['incident_time'],
      answers: { location: 'Sayung' },
    })
    const job = await handleUpdate({
      update_id: nextId++,
      callback_query: {
        id: 'q',
        data: 'skip',
        from: { id: chat },
        message: { message_id: 1, chat: { id: chat, type: 'private' }, date: 0 },
      },
    })
    expect(job).toMatchObject({ details: { answers: { location: 'Sayung' } } })
  })

  it('adds messages after a report to the open case instead of running AI again', async () => {
    await STORE.setChat(key(chat), {
      agency_id: 'dinsos_demak',
      open_ticket: 'DMK-TEST',
      open_since: new Date().toISOString(),
      awaiting: null,
    })
    expect(await handleUpdate(msg('Also, my card number ends in 1234 and the shop is on Maple Street.'))).toBeNull()
    expect(sent.at(-1)).toContain('Added to your report')
  })
})
