'use client'

import { useState } from 'react'
import { api } from '../api'
import AgencyForm from '../AgencyForm'
import { useT } from '../Lang'
import { Icon } from '../ui'
import { useStaff } from './StaffProvider'

/** Supervisor: the agency's rules, categories, teams, staff and documents. Applies to new reports at once. */
export default function Settings() {
  const t = useT()
  const { agency, reload } = useStaff()
  const [restoring, setRestoring] = useState(false)
  const restore = async () => {
    setRestoring(true)
    await api.deleteAgency(agency.id).finally(() => setRestoring(false))
    reload()
  }
  return (
    <div className="page">
      <div className="page-h">
        <div>
          <h1>{t('Settings')}</h1>
          <p className="muted">
            {t('Rules, categories, teams, staff and documents. Changes apply to new reports at once.')}
          </p>
        </div>
        {agency.edited && (
          <button
            className="ghost small"
            onClick={restore}
            disabled={restoring}
            title={t('Back to the settings shipped with the demo')}
          >
            <Icon name="refresh" size={14} /> {t('Restore demo settings')}
          </button>
        )}
      </div>
      <AgencyForm key={`${agency.id}-${agency.edited}`} agency={agency} onSaved={() => reload()} />
    </div>
  )
}
