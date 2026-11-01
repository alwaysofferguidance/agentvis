'use client'

import { useMemo, useState } from 'react'
import type { Agent, ToolCallNode } from '@/lib/agent-types'
import type { ConversationMessage } from '@/hooks/simulation/types'
import { deriveActivityItems } from './activity-model'
import { ToolContentRenderer } from './tool-content-renderer'

type WorkbenchView = 'activity' | 'map' | 'chat'

function formatActivityTime(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds))
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`
}

export function Workbench({
  view,
  conversations,
  agents,
  toolCalls,
  sessionLabel,
  hasSessions,
  hasSelectedSession,
  isMockData,
  onOpenLocalChat,
}: {
  view: WorkbenchView
  conversations: Map<string, ConversationMessage[]>
  agents: Map<string, Agent>
  toolCalls: Map<string, ToolCallNode>
  sessionLabel: string
  hasSessions: boolean
  hasSelectedSession: boolean
  isMockData: boolean
  onOpenLocalChat: () => void
}) {
  const [query, setQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const items = useMemo(() => deriveActivityItems(conversations, agents, toolCalls), [conversations, agents, toolCalls])
  const visibleItems = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return items
    return items.filter(item => `${item.agentName} ${item.action} ${item.target} ${item.status} ${item.result}`.toLowerCase().includes(normalized))
  }, [items, query])
  const displayedSession = sessionLabel || (isMockData ? 'Demo replay · sample data' : '')
  const mainAgent = Array.from(agents.values()).find(agent => agent.isMain)
  const activityTitle = (mainAgent?.task || sessionLabel || (isMockData ? 'Demo replay · sample data' : '')).split('\n')[0].trim().slice(0, 120)

  if (view === 'map') {
    return agents.size === 0 ? (
      <main className="workbench-map-empty" aria-label="Agent map">
        <p>{isMockData ? 'Start a demo session to see agent relationships.' : 'Waiting for observed agent activity.'}</p>
      </main>
    ) : null
  }
  if (view === 'chat') return null

  return (
    <main className="workbench-activity" aria-label="Observed activity">
      {(activityTitle || items.length > 0) && <header className="workbench-activity-header">
        <h1 title={activityTitle}>{activityTitle || 'Observed activity'}</h1>
        {items.length > 0 && <label className="workbench-activity-search-wrap">
          <span className="sr-only">Search activity</span>
          <input
            type="search"
            className="workbench-activity-search"
            placeholder="Search activity"
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
        </label>}
      </header>}
      {visibleItems.length > 0 ? (
        <div className="workbench-activity-scroll" role="list" aria-label="Activity timeline">
          {visibleItems.map(item => {
            const expanded = expandedId === item.id
            const isToolCall = item.detail.type === 'tool_call'
            const isToolResult = item.detail.type === 'tool_result'
            const isTool = isToolCall || isToolResult
            const agent = agents.get(item.agentId)
            const actor = agents.size > 1 ? (agent?.isMain ? 'Main' : item.agentName) : ''
            const primary = isToolCall
              ? `${actor ? `${actor} · ` : ''}${item.action}${item.target ? ` · ${item.target}` : ''}`
              : isToolResult
                ? `${actor ? `${actor} · ` : ''}${item.action}${item.target ? ` · ${item.target}` : ''}`
                : `${actor ? `${actor} · ` : ''}${item.action}`
            const summary = isTool ? item.result : item.detail.content
            return (
              <article className="workbench-activity-record" key={item.id} role="listitem">
                <div className="workbench-activity-row">
                  <time className="workbench-activity-time" dateTime={`PT${Math.max(0, item.timestamp)}S`}>{formatActivityTime(item.timestamp)}</time>
                  <div className="workbench-activity-copy">
                    <div className="workbench-activity-primary-line">
                      <span className={`workbench-activity-primary${isTool ? ' is-tool' : ''}`}>{primary}</span>
                      {item.status === 'Running' && <span className="workbench-activity-status status-running">Running</span>}
                      {item.status === 'Error' && <span className="workbench-activity-status status-error">Error</span>}
                    </div>
                    {summary && <p className={`workbench-activity-summary${isTool ? ' is-result' : ''}`} title={summary}>{summary}</p>}
                  </div>
                  <button
                    type="button"
                    className="workbench-activity-details-toggle"
                    aria-expanded={expanded}
                    aria-controls={`activity-detail-${item.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`}
                    onClick={() => setExpandedId(expanded ? null : item.id)}
                  >{expanded ? 'Hide details' : 'Details'}</button>
                </div>
                {expanded && <div className="workbench-activity-detail">
                  <div id={`activity-detail-${item.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`}>
                  {isToolCall ? (
                    <>
                      <div className="workbench-detail-label">Input</div>
                      <ToolContentRenderer toolName={item.detail.toolName || ''} inputData={item.detail.inputData} args={item.detail.content} />
                    </>
                  ) : <p className="workbench-detail-text">{item.detail.content || 'No text content was recorded.'}</p>}
                  {item.resultDetail && <div className="workbench-detail-result">
                    <div className="workbench-detail-label">Result</div>
                    <p className="workbench-detail-text">{item.resultDetail.content.replace(/^<\s*/, '')}</p>
                  </div>}
                  </div>
                </div>}
              </article>
            )
          })}
        </div>
      ) : items.length > 0 ? (
        <div className="workbench-empty-message"><p>No activity matches “{query}”.</p><button type="button" onClick={() => setQuery('')}>Clear search</button></div>
      ) : (
        <div className="workbench-empty-message">
          <p>{isMockData ? 'Demo replay is starting.' : !hasSessions ? 'No observed session is available.' : !hasSelectedSession ? 'Select an observed session above to load its event history.' : displayedSession ? 'No activity has been observed in this session yet.' : 'No activity has been observed in this session yet.'}</p>
          {!hasSessions && !isMockData && <button type="button" onClick={onOpenLocalChat}>Open local chat</button>}
        </div>
      )}
    </main>
  )
}
