// Runs once per server instance before it takes requests: OpenTelemetry for the agents (ADK observability).
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') await (await import('./lib/telemetry')).startTelemetry()
}
