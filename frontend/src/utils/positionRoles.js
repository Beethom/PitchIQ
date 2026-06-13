export function positionFamily(position) {
  if (position === 'GK') return 'Goalkeepers'
  if (['CB', 'LB', 'RB'].includes(position)) return 'Defenders'
  if (['CDM', 'CM', 'CAM'].includes(position)) return 'Midfielders'
  return 'Attackers'
}

export function benchmarkRole(position) {
  if (position === 'GK') return 'Goalkeepers'
  if (position === 'CB') return 'Centre Backs'
  if (['LB', 'RB'].includes(position)) return 'Fullbacks'
  if (['CDM', 'CM'].includes(position)) return 'Central Midfielders'
  if (position === 'CAM') return 'Attacking Midfielders'
  if (['LW', 'RW'].includes(position)) return 'Wingers'
  if (position === 'ST') return 'Strikers'
  return positionFamily(position)
}
