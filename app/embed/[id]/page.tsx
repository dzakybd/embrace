import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Report from '@/components/citizen/Report'
import { LangProvider } from '@/components/Lang'
import { agencyById } from '@/lib/agencies'
import { asLang } from '@/lib/i18n'
import { getLang } from '@/lib/i18n-server'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const agency = await agencyById((await params).id)
  return { title: agency ? `Report to ${agency.short_name}` : 'Report' }
}

/** The report chat alone, for an agency to embed on its own website (iframe) or share as a link. `?lang=id` sets the language. */
export default async function EmbedPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ lang?: string }> }) {
  const { id } = await params
  if (!(await agencyById(id))) notFound()
  const q = (await searchParams).lang
  return (
    <LangProvider lang={q ? asLang(q) : await getLang()}>
      <main className="embed"><Report agencyId={id} embed /></main>
    </LangProvider>
  )
}
