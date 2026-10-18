import { describe, expect, it } from 'vitest'
import { submit } from '@/lib/service'
import type { Ticket } from '@/lib/schemas'
import { STORE } from '@/lib/store'

describe('report attachments', () => {
  it('keeps photos and voice notes in private storage under the case', async () => {
    const png = Buffer.from('fake png bytes')
    let ticket: Ticket | null = null
    for await (const ev of submit('kpai', 'A child is begging at the traffic light every night in Semarang', 'web', {}, [
      { mime: 'image/png', data: png.toString('base64') },
    ], { noAi: 'test: no model calls' })) {
      if (ev.type === 'done') ticket = ev.ticket
    }
    const a = ticket!.attachments[0]
    expect(a).toMatchObject({ mime: 'image/png', bytes: png.length, path: `reports/kpai/${ticket!.id}/1.png` })
    expect((await STORE.getFile(a.path!))?.data.equals(png)).toBe(true)
  })
})
