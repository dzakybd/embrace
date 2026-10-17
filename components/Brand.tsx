import Link from 'next/link'

export function Brand({ sub, href = '/' }: { sub?: string; href?: string }) {
  return (
    <Link className="brand" href={href} aria-label="Embrace home">
      <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="var(--brand)" />
        <circle cx="11" cy="8.6" r="3" fill="#fff" />
        <circle cx="21" cy="8.6" r="3" fill="var(--accent)" />
        <path d="M16 26c-5-3.2-9.6-6.6-9.6-10.6 0-2.4 1.8-3.9 4.4-3.9 2.2 0 4.2 1.6 5.2 3.6" stroke="#fff" strokeWidth="2.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16 26c5-3.2 9.6-6.6 9.6-10.6 0-2.4-1.8-3.9-4.4-3.9-2.2 0-4.2 1.6-5.2 3.6" stroke="var(--accent)" strokeWidth="2.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>
        <b>Embrace</b>
        {sub && <small>{sub}</small>}
      </span>
    </Link>
  )
}

export function Footer() {
  return (
    <footer className="foot">
      Embrace prototype for AI Builder Cup · synthetic data only · Google ADK + Gemini on Firebase App Hosting (Cloud Run), Firestore, Pub/Sub and Cloud Functions
    </footer>
  )
}
