'use client'

import Link from 'next/link'
import { Icon, telegramUrl } from './ui'
import { useAgencies } from './useAgencies'

/** The citizen card's buttons follow the agency picked on the main menu: its own Telegram bot and web form. */
export function CitizenActions() {
  const { agency } = useAgencies()
  const tg = telegramUrl(agency?.telegram_bot)
  return (
    <div className="role-actions">
      {tg && <a className="btn light" href={tg} target="_blank" rel="noreferrer">Chat on Telegram</a>}
      <Link className="go" href={agency ? `/report?agency=${agency.id}` : '/report'}>Use the web form <Icon name="send" size={14} /></Link>
      {agency && <Link className="go" href={`/a/${agency.id}`}>Agency page <Icon name="building" size={14} /></Link>}
    </div>
  )
}
