'use strict'

const DEFAULT_RELAY_PORT = 3001

function getRelayPort(value) {
  if (value === undefined) return DEFAULT_RELAY_PORT
  if (!/^\d+$/.test(value)) {
    throw new Error('AGENT_FLOW_RELAY_PORT must be an integer between 1 and 65535')
  }
  const port = Number(value)
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error('AGENT_FLOW_RELAY_PORT must be an integer between 1 and 65535')
  }
  return port
}

module.exports = { getRelayPort }
