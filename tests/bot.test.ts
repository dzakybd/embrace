import { beforeEach, describe, expect, it, vi } from 'vitest'

const sent: string[] = []
vi.mock('@/lib/telegram', () => ({
  send: vi.fn(async (_chat: string, text: string) => { sent.push(text) }),
  answerCallback: vi.fn(async () => undefined),
  typing: vi.fn(async () => undefined),
  download: vi.fn(async () => null),
  esc: (s: string) => s,
}))

const { handleUpdate, LIMITS } = await import('@/lib/bot')
const { STORE } = await import('@/lib/store')

let nextId = 1000
let chat = 1
const msg = (text: string, c = chat) => ({ update_id: nextId++, message: { message_id: 1, chat: { id: c, type: 'private' }, date: 0, text } })
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

  it('ignores a duplicate update', async () => {
    const u = msg(REPORT)
    expect(await handleUpdate(u)).not.toBeNull()
    expect(await handleUpdate(u)).toBeNull()
  })

  it('limits new AI reports per chat per hour', async () => {
    const jobs = []
    for (let i = 0; i < LIMITS.reportsHour.limit + 1; i++) {
      await STORE.setChat(String(chat), { open_ticket: null, awaiting: 'report' })
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

  it('adds messages after a report to the open case instead of running AI again', async () => {
    await STORE.setChat(String(chat), { agency_id: 'dinsos_demak', open_ticket: 'SS-TEST', open_since: new Date().toISOString(), awaiting: null })
    expect(await handleUpdate(msg('Also, my card number ends in 1234 and the shop is on Maple Street.'))).toBeNull()
    expect(sent.at(-1)).toContain('Added to your report')
  })
})
