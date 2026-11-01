'use client'

import { memo, useEffect, useRef, useState } from 'react'
import type { SessionInfo, ConnectionStatus } from '@/lib/bridge-types'
import { formatTokens } from '@/lib/utils'
import { SessionTabs } from './session-tabs'

type ViewMode = 'activity' | 'map' | 'chat'

function PanelMenu({
  showFileAttention, showTranscript, showCostOverlay, showTimeline, isMuted,
  agentCount, totalTokens, contextCapacity, estimatedCost, onTogglePanel, onToggleTimeline, onToggleMute,
}: {
  showFileAttention: boolean
  showTranscript: boolean
  showCostOverlay: boolean
  showTimeline: boolean
  isMuted: boolean
  agentCount: number
  totalTokens: number
  contextCapacity: number
  estimatedCost: number
  onTogglePanel: (panel: 'files' | 'transcript' | 'cost') => void
  onToggleTimeline: () => void
  onToggleMute: () => void
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false)
    }
    const closeEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeEscape)
    }
  }, [open])
  const action = (run: () => void) => { run(); setOpen(false) }

  return <div className="workbench-menu" ref={root}>
    <button type="button" className="workbench-menu-trigger" aria-label="Inspect and more tools" aria-expanded={open} onClick={() => setOpen(value => !value)}><span className="workbench-menu-desktop-label">Inspect</span><span className="workbench-menu-mobile-label">More</span></button>
    {open && <div className="workbench-menu-panel" role="group" aria-label="Activity panels">
      {(agentCount > 1 || totalTokens > 0) && <div className="workbench-menu-summary">
        {agentCount > 1 && <span>{agentCount} agents in session</span>}
        {totalTokens > 0 && <span>Context window: {formatTokens(totalTokens)} / {formatTokens(contextCapacity)} ({contextCapacity > 0 ? Math.round(totalTokens / contextCapacity * 100) : 0}%)</span>}
        {totalTokens > 0 && <span>Estimated cost: ~${estimatedCost.toFixed(2)}</span>}
      </div>}
      <button type="button" aria-pressed={showFileAttention} onClick={() => action(() => onTogglePanel('files'))}>Files</button>
      <button type="button" aria-pressed={showTranscript} onClick={() => action(() => onTogglePanel('transcript'))}>Transcript</button>
      <button type="button" aria-pressed={showCostOverlay} onClick={() => action(() => onTogglePanel('cost'))}>Context and cost</button>
      <button type="button" aria-pressed={showTimeline} onClick={() => action(onToggleTimeline)}>Timeline</button>
      <button type="button" aria-pressed={!isMuted} onClick={() => action(onToggleMute)}>{isMuted ? 'Enable sound' : 'Mute sound'}</button>
    </div>}
  </div>
}

export interface TopBarProps {
  sessions: SessionInfo[]
  selectedSessionId: string | null
  sessionsWithActivity: Set<string>
  onSelectSession: (id: string | null) => void
  onCloseSession: (id: string) => void
  sessionPlaceholder: string
  connectionStatus: ConnectionStatus
  isMockData: boolean
  agentCount: number
  totalTokens: number
  contextCapacity: number
  estimatedCost: number
  showFileAttention: boolean
  showTranscript: boolean
  showCostOverlay: boolean
  showTimeline: boolean
  isMuted: boolean
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  onTogglePanel: (panel: 'files' | 'transcript' | 'cost') => void
  onToggleTimeline: () => void
  onToggleMute: () => void
}

export const TopBar = memo(function TopBar({
  sessions, selectedSessionId, sessionsWithActivity, onSelectSession, onCloseSession,
  sessionPlaceholder, connectionStatus, isMockData, agentCount, totalTokens, contextCapacity, estimatedCost,
  showFileAttention, showTranscript, showCostOverlay, showTimeline, isMuted,
  viewMode, onViewModeChange, onTogglePanel, onToggleTimeline, onToggleMute,
}: TopBarProps) {
  return <header className="workbench-header">
    <div className="workbench-product">Agent Flow</div>
    <div className="workbench-session-slot">
      <SessionTabs
        sessions={sessions}
        selectedSessionId={selectedSessionId}
        sessionsWithActivity={sessionsWithActivity}
        onSelectSession={onSelectSession}
        onCloseSession={onCloseSession}
        placeholder={sessionPlaceholder}
      />
    </div>
    <nav className="workbench-views" aria-label="Workbench view">
      {([['activity', 'Activity'], ['map', 'Map'], ['chat', 'Local chat']] as const).map(([mode, label]) =>
        <button key={mode} type="button" aria-pressed={viewMode === mode} onClick={() => onViewModeChange(mode)}>{label}</button>
      )}
    </nav>
    <label className="sr-only" htmlFor="workbench-view-select">Workbench view</label>
    <select id="workbench-view-select" className="workbench-view-select" value={viewMode} onChange={event => onViewModeChange(event.target.value as ViewMode)}>
      <option value="activity">Activity</option>
      <option value="map">Map</option>
      <option value="chat">Local chat</option>
    </select>
    <div className="workbench-header-actions">
      {viewMode !== 'chat' && !isMockData && <span className={`workbench-connection connection-${connectionStatus}`} role="status">
        <i aria-hidden="true" />{connectionStatus === 'watching' ? 'Live' : connectionStatus === 'connected' ? 'Connected' : 'Offline'}
      </span>}
      <PanelMenu
        showFileAttention={showFileAttention}
        showTranscript={showTranscript}
        showCostOverlay={showCostOverlay}
        showTimeline={showTimeline}
        isMuted={isMuted}
        agentCount={agentCount}
        totalTokens={totalTokens}
        contextCapacity={contextCapacity}
        estimatedCost={estimatedCost}
        onTogglePanel={onTogglePanel}
        onToggleTimeline={onToggleTimeline}
        onToggleMute={onToggleMute}
      />
    </div>
  </header>
})
