import type { Metadata } from 'next'
import { StaffShell } from '@/components/staff/Shell'

export const metadata: Metadata = { title: 'Staff workspace · Embrace' }

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <StaffShell>{children}</StaffShell>
}
