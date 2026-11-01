'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SessionInfo } from '@/lib/bridge-types'

export function SessionTabs({
  sessions,
  selectedSessionId,
  sessionsWithActivity,
  onSelectSession,
  onCloseSession,
  placeholder = 'No observed session',
}: {
  sessions: SessionInfo[]
  selectedSessionId: string | null
  sessionsWithActivity: Set<string>
  onSelectSession: (id: string) => void
  onCloseSession: (id: string) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const selected = sessions.find(session => session.id === selectedSessionId)
  const labelCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const session of sessions) counts.set(session.label, (counts.get(session.label) ?? 0) + 1)
    return counts
  }, [sessions])
  const displayLabel = (session: SessionInfo) => labelCounts.get(session.label)! > 1
    ? `${session.label} · ${session.id.slice(-6)}`
    : session.label
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return sessions.filter(session => !normalized || `${session.label} ${session.id}`.toLowerCase().includes(normalized))
  }, [sessions, query])

  const closePicker = useCallback((restoreFocus: boolean) => {
    setOpen(false)
    setQuery('')
    if (restoreFocus) requestAnimationFrame(() => trigger.current?.focus())
  }, [])

  useEffect(() => {
    if (!open) return
    input.current?.focus()
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) closePicker(false)
    }
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        closePicker(true)
      }
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeEscape)
    }
  }, [open, closePicker])

  return (
    <div className="workbench-session-picker" ref={root}>
      <button
        ref={trigger}
        type="button"
        className="workbench-session-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        title={selected ? displayLabel(selected) : placeholder}
        onClick={() => open ? closePicker(false) : setOpen(true)}
      >
        <span className={`workbench-status-dot ${selected?.status === 'active' ? 'is-active' : ''}`} aria-hidden="true" />
        <span className="workbench-session-label">{selected ? displayLabel(selected) : placeholder}</span>
        <span className="workbench-chevron" aria-hidden="true">⌄</span>
      </button>
      {open && (
        <div className="workbench-session-menu" role="dialog" aria-label="Choose observed session">
          <label className="sr-only" htmlFor="workbench-session-search">Search observed sessions</label>
          <input
            ref={input}
            id="workbench-session-search"
            type="search"
            placeholder="Search sessions"
            value={query}
            onChange={event => setQuery(event.target.value)}
            className="workbench-session-search"
          />
          <div className="workbench-session-options" role="group" aria-label="Observed sessions">
            {filtered.map(session => {
              const isSelected = session.id === selectedSessionId
              const hasActivity = sessionsWithActivity.has(session.id)
              return (
                <div className="workbench-session-option-row" key={session.id}>
                  <button
                    type="button"
                    aria-current={isSelected ? 'true' : undefined}
                    className="workbench-session-option"
                    onClick={() => { onSelectSession(session.id); closePicker(true) }}
                  >
                    <span className={`workbench-status-dot ${session.status === 'active' ? 'is-active' : ''} ${hasActivity ? 'has-activity' : ''}`} aria-hidden="true" />
                    <span className="workbench-session-option-name">{displayLabel(session)}</span>
                    <span className="workbench-session-option-state">{hasActivity ? 'New activity' : session.status}</span>
                  </button>
                  <button
                    type="button"
                    className="workbench-session-close"
                    aria-label={`Close ${session.label}`}
                    title="Close session"
                    onClick={() => { onCloseSession(session.id); closePicker(true) }}
                  >×</button>
                </div>
              )
            })}
            {filtered.length === 0 && <p className="workbench-session-empty">{sessions.length === 0 ? placeholder.toLowerCase().includes('demo') ? 'No selectable sessions in demo playback.' : 'No observed sessions are available.' : 'No matching sessions'}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
