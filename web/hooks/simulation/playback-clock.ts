/** Whether the throttled React playback clock should be refreshed this frame. */
export function shouldPublishPlaybackClock(timestamp: number, lastUpdate: number, throttleMs: number): boolean {
  return lastUpdate === 0 || timestamp - lastUpdate >= throttleMs
}
