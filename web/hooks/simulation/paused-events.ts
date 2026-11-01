import type { SimulationEvent } from '@/lib/agent-types'
import type { SimulationState } from './types'
import { MAX_EVENT_LOG } from './types'

/** Store incoming live events for later replay without applying them to visuals. */
export function appendPausedEvents(state: SimulationState, events: readonly SimulationEvent[]): SimulationState {
  if (events.length === 0) return state
  const eventLog = state.eventLog.concat(events)
  const droppedEvents = Math.max(0, eventLog.length - MAX_EVENT_LOG)
  const newestTime = events.reduce((maxTime, event) =>
    Number.isFinite(event.time) ? Math.max(maxTime, event.time) : maxTime,
  state.maxTimeReached)

  return {
    ...state,
    eventLog: droppedEvents > 0 ? eventLog.slice(droppedEvents) : eventLog,
    eventIndex: Math.max(0, state.eventIndex - droppedEvents),
    maxTimeReached: newestTime,
  }
}
