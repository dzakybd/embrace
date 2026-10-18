'use client'

import { useEffect, useRef, useState } from 'react'
import { registerAdminPrompt } from './adminFetch'
import { useT } from './Lang'

/** The settings password dialog, opened by adminFetch when a save needs it. */
export function AdminPrompt() {
  const t = useT()
  const [open, setOpen] = useState<{ wrong: boolean } | null>(null)
  const [value, setValue] = useState('')
  const resolve = useRef<((v: string | null) => void) | null>(null)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    registerAdminPrompt(
      (wrong) =>
        new Promise((r) => {
          resolve.current = r
          setValue('')
          setOpen({ wrong })
        }),
    )
    return () => registerAdminPrompt(null)
  }, [])
  useEffect(() => {
    if (open) input.current?.focus()
  }, [open])

  const close = (v: string | null) => {
    resolve.current?.(v)
    resolve.current = null
    setOpen(null)
  }
  if (!open) return null
  return (
    <div className="modal-back" role="presentation" onClick={() => close(null)}>
      <form
        className="modal card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-h"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          if (value) close(value)
        }}
        onKeyDown={(e) => e.key === 'Escape' && close(null)}
      >
        <h2 id="admin-h">{t('Settings password')}</h2>
        <p className="muted small">
          {t('Changes to this agency’s setup need the settings password. Trying the app does not.')}
        </p>
        <input
          ref={input}
          type="password"
          autoComplete="current-password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label={t('Settings password')}
          aria-invalid={open.wrong || undefined}
        />
        {open.wrong && (
          <p className="error small" role="alert">
            {t('Wrong password. Try again.')}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="ghost" onClick={() => close(null)}>
            {t('Cancel')}
          </button>
          <button className="primary" disabled={!value}>
            {t('Save with password')}
          </button>
        </div>
      </form>
    </div>
  )
}
