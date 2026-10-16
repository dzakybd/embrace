import type { Metadata, Viewport } from 'next'
import './globals.css'

const description = 'AI agents that read, route and answer reports to social services desks, in any language. Built with Google ADK and Gemini on Firebase.'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.EMBRACE_PUBLIC_URL || 'https://embrace.nalaria.ai.id'),
  title: { default: 'Embrace · AI agents for social services desks', template: '%s · Embrace' },
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
