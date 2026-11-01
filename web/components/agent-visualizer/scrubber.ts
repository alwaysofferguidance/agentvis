/** Convert a pointer position on a timeline track into a clamped playback time. */
export function timeAtClientX(clientX: number, left: number, width: number, duration: number): number | null {
  if (!Number.isFinite(clientX) || !Number.isFinite(left) || !Number.isFinite(width)
    || !Number.isFinite(duration) || width <= 0 || duration < 0) return null
  const ratio = Math.max(0, Math.min(1, (clientX - left) / width))
  return ratio * duration
}

/** Compute an accessible keyboard seek, or null when the key is unrelated. */
export function timeForSeekKey(key: string, currentTime: number, duration: number, stepSeconds = 5): number | null {
  if (!Number.isFinite(currentTime) || !Number.isFinite(duration) || duration < 0) return null
  if (key === 'Home') return 0
  if (key === 'End') return duration
  const step = Number.isFinite(stepSeconds) && stepSeconds > 0 ? stepSeconds : 5
  if (key === 'ArrowLeft' || key === 'ArrowDown') return Math.max(0, Math.min(duration, currentTime - step))
  if (key === 'ArrowRight' || key === 'ArrowUp') return Math.max(0, Math.min(duration, currentTime + step))
  return null
}
