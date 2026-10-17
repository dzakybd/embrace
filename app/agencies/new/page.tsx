import type { Metadata } from 'next'
import Link from 'next/link'
import { Brand, Footer } from '@/components/Brand'
import NewAgencyForm from '@/components/NewAgencyForm'

export const metadata: Metadata = { title: 'Create an agency' }

export default function NewAgencyPage() {
  return (
    <div className="public">
      <header className="top">
        <Brand sub="Create an agency" />
        <nav className="top-links" aria-label="Main"><Link href="/">Main menu</Link></nav>
      </header>
      <main><NewAgencyForm /></main>
      <Footer />
    </div>
  )
}
