import type { Metadata } from 'next'
import { StaffShell } from '@/components/staff/Shell'

export const metadata: Metadata = { title: { default: 'Staff workspace', template: '%s · Staff · Embrace' } }

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <StaffShell>{children}</StaffShell>
}
