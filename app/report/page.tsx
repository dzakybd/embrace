import type { Metadata } from 'next'
import Link from 'next/link'
import { Brand, Footer } from '@/components/Brand'
import Report from '@/components/citizen/Report'

export const metadata: Metadata = { title: 'Report a problem · Embrace' }

export default function ReportPage() {
  return (
    <div className="public">
      <header className="top">
        <Brand sub="Report a problem" />
        <nav className="top-links" aria-label="Main"><Link href="/staff/inbox">Staff workspace</Link></nav>
      </header>
      <main className="citizen"><Report /></main>
      <Footer />
    </div>
  )
}
