import type { Metadata } from 'next'
import Integrations from '@/components/staff/Integrations'

export const metadata: Metadata = { title: 'Channels' }

export default function IntegrationsPage() {
  return <Integrations />
}
