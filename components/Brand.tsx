import Link from 'next/link'

export function Brand({ sub, href = '/' }: { sub?: string; href?: string }) {
  return (
    <Link className="brand" href={href} aria-label="Embrace home">
      <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="var(--brand)" />
        <path d="M8 18c3 5 13 5 16 0M10 13a6 6 0 0 1 12 0" stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" />
        <circle cx="16" cy="13" r="2.4" fill="var(--accent)" />
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
