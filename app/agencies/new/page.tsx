import type { Metadata } from 'next'
import Link from 'next/link'
import { Brand, Footer } from '@/components/Brand'
import { LangSwitch } from '@/components/Lang'
import { getT } from '@/lib/i18n-server'
import AgencyForm from '@/components/AgencyForm'

export const metadata: Metadata = { title: 'Create an agency' }

export default async function NewAgencyPage() {
  const t = await getT()
  return (
    <div className="public">
      <header className="top">
        <Brand sub="Create an agency" />
        <nav className="top-links" aria-label="Main"><Link href="/">{t('All agencies')}</Link><LangSwitch /></nav>
      </header>
      <main><AgencyForm /></main>
      <Footer />
    </div>
  )
}
