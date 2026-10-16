import type { Metadata } from 'next'
import Insights from '@/components/staff/Insights'

export const metadata: Metadata = { title: 'Insights' }

export default function Page() {
  return <Insights />
}
