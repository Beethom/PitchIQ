/**
 * Convert a raw accumulative stat to a per-90-minute rate.
 * Returns null if minutesPlayed is 0 or missing.
 */
export function toPer90(value, minutesPlayed) {
  if (!minutesPlayed || minutesPlayed === 0) return null
  return (value / minutesPlayed) * 90
}

/**
 * Build a per-90 version of a player's stats object.
 * Percentage stats (passAccuracy, dribbleSuccess) are left as-is.
 */
export function buildPer90Stats(stats) {
  const RATE_KEYS = new Set(['passAccuracy', 'dribbleSuccess', 'shotConversion', 'defensiveWorkrate'])

  return Object.fromEntries(
    Object.entries(stats).map(([key, value]) => {
      if (RATE_KEYS.has(key) || key === 'minutesPlayed' || key === 'appearances') {
        return [key, value]
      }
      return [key, toPer90(value, stats.minutesPlayed)]
    }),
  )
}
