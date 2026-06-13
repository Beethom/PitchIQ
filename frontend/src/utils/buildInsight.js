import { toPer90 } from './per90'

function averageRating(form) {
  return form.reduce((sum, f) => sum + f.rating, 0) / form.length
}

/**
 * Returns structured insight comparing two players.
 * Includes per-90 scoring, chance creation, form, and goal-xG overperformance.
 */
export function buildInsight(playerA, playerB) {
  const aGoalsPer90 = toPer90(playerA.stats.goals, playerA.stats.minutesPlayed)
  const bGoalsPer90 = toPer90(playerB.stats.goals, playerB.stats.minutesPlayed)
  const aKPPer90   = toPer90(playerA.stats.chancesCreated, playerA.stats.minutesPlayed)
  const bKPPer90   = toPer90(playerB.stats.chancesCreated, playerB.stats.minutesPlayed)
  const aForm      = averageRating(playerA.form)
  const bForm      = averageRating(playerB.form)
  const aDefWork   = playerA.stats.defensiveWorkrate ?? 0
  const bDefWork   = playerB.stats.defensiveWorkrate ?? 0
  const aConversion = playerA.stats.shotConversion ?? 0
  const bConversion = playerB.stats.shotConversion ?? 0

  const aOverperf  = (playerA.stats.goals - playerA.stats.xG).toFixed(1)
  const bOverperf  = (playerB.stats.goals - playerB.stats.xG).toFixed(1)

  const betterScorer  = aGoalsPer90 >= bGoalsPer90 ? playerA.name : playerB.name
  const betterCreator = aKPPer90   >= bKPPer90    ? playerA.name : playerB.name
  const betterForm    = aForm      >= bForm        ? playerA.name : playerB.name
  const betterDefender = aDefWork >= bDefWork ? playerA.name : playerB.name
  const betterConverter = aConversion >= bConversion ? playerA.name : playerB.name

  const overLabel = (name, val) =>
    Number(val) >= 0 ? `${name} is overperforming xG by +${val}` : `${name} is underperforming xG by ${val}`

  // Stat-by-stat leader list (for badge display)
  const INSIGHT_STATS = [
    { key: 'goals',          label: 'goals',       higherIsBetter: true  },
    { key: 'assists',        label: 'assists',      higherIsBetter: true  },
    { key: 'goalContributions', label: 'goal contributions', higherIsBetter: true },
    { key: 'shots',          label: 'shots',        higherIsBetter: true  },
    { key: 'passAccuracy',   label: 'pass accuracy',higherIsBetter: true  },
    { key: 'dribbles',       label: 'dribbles',     higherIsBetter: true  },
    { key: 'tackles',        label: 'tackles',      higherIsBetter: true  },
    { key: 'chancesCreated', label: 'chances created', higherIsBetter: true  },
    { key: 'bigChancesCreated', label: 'big chances created', higherIsBetter: true  },
    { key: 'progressivePasses', label: 'progressive passes', higherIsBetter: true  },
    { key: 'aerialDuelsWon', label: 'aerial duels', higherIsBetter: true  },
    { key: 'shotConversion', label: 'shot conversion', higherIsBetter: true  },
    { key: 'defensiveWorkrate', label: 'defensive work rate', higherIsBetter: true  },
    { key: 'yellowCards',    label: 'yellow cards', higherIsBetter: false },
    { key: 'possessionLost', label: 'ball security', higherIsBetter: false },
  ]

  const leadsA = []
  const leadsB = []

  for (const { key, label, higherIsBetter } of INSIGHT_STATS) {
    const valA = playerA.stats[key] ?? 0
    const valB = playerB.stats[key] ?? 0
    if (valA === valB) continue
    const aWins = higherIsBetter ? valA > valB : valA < valB
    if (aWins) leadsA.push(label)
    else leadsB.push(label)
  }

  const formatLeads = (name, items) => {
    if (!items.length) return null
    if (items.length === 1) return `${name} leads in ${items[0]}.`
    return `${name} leads in ${items.slice(0, -1).join(', ')} and ${items.at(-1)}.`
  }

  return {
    narrative: `${betterScorer} has the stronger scoring output per 90. ${betterCreator} creates more chances. ${betterConverter} is finishing chances more efficiently. ${betterDefender} brings the stronger defensive work rate. ${betterForm} has better recent form. ${overLabel(playerA.name, aOverperf)}; ${overLabel(playerB.name, bOverperf)}.`,
    summaryA: formatLeads(playerA.name, leadsA),
    summaryB: formatLeads(playerB.name, leadsB),
    leadsA,
    leadsB,
  }
}
