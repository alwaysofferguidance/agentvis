import type { TimelineEvent } from './agent-types'
import type { ConversationMessage } from '../hooks/simulation/types'

export function buildTimelineEvents(conversations: Map<string, ConversationMessage[]>): TimelineEvent[] {
  return Array.from(conversations, ([nodeId, messages]) => messages.map(message => ({
    id: `${nodeId}:${message.id}`,
    type: message.type === 'tool_call' ? 'tool_call' as const : message.type === 'tool_result' ? 'tool_result' as const : message.type === 'thinking' ? 'thinking' as const : 'message' as const,
    label: message.content.slice(0, 20), timestamp: message.timestamp, nodeId,
  }))).flat().sort((a, b) => a.timestamp - b.timestamp)
}
