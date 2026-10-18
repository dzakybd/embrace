import type { Metadata, Viewport } from 'next'
import { LangProvider } from '@/components/Lang'
import { getLang } from '@/lib/i18n-server'
import './globals.css'

const description = 'AI agents that read, route and answer complaints for any social services desk: social aid, disability and elderly care, homelessness, disaster relief, violence and child protection. Built with Google ADK and Gemini on Firebase.'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.EMBRACE_PUBLIC_URL || 'https://embrace.nalaria.ai.id'),
  title: { default: 'Embrace · The AI front door for social complaints', template: '%s · Embrace' },
  description,
  applicationName: 'Embrace',
  openGraph: { title: 'Embrace', description, type: 'website', siteName: 'Embrace' },
  twitter: { card: 'summary_large_image', title: 'Embrace', description },
}
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0b57d0' }

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang()
  return (
    <html lang={lang}>
      <body><LangProvider lang={lang}>{children}</LangProvider></body>
    </html>
  )
}
