"use client"

import { buildTimelineEvents } from "@/lib/timeline-events"
import { useState, useCallback, useMemo, useEffect, useLayoutEffect, useRef } from "react"
import { useAgentSimulation } from "@/hooks/use-agent-simulation"
import { useVSCodeBridge } from "@/hooks/use-vscode-bridge"
import { useSelectionState } from "@/hooks/use-selection-state"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"
import { AgentCanvas } from "./canvas"
import { ControlBar } from "./control-bar"
import { AgentDetailCard } from "./agent-detail-card"
import { GlassContextMenu } from "./glass-context-menu"
import { ToolDetailPopup } from "./tool-detail-popup"
import { DiscoveryDetailPopup } from "./discovery-detail-popup"
import { FileAttentionPanel } from "./file-attention-panel"
import { TimelinePanel } from "./timeline-panel"
import { AgentChatPanel } from "./chat-panel"
import { SessionTranscriptPanel } from "./session-transcript-panel"
import { OpenFileProvider } from "./tool-content-renderer"
import { stopPropagationHandlers } from "./shared-ui"
import { TimelineEvent, TIMING } from "@/lib/agent-types"
import { COLORS } from "@/lib/colors"

import { MOCK_DURATION } from "@/lib/mock-scenario"
import { MessageFeedPanel } from "./message-feed-panel"
import { ConversationPanel } from "./conversation-panel"
import { TopBar } from "./top-bar"
import { useAudioEffects } from "@/hooks/use-audio-effects"

export function AgentVisualizer() {
  const bridge = useVSCodeBridge()

  const {
    frameRef,
    agents,
    toolCalls,
    particles,
    edges,
    discoveries,
    fileAttention,
    timelineEntries,
    currentTime,
    isPlaying,
    speed,
    maxTimeReached,
    conversations,
    play,
    pause,
    restart,
    setSpeed,
    seekToTime,
    updateAgentPosition,
    saveSnapshot,
    restoreSnapshot,
  } = useAgentSimulation({
    useMockData: bridge.useMockData,
    externalEvents: bridge.pendingEvents,
    onExternalEventsConsumed: bridge.consumeEvents,
    sessionFilter: bridge.selectedSessionId,
    // Pass the ref that's updated synchronously in session-started handler,
    // so the animation frame never uses a stale filter value.
    sessionFilterRef: bridge.selectedSessionIdRef,
    disable1MContext: bridge.disable1MContext,
  })

  const selection = useSelectionState({ agents, toolCalls, discoveries })

  const [showStats, setShowStats] = useState(false)
  const [showHexGrid, setShowHexGrid] = useState(true)
  const [showCostOverlay, setShowCostOverlay] = useState(false)
  const [showTimeline, setShowTimeline] = useState(false)
  const [showFileAttention, setShowFileAttention] = useState(false)
  const [showTranscript, setShowTranscript] = useState(false)
  const [showConversation, setShowConversation] = useState(false)

  // Mutually exclusive panel toggling — opening one closes the others
  const toggleExclusivePanel = useCallback((panel: 'files' | 'transcript' | 'cost' | 'conversation') => {
    setShowConversation(prev => panel === 'conversation' ? !prev : false)
    setShowFileAttention(prev => panel === 'files' ? !prev : false)
    setShowTranscript(prev => panel === 'transcript' ? !prev : false)
    setShowCostOverlay(prev => panel === 'cost' ? !prev : false)
  }, [])
  const [zoomToFitTrigger, setZoomToFitTrigger] = useState(0)

  const [isReviewing, setIsReviewing] = useState(false)
  const { isMuted, seekingRef, handleToggleMute } = useAudioEffects(agents, toolCalls, isReviewing)

  // Auto-play on mount
  useEffect(() => {
    const timer = setTimeout(() => play(), TIMING.autoPlayDelayMs)
    return () => clearTimeout(timer)
  }, [play])

  // Per-session state cache: save/restore simulation state on tab switch
  // so sessions stay up to date and switching is instant.
  // useLayoutEffect ensures restart happens synchronously before any animation
  // frame can consume and discard events from pendingEventsRef.
  const sessionCacheRef = useRef<Map<string, { snapshot: ReturnType<typeof saveSnapshot>; eventCount: number }>>(new Map())
  const prevSelectedRef = useRef<string | null>(null)
  const previousResetVersionRef = useRef(bridge.sessionResetVersion)
  useLayoutEffect(() => {
    if (previousResetVersionRef.current !== bridge.sessionResetVersion) {
      previousResetVersionRef.current = bridge.sessionResetVersion
      prevSelectedRef.current = null
      sessionCacheRef.current.clear()
      selection.clearAllSelections()
      setIsReviewing(false)
      seekingRef.current = false
      if (resumeTimerRef.current) { clearTimeout(resumeTimerRef.current); resumeTimerRef.current = null }
      if (!bridge.selectedSessionId) {
        restart()
        return
      }
    }
    if (!bridge.selectedSessionId && prevSelectedRef.current !== null) {
      prevSelectedRef.current = null
      sessionCacheRef.current.clear()
      selection.clearAllSelections()
      setIsReviewing(false)
      seekingRef.current = false
      if (resumeTimerRef.current) { clearTimeout(resumeTimerRef.current); resumeTimerRef.current = null }
      restart()
      return
    }
    if (bridge.selectedSessionId && bridge.selectedSessionId !== prevSelectedRef.current) {
      selection.clearAllSelections()
      setIsReviewing(false)
      seekingRef.current = false
      if (resumeTimerRef.current) { clearTimeout(resumeTimerRef.current); resumeTimerRef.current = null }
      // Save outgoing session state (if any)
      if (prevSelectedRef.current !== null) {
        sessionCacheRef.current.set(prevSelectedRef.current, {
          snapshot: saveSnapshot(),
          eventCount: bridge.getSessionEventCount(prevSelectedRef.current),
        })
      }

      // Restore or cold-start the incoming session, then flush events.
      // Flushing happens HERE (after state swap) to prevent the animation
      // frame from processing events in the wrong simulation context.
      const cached = sessionCacheRef.current.get(bridge.selectedSessionId)
      if (cached) {
        restoreSnapshot(cached.snapshot)
        play()
        bridge.flushSessionEvents(bridge.selectedSessionId, cached.eventCount)
      } else {
        restart()
        bridge.flushSessionEvents(bridge.selectedSessionId)
      }

      prevSelectedRef.current = bridge.selectedSessionId
    }
  }, [bridge.selectedSessionId, bridge.sessionResetVersion, restart, bridge.flushSessionEvents, saveSnapshot, restoreSnapshot, bridge.getSessionEventCount, selection.clearAllSelections])

  // Derive markers from the current conversation snapshot so seeks, session
  // swaps, and capped message arrays cannot retain stale markers.
  const timelineEvents = useMemo(() => buildTimelineEvents(conversations), [conversations])

  // Review mode: when in live mode and user pauses to scrub through history

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      pause()
      setIsReviewing(true)
    } else {
      play()
    }
  }, [isPlaying, play, pause])

  const handleEnterReview = useCallback(() => {
    pause()
    setIsReviewing(true)
  }, [pause])

  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleResumeLive = useCallback(() => {
    setIsReviewing(false)
    seekToTime(maxTimeReached)
    setZoomToFitTrigger(n => n + 1)
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current)
    resumeTimerRef.current = setTimeout(() => { resumeTimerRef.current = null; play() }, TIMING.resumeLiveDelayMs)
  }, [seekToTime, maxTimeReached, play])
  useEffect(() => () => { if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current) }, [])

  const handleRestart = useCallback(() => {
    setIsReviewing(true)
    restart(true)
  }, [restart])

  // Keyboard shortcuts
  const keyboardActions = useMemo(() => ({
    togglePlayPause: handlePlayPause,
    toggleFilePanel: () => toggleExclusivePanel('files'),
    toggleTranscript: () => toggleExclusivePanel('transcript'),
    toggleTimeline: () => { setShowTimeline(prev => !prev) },
    toggleHexGrid: () => { setShowHexGrid(prev => !prev) },
    toggleStats: () => { setShowStats(prev => !prev) },
    toggleCostOverlay: () => toggleExclusivePanel('cost'),
    zoomToFit: () => { setZoomToFitTrigger(n => n + 1) },
    clearSelection: () => { selection.clearAllSelections() },
    deselectAgent: () => { selection.clearAgent() },
    closeTranscript: () => { setShowConversation(false); setShowTranscript(false); setShowFileAttention(false); setShowTimeline(false); setShowCostOverlay(false) },
    toggleMute: handleToggleMute,
    setSpeed,
    selectedAgentId: selection.selectedAgentId,
  }), [handlePlayPause, selection.clearAllSelections, selection.clearAgent, selection.selectedAgentId, setSpeed, handleToggleMute, toggleExclusivePanel])

  useKeyboardShortcuts(keyboardActions)

  const totalTokens = useMemo(() => {
    let sum = 0
    for (const a of agents.values()) sum += a.tokensUsed
    return sum
  }, [agents])

  const selectedAgent = selection.selectedAgentId ? agents.get(selection.selectedAgentId) : null
  const selectedConversation = selection.selectedAgentId ? (conversations.get(selection.selectedAgentId) || []) : []

  // Session runtime — drives the assistant label (CLAUDE vs CODEX) in transcript panels
  const sessionRuntime = useMemo(() => {
    for (const a of agents.values()) {
      if (a.runtime === 'codex') return 'codex' as const
    }
    return 'claude' as const
  }, [agents])

  // Session-wide conversation (all agents merged chronologically)
  // Only compute when the transcript panel is visible to avoid O(n log n) sort every frame
  const sessionConversation = useMemo(() => {
    if (!showTranscript) return []
    const all = Array.from(conversations.values()).flat()
    return all.sort((a, b) => a.timestamp - b.timestamp)
  }, [conversations, showTranscript])

  // Context menu items
  const contextMenuItems = selection.contextMenu ? (
    selection.contextMenu.agentId ? [
      { label: '📊  Toggle Stats', onClick: () => setShowStats(prev => !prev) },
    ] : [
      { label: '🔍  Zoom to Fit', onClick: () => setZoomToFitTrigger(n => n + 1) },
      { label: '📊  Toggle Stats', onClick: () => setShowStats(prev => !prev) },
      { label: '⬡  Toggle Grid', onClick: () => setShowHexGrid(prev => !prev) },
      { label: '', onClick: () => {}, separator: true },
      { label: '⟲  Restart', onClick: restart },
    ]
  ) : []

  const handleCloseSession = useCallback((id: string) => {
    bridge.removeSession(id)
    sessionCacheRef.current.delete(id)
    if (bridge.selectedSessionId === id) {
      const remaining = bridge.sessions.filter(s => s.id !== id)
      bridge.selectSession(remaining[remaining.length - 1]?.id ?? null)
    }
  }, [bridge])

  const openFile = useCallback((filePath: string, line?: number) => {
    bridge.bridgeOpenFile(filePath, line)
  }, [bridge])

  return (
    <OpenFileProvider value={bridge.isVSCode ? openFile : null}>
    <div className="observatory h-screen w-screen relative overflow-hidden" style={{ background: COLORS.void }}>
      {/* Canvas fills everything */}
      <AgentCanvas
        simulationRef={frameRef}
        selectedAgentId={selection.selectedAgentId}
        hoveredAgentId={selection.hoveredAgentId}
        showStats={showStats}
        showHexGrid={showHexGrid}
        zoomToFitTrigger={zoomToFitTrigger}
        pauseAutoFit={selection.contextMenu !== null}
        onAgentClick={selection.handleAgentClick}
        onAgentHover={selection.setHoveredAgentId}
        onAgentDrag={updateAgentPosition}
        onContextMenu={selection.handleContextMenu}
        onToolCallClick={selection.handleToolCallClick}
        selectedToolCallId={selection.selectedToolCallId}
        onDiscoveryClick={selection.handleDiscoveryClick}
        selectedDiscoveryId={selection.selectedDiscoveryId}
        showCostOverlay={showCostOverlay}
      />

      {/* Message feed panel (top-left) */}
      <MessageFeedPanel
        conversations={conversations}
        agents={agents}
        onAgentClick={selection.handleAgentClick}
        selectedAgentId={selection.selectedAgentId}
      />

      {/* Agent detail card (floating, tethered to node) */}
      {selectedAgent && selection.selectedAgentWorldPos && (
        <div {...stopPropagationHandlers}>
          <AgentDetailCard
            agent={selectedAgent}
            onClose={selection.clearAgent}
          />
        </div>
      )}

      {/* Tool call detail popup */}
      {selection.selectedToolData && selection.selectedToolScreenPos && (
        <div {...stopPropagationHandlers}>
          <ToolDetailPopup
            tool={selection.selectedToolData}
            position={selection.selectedToolScreenPos}
            onClose={selection.clearTool}
          />
        </div>
      )}

      {/* Discovery detail popup */}
      {selection.selectedDiscoveryData && selection.selectedDiscoveryScreenPos && (
        <div {...stopPropagationHandlers}>
          <DiscoveryDetailPopup
            discovery={selection.selectedDiscoveryData}
            position={selection.selectedDiscoveryScreenPos}
            onClose={selection.clearDiscovery}
          />
        </div>
      )}

      {/* Chat panel (bottom-right, shown when agent selected) */}
      <AgentChatPanel
        visible={!!selectedAgent}
        agentName={selectedAgent?.name ?? ''}
        agentState={selectedAgent?.state ?? 'idle'}
        conversation={selectedConversation}
        runtime={selectedAgent?.runtime ?? sessionRuntime}
        onClose={selection.clearAgent}
      />

      {/* Context menu */}
      {selection.contextMenu && (
        <GlassContextMenu
          position={selection.contextMenu}
          items={contextMenuItems}
          onClose={() => selection.setContextMenu(null)}
        />
      )}

      {/* Floating control strip */}
      <ControlBar
        isPlaying={isPlaying}
        speed={speed}
        currentTime={currentTime}
        totalDuration={bridge.useMockData
          ? (isReviewing ? Math.max(maxTimeReached, currentTime) : MOCK_DURATION)
          : Math.max(maxTimeReached, currentTime)
        }
        onPlayPause={handlePlayPause}
        onRestart={handleRestart}
        onSpeedChange={setSpeed}
        onSeek={(time) => {
          seekingRef.current = true
          pause()
          seekToTime(time)
          setZoomToFitTrigger(n => n + 1)
          if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current)
          resumeTimerRef.current = setTimeout(() => { resumeTimerRef.current = null; seekingRef.current = false }, TIMING.seekCompleteDelayMs)
        }}
        timelineEvents={timelineEvents}
        isReviewing={isReviewing}
        eventCount={timelineEvents.length}
        onEnterReview={handleEnterReview}
        onResumeLive={handleResumeLive}
      />

      {/* File attention panel (slide-in from right) */}
      <FileAttentionPanel
        visible={showFileAttention}
        fileAttention={fileAttention}
        onClose={() => setShowFileAttention(false)}
        onOpenFile={bridge.isVSCode ? openFile : undefined}
      />

      {/* Session transcript panel (slide-in from right) */}
      <SessionTranscriptPanel
        visible={showTranscript}
        conversation={sessionConversation}
        runtime={sessionRuntime}
        onClose={() => setShowTranscript(false)}
      />

      {/* Timeline panel (slide-in from bottom) */}
      <TimelinePanel
        visible={showTimeline}
        timelineEntries={timelineEntries}
        currentTime={currentTime}
        onClose={() => setShowTimeline(false)}
      />

      <ConversationPanel visible={showConversation} onClose={() => setShowConversation(false)} />

      {/* Top bar: session tabs + info/controls */}
      <TopBar
        sessions={bridge.sessions}
        selectedSessionId={bridge.selectedSessionId}
        sessionsWithActivity={bridge.sessionsWithActivity}
        onSelectSession={bridge.selectSession}
        onCloseSession={handleCloseSession}
        isVSCode={bridge.isVSCode}
        connectionStatus={bridge.connectionStatus}
        agentCount={agents.size}
        totalTokens={totalTokens}
        showFileAttention={showFileAttention}
        showTranscript={showTranscript}
        showConversation={showConversation}
        showCostOverlay={showCostOverlay}
        showTimeline={showTimeline}
        isMuted={isMuted}
        onTogglePanel={toggleExclusivePanel}
        onToggleTimeline={() => setShowTimeline(prev => !prev)}
        onToggleMute={handleToggleMute}
      />
    </div>
    </OpenFileProvider>
  )
}
