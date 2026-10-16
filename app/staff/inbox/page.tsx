import type { Metadata } from 'next'
import Inbox from '@/components/staff/Inbox'

export const metadata: Metadata = { title: 'Inbox' }

export default function Page() {
  return <Inbox />
}
