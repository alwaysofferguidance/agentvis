import type { SimulationState } from './types'
import { createEmptyState } from './types'

/** Reset visuals and replay retained live history; mock history comes from its scenario. */
export function createRestartReplayState(previous: SimulationState, useMockData: boolean): SimulationState {
  return createEmptyState({
    isPlaying: true,
    speed: previous.speed,
    eventLog: useMockData ? [] : previous.eventLog,
    maxTimeReached: useMockData ? 0 : previous.maxTimeReached,
    eventIndex: 0,
  })
}
