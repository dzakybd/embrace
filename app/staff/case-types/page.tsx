import type { Metadata } from 'next'
import CaseTypes from '@/components/staff/CaseTypes'

export const metadata: Metadata = { title: 'Case types' }

export default function Page() {
  return <CaseTypes />
}
