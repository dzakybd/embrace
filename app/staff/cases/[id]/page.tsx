import Case from '@/components/staff/Case'

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <Case id={id} />
}
