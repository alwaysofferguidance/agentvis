import assert from 'node:assert/strict'
import test from 'node:test'
import { deriveActivityItems } from './activity-model'
import type { Agent, ToolCallNode } from '@/lib/agent-types'
import type { ConversationMessage } from '@/hooks/simulation/types'

const messages = (items: Partial<ConversationMessage>[]): ConversationMessage[] => items.map((item, i) => ({
  id: item.id ?? `m${i}`,
  type: item.type ?? 'assistant',
  content: item.content ?? '',
  timestamp: item.timestamp ?? i,
  toolName: item.toolName,
  inputData: item.inputData,
}))

test('groups a tool call with its matching result and keeps action, target, status, and result', () => {
  const record = new Map([['agent-1', messages([
    { id: 'call', type: 'tool_call', toolName: 'Read', content: '> Read src/app.ts', timestamp: 2, inputData: { file_path: 'src/app.ts' } },
    { id: 'result', type: 'tool_result', toolName: 'Read', content: '< 42 lines', timestamp: 3 },
  ])]])
  const agents = new Map([['agent-1', { id: 'agent-1', name: 'Indexer' } as Agent]])
  const items = deriveActivityItems(record, agents, new Map())
  assert.equal(items.length, 1)
  assert.deepEqual(
    { action: items[0].action, target: items[0].target, status: items[0].status, result: items[0].result },
    { action: 'Read file', target: 'src/app.ts', status: 'Returned', result: '42 lines' },
  )
  assert.equal(items[0].agentName, 'Indexer')
  assert.equal(items[0].resultDetail?.id, 'result')
})

test('leaves a running call open and sorts activity across agents by observed time', () => {
  const record = new Map([
    ['agent-1', messages([{ id: 'call', type: 'tool_call', toolName: 'Bash', content: '> npm test', timestamp: 4 }])],
    ['agent-2', messages([{ id: 'input', type: 'user', content: 'Fix the failing test', timestamp: 1 }])],
  ])
  const toolCalls = new Map([['running', { agentId: 'agent-1', toolName: 'Bash', state: 'running', startTime: 4 } as ToolCallNode]])
  const items = deriveActivityItems(record, new Map(), toolCalls)
  assert.deepEqual(items.map(item => item.id), ['agent-2:input', 'agent-1:call'])
  assert.equal(items[1].status, 'Running')
  assert.equal(items[1].result, 'In progress')
})

test('returns no invented activity for an empty session and preserves unmatched results', () => {
  assert.deepEqual(deriveActivityItems(new Map(), new Map(), new Map()), [])
  const items = deriveActivityItems(new Map([['agent', messages([
    { id: 'result', type: 'tool_result', toolName: 'Grep', content: '< 3 matches', timestamp: 5 },
  ])]]), new Map(), new Map())
  assert.equal(items[0].action, 'Tool result')
  assert.equal(items[0].result, '3 matches')
})

test('keeps concurrent same-tool calls and out-of-order outputs separate, and labels exec scripts plainly', () => {
  const record = new Map([['agent', messages([
    { id: 'call-a', type: 'tool_call', toolName: 'exec_command', content: '{"command":"node a.js"}', timestamp: 1, inputData: { command: 'node a.js' } },
    { id: 'call-b', type: 'tool_call', toolName: 'exec_command', content: '{"command":"node b.js"}', timestamp: 2, inputData: { command: 'node b.js' } },
    { id: 'result-b', type: 'tool_result', toolName: 'exec_command', content: '{"output":"B"}', timestamp: 3 },
    { id: 'result-a', type: 'tool_result', toolName: 'exec_command', content: '{"output":"A"}', timestamp: 4 },
  ])]])
  const items = deriveActivityItems(record, new Map(), new Map())
  assert.equal(items.filter(item => item.detail.type === 'tool_call').length, 2)
  assert.equal(items.filter(item => item.detail.type === 'tool_result').length, 2)
  assert.equal(items[0].action, 'Run script')
  assert.equal(items[0].target, 'node a.js')
  assert.equal(items[0].result, 'Concurrent calls; results are shown separately.')
  assert.equal(items[2].result, 'Structured output · inspect details')
  assert.equal(items[2].resultDetail, undefined)
})
