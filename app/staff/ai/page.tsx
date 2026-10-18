import type { Metadata } from 'next'
import AiTower from '@/components/staff/AiTower'

export const metadata: Metadata = { title: 'AI control tower' }

export default function Page() {
  return <AiTower />
}
