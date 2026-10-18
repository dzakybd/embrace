import type { Metadata } from 'next'
import CaseTypes from '@/components/staff/CaseTypes'

export const metadata: Metadata = { title: 'Policies' }

export default function Page() {
  return <CaseTypes />
}
