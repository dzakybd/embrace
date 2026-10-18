import type { NextConfig } from 'next'

const config: NextConfig = {
  // ADK and the Admin SDK load optional modules at runtime; keep them out of the bundle.
  serverExternalPackages: ['@google/adk', 'firebase-admin', '@google-cloud/opentelemetry-cloud-trace-exporter', '@google-cloud/opentelemetry-cloud-monitoring-exporter'],
}

export default config
