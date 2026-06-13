import { RADAR_STATS } from './constants'
import { toPer90 } from './per90'

/**
 * Normalise a per-90 value to a 0-100 scale given a known max.
 */
function normalise(value, max) {
  return Math.min(100, Math.round((value / max) * 100))
}

/**
 * Build the data array expected by Recharts RadarChart for two players.
 * Each entry: { stat, playerA, playerB }
 */
export function buildRadarData(playerA, playerB) {
  const rawScaleKeys = new Set(['passAccuracy', 'defensiveWorkrate', 'shotConversion'])

  return RADAR_STATS.map(({ key, label, max }) => {
    const valA = rawScaleKeys.has(key)
      ? (playerA.stats[key] ?? 0)
      : (toPer90(playerA.stats[key] ?? 0, playerA.stats.minutesPlayed) ?? 0)
    const valB = rawScaleKeys.has(key)
      ? (playerB.stats[key] ?? 0)
      : (toPer90(playerB.stats[key] ?? 0, playerB.stats.minutesPlayed) ?? 0)

    return {
      stat: label,
      [playerA.name]: normalise(valA, max),
      [playerB.name]: normalise(valB, max),
    }
  })
}
