export function flagEmoji(code) {
  if (!code || code.length !== 2) return ''
  const upper = code.toUpperCase()
  if (!/^[A-Z]{2}$/.test(upper)) return ''
  return String.fromCodePoint(...[...upper].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
}

function n(value) {
  return Math.round(Number(value) || 0)
}

// Build an emoji-formatted, shareable performance caption from scoped stats.
// Medals mark genuinely standout numbers (gold = elite, silver = very good).
export function buildPerformanceCaption(player) {
  const s = player.stats ?? {}
  const pos = player.position
  const isGk = pos === 'GK'
  const isDef = ['CB', 'LB', 'RB'].includes(pos)
  const medal = (v, gold, silver) => (v >= gold ? ' 🥇' : v >= silver ? ' 🥈' : '')
  const lines = []
  const add = (emoji, text, m = '') => lines.push(`${emoji} ${text}${m}`)

  const passVol = (s.totalPasses ?? 0) >= 20
  const dribAtt = s.dribblesAttempted ?? s._totalDribbles ?? s.dribbles ?? 0

  // Goals & assists lead for ANY position (a defender/keeper who scores still
  // gets the headline).
  if ((s.goals ?? 0) > 0) add('⚽', `${n(s.goals)} goal${n(s.goals) > 1 ? 's' : ''}`, medal(n(s.goals), 2, 1))
  if ((s.assists ?? 0) > 0) add('🅰️', `${n(s.assists)} assist${n(s.assists) > 1 ? 's' : ''}`, medal(n(s.assists), 2, 1))

  if (isGk) {
    const savePct = s.totalShotsFaced ? ((s.saves ?? 0) / s.totalShotsFaced) * 100 : null
    if ((s.saves ?? 0) > 0) add('🧤', `${n(s.saves)} saves`, medal(n(s.saves), 5, 3))
    if (savePct != null) add('🛑', `${savePct.toFixed(0)}% save accuracy`, medal(savePct, 85, 70))
    if ((s.cleanSheets ?? 0) >= 1) add('🥅', 'clean sheet', ' 🥇')
    else if ((s.goalsConceded ?? 0) >= 0) add('🥅', `${n(s.goalsConceded)} conceded`)
    if ((s.highClaims ?? 0) > 0) add('🙌', `${n(s.highClaims)} high claims`)
    if ((s.runOuts ?? 0) > 0) add('🧹', `${n(s.runOuts)} run-outs`)
    if (passVol) add('👟', `${n(s.passAccuracy)}% pass accuracy`, medal(n(s.passAccuracy), 88, 82))
  } else if (isDef) {
    const defActions = n(s.tackles) + n(s.interceptions) + n(s.clearances)
    if (defActions > 0) add('🛡️', `${defActions} defensive actions`, medal(defActions, 12, 8))
    if ((s.tackles ?? 0) > 0) add('👍', `${n(s.tackles)} tackles`, medal(n(s.tackles), 4, 3))
    if ((s.interceptions ?? 0) > 0) add('🧰', `${n(s.interceptions)} interceptions`, medal(n(s.interceptions), 3, 2))
    if ((s.clearances ?? 0) > 0) add('🧱', `${n(s.clearances)} clearances`, medal(n(s.clearances), 5, 3))
    if ((s.recoveries ?? 0) > 0) add('💪', `${n(s.recoveries)} recoveries`, medal(n(s.recoveries), 8, 6))
    if ((s.aerialDuelsWon ?? 0) > 0) add('🏅', `${n(s.aerialDuelsWon)} duels won`, medal(n(s.aerialDuelsWon), 6, 4))
    if ((s.chancesCreated ?? 0) > 0) add('😮', `${n(s.chancesCreated)} chances created`)
  } else {
    if ((s.chancesCreated ?? 0) > 0) add('😳', `${n(s.chancesCreated)} chances created`, medal(n(s.chancesCreated), 4, 3))
    if ((s.bigChancesCreated ?? 0) > 0) add('😮', `${n(s.bigChancesCreated)} big chance${n(s.bigChancesCreated) > 1 ? 's' : ''} created`, medal(n(s.bigChancesCreated), 2, 1))
    if ((s.dribbles ?? 0) > 0) add('💨', `${n(s.dribbles)}/${n(dribAtt)} successful dribbles`, (n(s.dribbles) >= 3 && n(s.dribbles) === n(dribAtt)) ? ' 🥇' : (n(s.dribbles) >= 3 ? ' 🥈' : ''))
    if ((s.recoveries ?? 0) > 0) add('💪', `${n(s.recoveries)} recoveries`, medal(n(s.recoveries), 8, 6))
    if ((s.aerialDuelsWon ?? 0) > 0) add('⚔️', `${n(s.aerialDuelsWon)} duels won`, medal(n(s.aerialDuelsWon), 6, 4))
  }

  // Distribution — added for any role when the numbers are genuinely notable.
  if (!isGk) {
    if (n(s.totalPasses) >= 50) add('🔄', `${n(s._accuratePasses)}/${n(s.totalPasses)} passes (${n(s.passAccuracy)}%)`, n(s.passAccuracy) >= 90 && n(s.totalPasses) >= 60 ? ' 🥇' : '')
    if (n(s.progressivePasses) >= 5) add('📈', `${n(s.progressivePasses)} progressive passes`, medal(n(s.progressivePasses), 10, 6))
    if (n(s.finalThirdPasses) >= 8) add('🎯', `${n(s.finalThirdPasses)} passes into the final third`, medal(n(s.finalThirdPasses), 14, 10))
  }

  const rating = Number(s.rating) || 0
  if (rating > 0) add('⭐️', `${rating.toFixed(1)} match rating`, medal(rating, 8.5, 7.8))

  const verdict = (() => {
    if (rating >= 8.5) return isGk ? 'Wall in goal! 🧤' : isDef ? 'Rock at the back! 🧱' : pos.includes('M') ? 'Midfield maestro! ❤️' : 'Unplayable! 🔥'
    if (rating >= 7.5) return 'Standout! 🔥'
    if (rating >= 7) return 'Solid shift 💪'
    if (rating >= 6.5) return 'Steady day ✅'
    return rating > 0 ? 'Quiet game.' : ''
  })()

  const scope = player.selected_competition
  const flag = flagEmoji(player.flag_code)
  let header
  if (scope && scope.startsWith('vs ')) header = `${flag} ${player.name} 🆚 ${scope.slice(3)}:`
  else if (scope && scope !== 'All Competitions') header = `${flag} ${player.name} — ${scope}:`
  else header = `${flag} ${player.name}:`

  const body = lines.join('\n')
  const text = `${header}\n\n${body}${verdict ? `\n\n${verdict}` : ''}`
  return { header, lines, verdict, text }
}
