import type { NextConfig } from 'next'

const config: NextConfig = {
  // No generated AGENTS.md: the repository carries no AI coding-assistant files.
  agentRules: false,
  // ADK and the Admin SDK load optional modules at runtime; keep them out of the bundle.
  serverExternalPackages: [
    '@google/adk',
    'firebase-admin',
    '@google-cloud/opentelemetry-cloud-trace-exporter',
    '@google-cloud/opentelemetry-cloud-monitoring-exporter',
  ],
  // Stable short link for the demo video in the deck and README.
  async redirects() {
    return [
      {
        source: '/demo',
        destination: 'https://www.youtube.com/watch?v=RK11lo23qUs',
        permanent: false,
      },
    ]
  },
}

export default config
