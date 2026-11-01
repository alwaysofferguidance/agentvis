"use client"

import { memo, useEffect, useLayoutEffect, useRef, useState } from "react"
import { Z } from "@/lib/agent-types"
import { COLORS } from "@/lib/colors"
import { formatTokens } from "@/lib/utils"
import { agentCost } from "./canvas/draw-cost"
import { SessionTabs } from "./session-tabs"
import type { SessionInfo, ConnectionStatus } from "@/lib/bridge-types"

// ─── Mute/Unmute SVG Icons ───────────────────────────────────────────────────

function MutedIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  )
}

function UnmutedIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  )
}

// ─── Toggle Button ──────────────────────────────────────────────────────────

function ToggleButton({ active, onClick, children, style, activeColor, label }: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  style?: React.CSSProperties
  activeColor?: { bg: string; text: string }
  label?: string
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className="px-1.5 py-0.5 rounded transition-all"
      style={{
        background: active ? (activeColor?.bg ?? COLORS.toggleActive) : COLORS.toggleInactive,
        border: `1px solid ${COLORS.toggleBorder}`,
        color: active ? (activeColor?.text ?? COLORS.holoBright) : COLORS.textMuted,
        ...style,
      }}
    >
      {children}
    </button>
  )
}

// ─── Connection Status Indicator ────────────────────────────────────────────

function ConnectionIndicator({ status }: { status: ConnectionStatus }) {
  const color = status === 'watching' ? COLORS.complete
    : status === 'connected' ? COLORS.idle : COLORS.error
  const label = status === 'watching' ? 'LIVE'
    : status === 'connected' ? 'CONNECTED' : 'OFFLINE'

  return (
    <span className="flex items-center gap-1.5" role="status" aria-live="polite">
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: color, boxShadow: `0 0 4px ${color}` }}
      />
      {label}
    </span>
  )
}

// ─── Top Bar ────────────────────────────────────────────────────────────────

export interface TopBarProps {
  // Session tabs
  sessions: SessionInfo[]
  selectedSessionId: string | null
  sessionsWithActivity: Set<string>
  onSelectSession: (id: string) => void
  onCloseSession: (id: string) => void
  // Connection
  isVSCode: boolean
  connectionStatus: ConnectionStatus
  // Stats
  agentCount: number
  totalTokens: number
  // Panel toggles
  showFileAttention: boolean
  showConversation: boolean
  showTranscript: boolean
  showCostOverlay: boolean
  showTimeline: boolean
  isMuted: boolean
  onTogglePanel: (panel: 'files' | 'transcript' | 'cost' | 'conversation') => void
  onToggleTimeline: () => void
  onToggleMute: () => void
}

export const TopBar = memo(function TopBar({
  sessions, selectedSessionId, sessionsWithActivity,
  onSelectSession, onCloseSession,
  connectionStatus,
  agentCount, totalTokens,
  showFileAttention, showTranscript, showConversation, showCostOverlay, showTimeline, isMuted,
  onTogglePanel, onToggleTimeline, onToggleMute,
}: TopBarProps) {
  const headerRef = useRef<HTMLDivElement>(null)
  const moreTriggerRef = useRef<HTMLButtonElement>(null)
  const moreMenuRef = useRef<HTMLDivElement>(null)
  const [moreOpen, setMoreOpen] = useState(false)
  useLayoutEffect(() => {
    const header = headerRef.current
    if (!header) return
    const update = () => header.parentElement?.style.setProperty('--obs-panel-top', `${header.offsetTop + header.offsetHeight + 12}px`)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(header)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!moreOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setMoreOpen(false)
      moreTriggerRef.current?.focus()
    }
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (moreMenuRef.current?.contains(target) || moreTriggerRef.current?.contains(target)) return
      setMoreOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [moreOpen])

  const closeMore = (action: () => void) => {
    action()
    setMoreOpen(false)
    moreTriggerRef.current?.focus()
  }

  return (
    <div ref={headerRef} className="observatory-header" style={{ zIndex: moreOpen ? Z.contextMenu : Z.info }}>
      {/* Session tabs — scrollable, takes available space */}
      <div className="observatory-sessions scrollbar-hide">
        <SessionTabs
          sessions={sessions}
          selectedSessionId={selectedSessionId}
          sessionsWithActivity={sessionsWithActivity}
          onSelectSession={onSelectSession}
          onCloseSession={onCloseSession}
        />
      </div>

      {/* Right-side info/controls */}
      <div className="observatory-tools" style={{ color: COLORS.textMuted }}>
        <ConnectionIndicator status={connectionStatus} />
        <span className="observatory-metric"><b>{agentCount}</b> agents</span>
        <span className="observatory-metric">
          <b>{formatTokens(totalTokens)}</b> tokens
          <span style={{ color: COLORS.textDim, marginLeft: 4 }}>
            ~${agentCost(totalTokens).toFixed(2)}
          </span>
        </span>

        {/* Mutually exclusive panel group */}
        <div className="observatory-desktop-panels flex items-center gap-1">
          <ToggleButton active={showFileAttention} onClick={() => onTogglePanel('files')}>Files</ToggleButton>
          <ToggleButton active={showTranscript} onClick={() => onTogglePanel('transcript')}>Transcript</ToggleButton>
          <ToggleButton
            active={showCostOverlay}
            onClick={() => onTogglePanel('cost')}
            activeColor={{ bg: COLORS.costActiveBg, text: COLORS.complete }}
          >
            Cost
          </ToggleButton>
        </div>

        <ToggleButton active={showConversation} onClick={() => onTogglePanel('conversation')}>Talk</ToggleButton>
        {/* Independent toggles */}
        <div className="observatory-desktop-panels flex items-center gap-1">
          <ToggleButton active={showTimeline} onClick={onToggleTimeline}>Timeline</ToggleButton>
          <ToggleButton active={!isMuted} label={isMuted ? "Enable sound" : "Mute sound"} onClick={onToggleMute}>
          {isMuted ? <MutedIcon /> : <UnmutedIcon />}
          </ToggleButton>
        </div>

        <div className="observatory-overflow">
          <button
            ref={moreTriggerRef}
            type="button"
            className="observatory-more-trigger"
            aria-expanded={moreOpen}
            aria-controls="observatory-more-menu"
            onClick={() => setMoreOpen(open => !open)}
          >
            More <span aria-hidden="true">{moreOpen ? '▴' : '▾'}</span>
          </button>
          {moreOpen && (
            <div ref={moreMenuRef} id="observatory-more-menu" className="observatory-more-menu" aria-label="More controls">
              <div className="observatory-more-metrics">
                <span><b>{agentCount}</b> agents</span>
                <span><b>{formatTokens(totalTokens)}</b> tokens</span>
                <span>~${agentCost(totalTokens).toFixed(2)}</span>
              </div>
              <ToggleButton active={showFileAttention} onClick={() => closeMore(() => onTogglePanel('files'))}>Files</ToggleButton>
              <ToggleButton active={showTranscript} onClick={() => closeMore(() => onTogglePanel('transcript'))}>Transcript</ToggleButton>
              <ToggleButton active={showCostOverlay} onClick={() => closeMore(() => onTogglePanel('cost'))} activeColor={{ bg: COLORS.costActiveBg, text: COLORS.complete }}>Cost</ToggleButton>
              <ToggleButton active={showTimeline} onClick={() => closeMore(onToggleTimeline)}>Timeline</ToggleButton>
              <ToggleButton active={!isMuted} label={isMuted ? "Enable sound" : "Mute sound"} onClick={() => closeMore(onToggleMute)}>
                {isMuted ? <MutedIcon /> : <UnmutedIcon />} Sound
              </ToggleButton>
            </div>
          )}
        </div>
      </div>
    </div>
  )
})
