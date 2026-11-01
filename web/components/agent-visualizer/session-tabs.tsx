'use client'

import { useEffect, useRef, useCallback } from 'react'
import { COLORS } from '@/lib/colors'
import type { SessionInfo } from '@/lib/vscode-bridge'

interface SessionTabsProps {
  sessions: SessionInfo[]
  selectedSessionId: string | null
  sessionsWithActivity: Set<string>
  onSelectSession: (id: string) => void
  onCloseSession: (id: string) => void
}

export function SessionTabs({
  sessions,
  selectedSessionId,
  sessionsWithActivity,
  onSelectSession,
  onCloseSession,
}: SessionTabsProps) {
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  const setButtonRef = useCallback((id: string, el: HTMLButtonElement | null) => {
    if (el) buttonRefs.current.set(id, el)
    else buttonRefs.current.delete(id)
  }, [])

  // Scroll selected tab into view whenever it changes
  useEffect(() => {
    if (!selectedSessionId) return
    const el = buttonRefs.current.get(selectedSessionId)
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
  }, [selectedSessionId])

  return (
    <div className="flex gap-1">
      {sessions.map(session => {
        const isSelected = session.id === selectedSessionId
        const isActive = session.status === 'active'
        const hasActivity = sessionsWithActivity.has(session.id)
        // Green dot: session is active, OR has unseen background activity
        const showGreen = isActive || hasActivity
        return (
          <div key={session.id} className="observatory-session" data-selected={isSelected}>
          <button
            type="button"
            aria-pressed={isSelected}
            title={session.label}
            ref={(el) => setButtonRef(session.id, el)}
            onClick={() => onSelectSession(session.id)}
            className="observatory-session-select"
            style={{ color: isSelected ? COLORS.holoBright : COLORS.textMuted }}
          >
            <span aria-hidden="true" className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: showGreen ? COLORS.complete : COLORS.idle + '40' }} />
            <span className="truncate">{session.label}</span>
          </button>
          <button type="button" className="observatory-session-close"
            aria-label={`Close session ${session.label}`} title="Close session"
            onClick={() => onCloseSession(session.id)}>&times;</button>
          </div>
        )
      })}
    </div>
  )
}
