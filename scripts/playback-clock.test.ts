import { test } from 'node:test'
import assert from 'node:assert/strict'
import { shouldPublishPlaybackClock } from '../web/hooks/simulation/playback-clock'
import { createRestartReplayState } from '../web/hooks/simulation/restart-replay-state'
import { createEmptyState } from '../web/hooks/simulation/types'

test('publishes the clock on its first frame and at the throttle interval', () => {
  assert.equal(shouldPublishPlaybackClock(16, 0, 250), true)
  assert.equal(shouldPublishPlaybackClock(249, 16, 250), false)
  assert.equal(shouldPublishPlaybackClock(266, 16, 250), true)
})

test('restart replay clears visuals and replays the retained live event log from index zero', () => {
  const eventLog = [{ time: 2, type: 'agent_spawn' as const, payload: { name: 'worker' } }]
  const previous = createEmptyState({
    currentTime: 12,
    isPlaying: false,
    speed: 2,
    eventIndex: 1,
    eventLog,
    maxTimeReached: 12,
  })

  const restarted = createRestartReplayState(previous, false)

  assert.equal(restarted.isPlaying, true)
  assert.equal(restarted.currentTime, 0)
  assert.equal(restarted.speed, 2)
  assert.equal(restarted.eventIndex, 0)
  assert.equal(restarted.maxTimeReached, 12)
  assert.equal(restarted.eventLog, eventLog)
  assert.equal(restarted.agents.size, 0)
})

test('mock restart relies on the canonical scenario and does not duplicate its old event log', () => {
  const previous = createEmptyState({ eventLog: [{ time: 2, type: 'agent_spawn', payload: { name: 'worker' } }] })
  const restarted = createRestartReplayState(previous, true)

  assert.equal(restarted.eventIndex, 0)
  assert.deepEqual(restarted.eventLog, [])
})
