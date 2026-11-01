import { test } from 'node:test'
import assert from 'node:assert/strict'
import { timeAtClientX, timeForSeekKey } from '../web/components/agent-visualizer/scrubber'

test('maps pointer position to playback time and clamps both ends', () => {
  assert.equal(timeAtClientX(150, 100, 200, 80), 20)
  assert.equal(timeAtClientX(50, 100, 200, 80), 0)
  assert.equal(timeAtClientX(400, 100, 200, 80), 80)
})

test('returns no seek time for unusable track geometry or duration', () => {
  assert.equal(timeAtClientX(100, 100, 0, 80), null)
  assert.equal(timeAtClientX(100, 100, 20, -1), null)
  assert.equal(timeAtClientX(Number.NaN, 100, 20, 80), null)
})

test('keyboard seek supports fixed increments and timeline endpoints', () => {
  assert.equal(timeForSeekKey('ArrowRight', 10, 20), 15)
  assert.equal(timeForSeekKey('ArrowLeft', 2, 20), 0)
  assert.equal(timeForSeekKey('Home', 10, 20), 0)
  assert.equal(timeForSeekKey('End', 10, 20), 20)
  assert.equal(timeForSeekKey('Tab', 10, 20), null)
})
