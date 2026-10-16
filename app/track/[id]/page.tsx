import type { Metadata } from 'next'
import { Brand, Footer } from '@/components/Brand'
import Track from '@/components/citizen/Track'

export const metadata: Metadata = { title: 'Track a report · Embrace' }

export default async function TrackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <div className="public">
      <header className="top"><Brand sub="Track a report" /></header>
      <main className="citizen"><Track id={id} /></main>
      <Footer />
    </div>
  )
}
