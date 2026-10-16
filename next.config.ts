import type { NextConfig } from 'next'

const config: NextConfig = {
  // ADK and the Admin SDK load optional modules at runtime; keep them out of the bundle.
  serverExternalPackages: ['@google/adk', 'firebase-admin'],
}

export default config
