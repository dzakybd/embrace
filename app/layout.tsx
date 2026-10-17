import type { Metadata, Viewport } from 'next'
import './globals.css'

const description = 'The AI front door for any social services complaint: AI agents that read, route and answer every report, for any agency, country and language. Built with Google ADK and Gemini on Firebase.'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.EMBRACE_PUBLIC_URL || 'https://embrace.nalaria.ai.id'),
  title: { default: 'Embrace · The AI front door for social complaints', template: '%s · Embrace' },
  description,
  applicationName: 'Embrace',
  openGraph: { title: 'Embrace', description, type: 'website', siteName: 'Embrace' },
  twitter: { card: 'summary_large_image', title: 'Embrace', description },
}
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0b57d0' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
