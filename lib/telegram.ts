// Telegram Bot API: the citizen chat channel, one bot per agency. Plain HTTPS calls; no SDK needed.
// Every call takes the bot token, so several agencies' bots run on the same server.
const API = 'https://api.telegram.org'

export async function call<T>(token: string, method: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  })
  const data = (await res.json()) as { ok: boolean; result: T; description?: string }
  if (!data.ok) throw new Error(`telegram ${method}: ${data.description}`)
  return data.result
}

export type Button = { text: string; callback_data?: string; url?: string }

export function send(token: string, chatId: string | number, text: string, buttons?: Button[][]) {
  return call(token, 'sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    ...(buttons ? { reply_markup: { inline_keyboard: buttons } } : {}),
  })
}

export function answerCallback(token: string, id: string) {
  return call(token, 'answerCallbackQuery', { callback_query_id: id }).catch(() => undefined)
}

export function typing(token: string, chatId: string | number) {
  return call(token, 'sendChatAction', { chat_id: chatId, action: 'typing' }).catch(() => undefined)
}

/** Downloads a file the citizen sent (voice note, photo) as base64, up to `maxBytes`. */
export async function download(token: string, fileId: string, maxBytes = 7 * 1024 * 1024): Promise<string | null> {
  const f = await call<{ file_path?: string; file_size?: number }>(token, 'getFile', { file_id: fileId })
  if (!f.file_path || (f.file_size ?? 0) > maxBytes) return null
  const res = await fetch(`${API}/file/bot${token}/${f.file_path}`, { signal: AbortSignal.timeout(20_000) })
  return Buffer.from(await res.arrayBuffer()).toString('base64')
}

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Minimal shapes of the Telegram updates we handle. */
export interface TgMessage {
  message_id: number
  chat: { id: number; type: string }
  from?: { id: number; first_name?: string; language_code?: string }
  date: number
  text?: string
  caption?: string
  voice?: { file_id: string; file_size?: number; mime_type?: string }
  audio?: { file_id: string; file_size?: number; mime_type?: string }
  photo?: { file_id: string; file_size?: number }[]
  sticker?: unknown
  animation?: unknown
}
export interface TgUpdate {
  update_id: number
  message?: TgMessage
  callback_query?: { id: string; data?: string; message?: TgMessage; from: { id: number; language_code?: string } }
}
