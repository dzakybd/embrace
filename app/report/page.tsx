import type { Metadata } from 'next'
import Link from 'next/link'
import { Brand, Footer } from '@/components/Brand'
import { LangSwitch } from '@/components/Lang'
import { getT } from '@/lib/i18n-server'
import Report from '@/components/citizen/Report'

export const metadata: Metadata = { title: 'Report a problem' }

export default async function ReportPage() {
  const t = await getT()
  return (
    <div className="public">
      <header className="top">
        <Brand sub="Report a problem" />
        <nav className="top-links" aria-label="Main">
          <Link href="/">{t('All agencies')}</Link>
          <LangSwitch />
        </nav>
      </header>
      <main className="citizen">
        <Report />
      </main>
      <Footer />
    </div>
  )
}
