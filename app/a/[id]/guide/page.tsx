import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Brand, Footer } from '@/components/Brand'
import { LangSwitch } from '@/components/Lang'
import { Procedures, catLabel, LawLinks } from '@/components/Procedures'
import { Icon } from '@/components/ui'
import { agencyById } from '@/lib/agencies'
import { localize, translator } from '@/lib/i18n'
import { getLang } from '@/lib/i18n-server'
import { sourcesFor } from '@/lib/sop'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Case types and procedures' }

/** What happens to each kind of report: the agency's published procedures and the laws behind them, for citizens and staff alike. */
export default async function GuidePage({ params }: { params: Promise<{ id: string }> }) {
  const found = await agencyById((await params).id)
  if (!found) notFound()
  const lang = await getLang()
  const t = translator(lang)
  const agency = localize(found, lang)
  const docs = sourcesFor(agency.id)
  return (
    <div className="public">
      <header className="top">
        <Brand sub={agency.short_name} />
        <nav className="top-links" aria-label="Main">
          <Link href={`/a/${agency.id}`}>
            <Icon name="back" size={16} /> {agency.short_name}
          </Link>
          <LangSwitch />
        </nav>
      </header>
      <main className="agency-page guide">
        <h1>{t('Case types and procedures')}</h1>
        <p className="lead">
          {t(
            'What happens after you report, step by step, following the procedures {agency} publishes and Indonesian law. Staff tick off the same stages, and you can follow them when you track your report.',
            { agency: agency.short_name },
          )}
        </p>
        <div className="guide-actions">
          <Link className="btn primary" href={`/report?agency=${agency.id}`}>
            <Icon name="form" size={16} /> {t('Report a problem')}
          </Link>
          <span className="muted small">
            {t('First response within {h} hours; urgent reports within {c} hours.', {
              h: agency.sla_hours.normal,
              c: agency.sla_hours.critical,
            })}
          </span>
        </div>
        <Procedures procedures={agency.procedures ?? []} categories={agency.categories} docs={docs} lang={lang} t={t} />
        <details className="card more">
          <summary>
            <Icon name="book" /> {t('Legal basis by case type')}
          </summary>
          <table className="law-table">
            <tbody>
              {agency.categories.map((c) => (
                <tr key={c.id}>
                  <th scope="row">{catLabel(c, lang)}</th>
                  <td>
                    <LawLinks shorts={c.laws ?? []} docs={docs} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </main>
      <Footer />
    </div>
  )
}
