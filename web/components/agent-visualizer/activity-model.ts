import type { Agent, ToolCallNode } from '@/lib/agent-types'
import type { ConversationMessage } from '@/hooks/simulation/types'

export interface ActivityItem {
  id: string
  timestamp: number
  agentId: string
  agentName: string
  action: string
  target: string
  status: 'Observed' | 'Called' | 'Running' | 'Returned' | 'Error'
  result: string
  detail: ConversationMessage
  resultDetail?: ConversationMessage
}

function toolTarget(message: ConversationMessage): string {
  const data = message.inputData
  if (data) {
    for (const key of ['file_path', 'path', 'url', 'command', 'query', 'description']) {
      const value = data[key]
      if (typeof value === 'string' && value.trim()) return value.trim()
    }
  }
  if (message.toolName?.toLowerCase().includes('exec')) return ''
  const raw = message.content.replace(/^>\s*/, '').trim()
  const name = message.toolName?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const summary = name ? raw.replace(new RegExp(`^${name}(?:\\s*[:-]\\s*|\\s+)`, 'i'), '') : raw
  return summary || 'Tool input'
}

function resultSummary(message: ConversationMessage): string {
  const value = message.content.replace(/^<\s*/, '').replace(/\s+\(\d+ tokens\)$/, '').trim()
  if (/^[{[]/.test(value)) {
    try {
      JSON.parse(value)
      return 'Structured output · inspect details'
    } catch { /* Keep ordinary prose that happens to start with a bracket. */ }
  }
  return value.replace(/\s+/g, ' ').slice(0, 180)
}

function toolAction(toolName: string | undefined): string {
  switch (toolName) {
    case 'Read': return 'Read file'
    case 'Write': return 'Write file'
    case 'Edit': return 'Edit file'
    case 'Bash': return 'Run command'
    case 'Glob': return 'Find files'
    case 'Grep': return 'Search content'
    case 'WebSearch': return 'Search the web'
    case 'WebFetch': return 'Read web page'
    case 'TodoWrite': return 'Update task list'
    default:
      return toolName?.toLowerCase().includes('exec') ? 'Run script' : toolName || 'Use tool'
  }
}

/** Turns the retained per-agent conversation record into a chronological activity ledger. */
export function deriveActivityItems(
  conversations: Map<string, ConversationMessage[]>,
  agents: Map<string, Agent>,
  toolCalls: Map<string, ToolCallNode>,
): ActivityItem[] {
  const items: ActivityItem[] = []
  for (const [agentId, messages] of conversations) {
    const agent = agents.get(agentId)
    const agentName = agent?.isMain ? 'Main agent' : agent?.name ?? agentId
    const ordered = [...messages].sort((a, b) => a.timestamp - b.timestamp)
    const pendingCalls = new Map<string, ActivityItem[]>()
    const ambiguousTools = new Set<string>()
    for (const message of ordered) {
      if (message.type === 'tool_call') {
        const nearbyCalls = Array.from(toolCalls.values()).filter(call =>
          call.agentId === agentId && call.toolName === message.toolName && Math.abs(call.startTime - message.timestamp) <= 1,
        )
        const liveCall = nearbyCalls.length === 1 ? nearbyCalls[0] : undefined
        const status: ActivityItem['status'] = liveCall?.state === 'error' ? 'Error'
          : liveCall?.state === 'running' ? 'Running' : 'Called'
        const item: ActivityItem = {
          id: `${agentId}:${message.id}`,
          timestamp: message.timestamp,
          agentId,
          agentName,
          action: toolAction(message.toolName),
          target: toolTarget(message),
          status,
          result: status === 'Error' ? liveCall?.errorMessage || 'Tool failed'
            : status === 'Running' ? 'In progress' : 'No result in retained history',
          detail: message,
        }
        items.push(item)
        const key = message.toolName || ''
        const queue = pendingCalls.get(key) ?? []
        queue.push(item)
        pendingCalls.set(key, queue)
        if (queue.length > 1) {
          ambiguousTools.add(key)
          for (const call of queue) call.result = 'Concurrent calls; results are shown separately.'
        }
        continue
      }

      if (message.type === 'tool_result') {
        const key = message.toolName || ''
        const queue = pendingCalls.get(key) ?? []
        if (queue.length === 1 && !ambiguousTools.has(key)) {
          const call = queue[0]
          call.result = resultSummary(message)
          call.resultDetail = message
          if (call.status !== 'Error') call.status = 'Returned'
          pendingCalls.delete(key)
          continue
        }
        if (queue.length > 1) {
          ambiguousTools.add(key)
          for (const call of queue) call.result = 'Concurrent calls; results are shown separately.'
          pendingCalls.delete(key)
        }
        items.push({
          id: `${agentId}:${message.id}`,
          timestamp: message.timestamp,
          agentId,
          agentName,
          action: 'Tool result',
          target: message.toolName || '',
          status: 'Observed',
          result: resultSummary(message),
          detail: message,
        })
        continue
      }

      const action = message.type === 'user' ? 'User' : message.type === 'thinking' ? 'Reasoning' : 'Assistant'
      items.push({
        id: `${agentId}:${message.id}`,
        timestamp: message.timestamp,
        agentId,
        agentName,
        action,
        target: '',
        status: 'Observed',
        result: message.content,
        detail: message,
      })
    }
  }
  return items.sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id))
}
