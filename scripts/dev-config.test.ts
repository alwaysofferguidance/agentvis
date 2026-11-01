import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { getRelayPort } from './dev-config.js'

test('uses the default relay port and accepts a valid override', () => {
  assert.equal(getRelayPort(undefined), 3001)
  assert.equal(getRelayPort('3002'), 3002)
  assert.equal(getRelayPort('65535'), 65535)
})

test('rejects invalid relay port overrides with a clear error', () => {
  for (const value of ['0', '65536', '3001.5', 'abc']) {
    assert.throws(() => getRelayPort(value), /AGENT_FLOW_RELAY_PORT must be an integer between 1 and 65535/)
  }
  assert.throws(() => getRelayPort(''), /AGENT_FLOW_RELAY_PORT must be an integer between 1 and 65535/)
})
