// ADK observability on Google Cloud: ADK's own spans (invoke_agent, generate_content, execute_tool, with gen_ai.*
// attributes) go to Cloud Trace, and the governance plugin's GenAI metrics go to Cloud Monitoring, through ADK's
// getGcpExporters. Logs are structured JSON on stdout, which Cloud Run sends to Cloud Logging. Prompt and complaint
// content is never captured: spans and logs carry metadata only.
import { maybeSetOtelProviders } from '@google/adk'
import { getGcpExporters, getGcpResource } from '@google/adk/telemetry/gcp'
// ADK loads these optional exporters with a dynamic require; importing them here makes the build ship them.
import '@google-cloud/opentelemetry-cloud-monitoring-exporter'
import '@google-cloud/opentelemetry-cloud-trace-exporter'

export interface TelemetryStatus {
  tracing: boolean
  metrics: boolean
  logging: boolean
  project: string | null
  error?: string
}

const g = globalThis as { __embraceTelemetry?: TelemetryStatus }

/** What is exported, for the AI control tower. */
export const telemetryStatus = (): TelemetryStatus =>
  g.__embraceTelemetry ?? { tracing: false, metrics: false, logging: !!process.env.K_SERVICE, project: null }

export async function startTelemetry() {
  // On Cloud Run (K_SERVICE is set), or locally with EMBRACE_OTEL=1 and application default credentials.
  if (!process.env.K_SERVICE && process.env.EMBRACE_OTEL !== '1') return
  try {
    const hooks = await getGcpExporters({ enableTracing: true, enableMetrics: true })
    maybeSetOtelProviders([hooks], getGcpResource())
    g.__embraceTelemetry = {
      tracing: !!hooks.spanProcessors?.length,
      metrics: !!hooks.metricReaders?.length,
      logging: !!process.env.K_SERVICE,
      project: process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GCLOUD_PROJECT ?? null,
    }
  } catch (err) {
    g.__embraceTelemetry = { tracing: false, metrics: false, logging: !!process.env.K_SERVICE, project: null, error: String(err).slice(0, 200) }
    console.error(JSON.stringify({ severity: 'ERROR', message: 'telemetry_setup_failed', error: String(err).slice(0, 300) }))
  }
}
