import type { Metadata } from 'next'
import Team from '@/components/staff/Team'

export const metadata: Metadata = { title: 'Team' }

export default function Page() {
  return <Team />
}
