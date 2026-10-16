import type { Metadata } from 'next'
import Knowledge from '@/components/staff/Knowledge'

export const metadata: Metadata = { title: 'Knowledge' }

export default function Page() {
  return <Knowledge />
}
