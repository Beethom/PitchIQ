/**
 * Format a raw stat value for display.
 * Keys ending in "Accuracy" or "Success" are shown as percentages.
 */
export function formatStat(key, value) {
  if (value === null || value === undefined) return '—'

  if (['passAccuracy', 'dribbleSuccess', 'shotConversion', 'crossAccuracy'].includes(key)) {
    return `${value.toFixed(1)}%`
  }

  if (key === 'xG' || key === 'xA') {
    return value.toFixed(2)
  }

  if (key === 'defensiveWorkrate' || key === 'defensiveContribution') {
    return `${Math.round(value)}/100`
  }

  if (key === 'defensiveIntensity') {
    return value.toFixed(2)
  }

  if (key === 'avgTeamPossession') {
    return `${value.toFixed(1)}%`
  }

  // Whole-number stats
  if (Number.isInteger(value)) return value.toString()

  return value.toFixed(1)
}
