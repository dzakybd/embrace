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
  // Short link for the demo video in the deck and README; point it at YouTube once the film is up.
  async redirects() {
    return [
      {
        source: '/demo',
        destination: 'https://drive.google.com/drive/folders/1vu12gJthTznQft9KAmY7A5rueKGBmqYE?usp=sharing',
        permanent: false,
      },
    ]
  },
}

export default config
