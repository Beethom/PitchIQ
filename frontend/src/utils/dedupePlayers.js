function normalizeText(value = '') {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function canonicalName(value = '') {
  return normalizeText(value)
    .replace(/\bjunior\b/g, 'jr')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function identityKey(player) {
  return [
    canonicalName(player.name),
    normalizeText(player.nationality),
    normalizeText(player.club),
  ].join('|')
}

function scorePlayer(player) {
  const season = String(player.season ?? '')
  const appearances = Number(player.stats?.appearances ?? 0)
  const minutes = Number(player.stats?.minutesPlayed ?? 0)
  const isAggregate = player.league === 'All Competitions' ? 1 : 0
  return [isAggregate, season, appearances, minutes, -Number(player.id ?? 0)]
}

function isBetterCandidate(candidate, current) {
  const a = scorePlayer(candidate)
  const b = scorePlayer(current)
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] > b[index]) return true
    if (a[index] < b[index]) return false
  }
  return false
}

export function dedupePlayers(players = []) {
  const grouped = new Map()

  for (const player of players) {
    const key = identityKey(player)
    const existing = grouped.get(key)
    if (!existing || isBetterCandidate(player, existing)) {
      grouped.set(key, player)
    }
  }

  return [...grouped.values()]
}
