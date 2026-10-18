import { redirect } from 'next/navigation'

/** Case types became Policies (case types plus escalation rules). */
export default function Page() {
  redirect('/staff/policies')
}
