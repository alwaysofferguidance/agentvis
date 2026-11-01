import { test } from 'node:test'
import assert from 'node:assert/strict'
import { appendPausedEvents } from '../web/hooks/simulation/paused-events'
import { createEmptyState, MAX_EVENT_LOG } from '../web/hooks/simulation/types'
import type { SimulationEvent } from '../web/lib/agent-types'

const spawnEvent: SimulationEvent = { time: 8, type: 'agent_spawn', payload: { name: 'worker' } }

test('paused live events extend replay history without changing the paused visual state', () => {
  const previous = createEmptyState({ currentTime: 4, maxTimeReached: 7, isPlaying: false, eventIndex: 1 })

  const next = appendPausedEvents(previous, [spawnEvent])

  assert.equal(next.currentTime, 4)
  assert.equal(next.maxTimeReached, 8)
  assert.equal(next.isPlaying, false)
  assert.equal(next.eventIndex, 1)
  assert.deepEqual(next.eventLog, [spawnEvent])
  assert.equal(next.agents, previous.agents)
  assert.equal(next.conversations, previous.conversations)
})

test('paused live event history remains bounded', () => {
  const previous = createEmptyState({ eventLog: Array.from({ length: MAX_EVENT_LOG }, (_, time) => ({
    time, type: 'message' as const, payload: { agent: 'worker', content: String(time) },
  })), eventIndex: MAX_EVENT_LOG })

  const next = appendPausedEvents(previous, [spawnEvent])

  assert.equal(next.eventLog.length, MAX_EVENT_LOG)
  assert.equal(next.eventLog.at(-1), spawnEvent)
  assert.equal(next.eventLog[0].time, 1)
  assert.equal(next.eventIndex, MAX_EVENT_LOG - 1)
})
