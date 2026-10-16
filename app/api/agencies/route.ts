import { AGENCIES, publicAgency } from '@/lib/agencies'

export const GET = () => Response.json(Object.values(AGENCIES).map(publicAgency))
