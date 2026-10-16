import type { Metadata } from 'next'
import Case from '@/components/staff/Case'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  return { title: `Case ${(await params).id}` }
}

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <Case id={id} />
}
