import { localMediaUrl } from './mediaUrl'
import { playerService } from '../services/playerService'
import { enrichPlayers } from './playerMetrics'
import { benchmarkRole } from './positionRoles'
import { buildPerformanceCaption } from './performanceCaption'

const WIDTH = 1080
const SCALE = 2

const PERCENTILE_METRICS = [
  { key: 'goalsP90', label: 'Goals / 90' },
  { key: 'assistsP90', label: 'Assists / 90' },
  { key: 'shotsP90', label: 'Shots / 90' },
  { key: 'xgP90', label: 'xG / 90' },
  { key: 'touchesPerMatch', label: 'Touches / Match' },
  { key: 'dribbleSuccess', label: 'Dribble Success' },
  { key: 'passAccuracy', label: 'Pass Accuracy' },
  { key: 'possessionLostPerMatch', label: 'Poss. Lost / Match', lowerBetter: true },
  { key: 'tacklesP90', label: 'Tackles / 90' },
  { key: 'interceptionsP90', label: 'Interceptions / 90' },
  { key: 'recoveriesP90', label: 'Recoveries / 90' },
]

function safeFileName(value = 'player-profile') {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80) || 'player-profile'
}

function formatNumber(value, decimals = 0) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '0'
  const number = Number(value)
  return decimals ? number.toFixed(decimals) : Math.round(number).toLocaleString()
}

function metricValue(value, decimals = 0) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  return formatNumber(value, decimals)
}

function toPer90(value, minutes) {
  if (!minutes) return null
  return (value / minutes) * 90
}

function playerGroup(player) {
  const league = player?.league ?? ''
  if (league === 'MLS') return 'mls'
  if (['UEFA Champions League', 'UEFA Europa League', 'UEFA Conference League'].includes(league)) return 'europe'
  if (/World Cup|Nations League|Gold Cup|Copa/.test(league)) return 'national'
  return 'leagues'
}

function measuredMetric(stats = {}, key) {
  switch (key) {
    case 'goalsP90':
      return toPer90(stats.goals ?? 0, stats.minutesPlayed)
    case 'assistsP90':
      return toPer90(stats.assists ?? 0, stats.minutesPlayed)
    case 'shotsP90':
      return toPer90(stats.shots ?? 0, stats.minutesPlayed)
    case 'xgP90':
      return toPer90(stats.xG ?? 0, stats.minutesPlayed)
    case 'tacklesP90':
      return toPer90(stats.tackles ?? 0, stats.minutesPlayed)
    case 'interceptionsP90':
      return toPer90(stats.interceptions ?? 0, stats.minutesPlayed)
    case 'recoveriesP90':
      return toPer90(stats.recoveries ?? 0, stats.minutesPlayed)
    default:
      return stats[key]
  }
}

function percentileFor(value, values) {
  const clean = values.filter((item) => Number.isFinite(item))
  if (!Number.isFinite(value) || clean.length < 8) return null
  const below = clean.filter((item) => item < value).length
  const equal = clean.filter((item) => item === value).length
  const percentile = Math.round(((below + equal / 2) / clean.length) * 100)
  return Math.max(1, Math.min(99, percentile))
}

function hasExactDefensiveData(stats = {}) {
  return (
    (stats.recoveries ?? 0)
    + (stats.successfulTackles ?? 0)
    + (stats.fouls ?? 0)
  ) > 0
}

function isComparableMetricValue(stats = {}, metric, value) {
  if (!Number.isFinite(value)) return false
  if (metric.key.endsWith('P90') && (stats.minutesPlayed ?? 0) <= 0) return false

  switch (metric.key) {
    case 'shotsP90':
    case 'xgP90':
      return (stats.shots ?? 0) >= 3
    case 'passAccuracy':
      return (stats.totalPasses ?? 0) >= 80
    case 'dribbleSuccess':
      return (stats.dribblesAttempted ?? stats._totalDribbles ?? stats.dribbles ?? 0) >= 8
    case 'tacklesP90':
    case 'interceptionsP90':
      return (stats.tackles ?? 0) + (stats.interceptions ?? 0) > 0 || hasExactDefensiveData(stats)
    case 'recoveriesP90':
      return (stats.recoveries ?? 0) > 0 || hasExactDefensiveData(stats)
    default:
      return true
  }
}

async function measuredPercentileRows(player) {
  try {
    const peers = enrichPlayers(await playerService.getAll({
      group: playerGroup(player),
      season: player.season,
      limit: 2000,
    })).filter((peer) => (
      benchmarkRole(peer.position) === benchmarkRole(player.position)
      && (peer.stats?.minutesPlayed ?? 0) >= 450
    ))

    return PERCENTILE_METRICS.map((metric) => {
      const value = measuredMetric(player.stats ?? {}, metric.key)
      if (!isComparableMetricValue(player.stats ?? {}, metric, value)) return null
      const peerValues = peers
        .map((peer) => {
          const peerStats = peer.stats ?? {}
          const peerValue = measuredMetric(peerStats, metric.key)
          if (metric.key === 'recoveriesP90') {
            return Number.isFinite(peerValue) && (peerStats.minutesPlayed ?? 0) > 0 ? peerValue : null
          }
          return isComparableMetricValue(peerStats, metric, peerValue) ? peerValue : null
        })
        .filter((item) => Number.isFinite(item))
      const percentile = metric.lowerBetter
        ? percentileFor(-value, peerValues.map((item) => -item))
        : percentileFor(value, peerValues)
      return { ...metric, value, percentile }
    }).filter((row) => row?.percentile != null).slice(0, 8)
  } catch {
    return []
  }
}

function drawRoundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
}

function fillRoundRect(ctx, x, y, width, height, radius, fillStyle) {
  drawRoundRect(ctx, x, y, width, height, radius)
  ctx.fillStyle = fillStyle
  ctx.fill()
}

function drawText(ctx, text, x, y, options = {}) {
  const {
    size = 32,
    weight = 600,
    color = '#0f172a',
    align = 'left',
    maxWidth,
  } = options
  ctx.font = `${weight} ${size}px Inter, Arial, sans-serif`
  ctx.fillStyle = color
  ctx.textAlign = align
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(String(text ?? ''), x, y, maxWidth)
}

function drawLabelValue(ctx, label, value, x, y, width, options = {}) {
  fillRoundRect(ctx, x, y, width, options.height ?? 128, 22, options.fill ?? '#f8fafc')
  drawText(ctx, value, x + 28, y + 55, {
    size: options.valueSize ?? 34,
    weight: 800,
    color: options.valueColor ?? '#0f172a',
    maxWidth: width - 56,
  })
  drawText(ctx, label, x + 28, y + 94, {
    size: 18,
    weight: 700,
    color: options.labelColor ?? '#64748b',
    maxWidth: width - 56,
  })
}

function drawPill(ctx, label, x, y, options = {}) {
  ctx.font = `${options.weight ?? 800} ${options.size ?? 18}px Inter, Arial, sans-serif`
  const width = Math.ceil(ctx.measureText(label).width) + 34
  fillRoundRect(ctx, x, y, width, options.height ?? 38, 18, options.fill ?? 'rgba(255,255,255,0.12)')
  drawText(ctx, label, x + 17, y + 25, {
    size: options.size ?? 18,
    weight: options.weight ?? 800,
    color: options.color ?? '#e0f2fe',
  })
  return width
}

function drawDivider(ctx, x, y, width, color = 'rgba(255,255,255,0.16)') {
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x + width, y)
  ctx.stroke()
}

// The 5 headline stats that best showcase a player, by position. Forwards/mids
// lead with production; defenders with defensive volume; keepers with shot-stopping.
function headlineTiles(stats = {}, position) {
  const isGk = position === 'GK'
  const isDef = ['CB', 'LB', 'RB'].includes(position)

  if (isGk) {
    const savePct = stats.totalShotsFaced ? ((stats.saves ?? 0) / stats.totalShotsFaced) * 100 : null
    return [
      { label: 'Saves', value: formatNumber(stats.saves), fill: '#eff6ff', valueColor: '#1d4ed8' },
      { label: 'Save %', value: savePct == null ? '—' : `${formatNumber(savePct, 1)}%`, fill: '#ecfdf5', valueColor: '#15803d' },
      { label: 'Clean Sheets', value: formatNumber(stats.cleanSheets), fill: '#f0f9ff', valueColor: '#0369a1' },
      { label: 'Conceded', value: formatNumber(stats.goalsConceded), fill: '#fff7ed', valueColor: '#c2410c' },
      { label: 'Shots Faced', value: formatNumber(stats.totalShotsFaced), fill: '#f5f3ff', valueColor: '#6d28d9', wide: true },
    ]
  }

  if (isDef) {
    return [
      { label: 'Tackles', value: formatNumber(stats.tackles), fill: '#eff6ff', valueColor: '#1d4ed8' },
      { label: 'Interceptions', value: formatNumber(stats.interceptions), fill: '#ecfdf5', valueColor: '#15803d' },
      { label: 'Clearances', value: formatNumber(stats.clearances), fill: '#fff7ed', valueColor: '#c2410c' },
      { label: 'Recoveries', value: formatNumber(stats.recoveries), fill: '#f5f3ff', valueColor: '#6d28d9' },
      { label: 'Aerials Won', value: formatNumber(stats.aerialDuelsWon), fill: '#f0f9ff', valueColor: '#0369a1', wide: true },
    ]
  }

  return [
    { label: 'Goals', value: formatNumber(stats.goals), fill: '#eff6ff', valueColor: '#1d4ed8' },
    { label: 'Assists', value: formatNumber(stats.assists), fill: '#ecfdf5', valueColor: '#15803d' },
    { label: 'xG', value: metricValue(stats.xG, 2), fill: '#fff7ed', valueColor: '#c2410c' },
    { label: 'xA', value: metricValue(stats.xA, 2), fill: '#f5f3ff', valueColor: '#6d28d9' },
    { label: 'G+A / 90', value: metricValue(((stats.goalContributions ?? 0) / Math.max(stats.minutesPlayed ?? 0, 1)) * 90, 2), fill: '#f0f9ff', valueColor: '#0369a1', wide: true },
  ]
}

function drawMetricTile(ctx, label, value, x, y, width, options = {}) {
  fillRoundRect(ctx, x, y, width, 118, 24, options.fill ?? 'rgba(15,23,42,0.05)')
  drawText(ctx, value, x + 24, y + 50, {
    size: options.valueSize ?? 32,
    weight: 900,
    color: options.valueColor ?? '#0f172a',
    maxWidth: width - 48,
  })
  drawText(ctx, label, x + 24, y + 84, {
    size: 16,
    weight: 800,
    color: options.labelColor ?? '#64748b',
    maxWidth: width - 48,
  })
}

function drawStatLine(ctx, label, value, x, y, width, options = {}) {
  drawText(ctx, label, x, y, {
    size: 18,
    weight: 800,
    color: options.labelColor ?? '#64748b',
  })
  drawText(ctx, value, x + width, y, {
    size: options.size ?? 23,
    weight: 900,
    color: options.valueColor ?? '#0f172a',
    align: 'right',
  })
  drawDivider(ctx, x, y + 17, width, options.divider ?? '#e2e8f0')
}

function drawFormStrip(ctx, form = [], x, y, width) {
  drawText(ctx, 'Recent Form', x, y, { size: 22, weight: 900, color: '#0f172a' })
  const items = form.slice(0, 5)
  const gap = 12
  const itemWidth = (width - gap * 4) / 5

  if (!items.length) {
    drawText(ctx, 'No recent match ratings', x, y + 56, {
      size: 18,
      weight: 700,
      color: '#64748b',
    })
    return
  }

  items.forEach((item, index) => {
    const rating = Number(item.rating) || 0
    const fill = rating >= 8
      ? '#dcfce7'
      : rating >= 7
        ? '#e0f2fe'
        : rating >= 6.5
          ? '#fef3c7'
          : '#fee2e2'
    const color = rating >= 8
      ? '#166534'
      : rating >= 7
        ? '#0369a1'
        : rating >= 6.5
          ? '#92400e'
          : '#991b1b'
    const itemX = x + index * (itemWidth + gap)
    fillRoundRect(ctx, itemX, y + 28, itemWidth, 86, 20, fill)
    drawText(ctx, formatNumber(rating, 1), itemX + itemWidth / 2, y + 68, {
      size: 26,
      weight: 900,
      color,
      align: 'center',
    })
    drawText(ctx, `${item.goals ?? 0}G ${item.assists ?? 0}A`, itemX + itemWidth / 2, y + 96, {
      size: 15,
      weight: 800,
      color,
      align: 'center',
    })
  })
}

function percentileColor(percentile) {
  if (percentile >= 80) return '#168a2e'
  if (percentile >= 60) return '#7b970f'
  if (percentile >= 40) return '#c59a00'
  return '#f97316'
}

function drawPercentileBar(ctx, row, x, y, width) {
  const percentile = Math.max(1, Math.min(99, row.percentile ?? 0))
  const color = percentileColor(percentile)
  const isPercentage = row.key.includes('Accuracy') || row.key === 'dribbleSuccess'
  const rawValue = isPercentage
    ? `${metricValue(row.value, 1)}%`
    : metricValue(row.value, row.key.includes('P90') || row.key === 'xgP90' || row.key.includes('PerMatch') ? 2 : 0)
  drawText(ctx, `${row.label}: ${rawValue}`, x, y, {
    size: 17,
    weight: 800,
    color: '#111827',
    maxWidth: width,
  })
  fillRoundRect(ctx, x, y + 14, width, 13, 7, '#e5e7eb')
  fillRoundRect(ctx, x, y + 14, Math.max(12, width * (percentile / 100)), 13, 7, color)
  fillRoundRect(ctx, x + Math.max(12, width * (percentile / 100)) - 21, y + 2, 42, 42, 21, color)
  drawText(ctx, percentile, x + Math.max(12, width * (percentile / 100)), y + 29, {
    size: 15,
    weight: 900,
    color: '#ffffff',
    align: 'center',
  })
}

function drawBenchmarkTags(ctx, rows, x, y) {
  const tags = [...rows]
    .filter((row) => Number.isFinite(row.percentile) && row.percentile >= 75)
    .sort((a, b) => b.percentile - a.percentile)
    .slice(0, 2)

  if (!tags.length) return

  let tagX = x
  tags.forEach((row) => {
    const label = `Top ${100 - row.percentile + 1}% ${row.label}`
    ctx.font = '800 15px Inter, Arial, sans-serif'
    const tagWidth = Math.min(260, Math.ceil(ctx.measureText(label).width) + 28)
    fillRoundRect(ctx, tagX, y, tagWidth, 34, 17, '#dcfce7')
    drawText(ctx, label, tagX + 14, y + 23, {
      size: 15,
      weight: 800,
      color: '#166534',
      maxWidth: tagWidth - 28,
    })
    tagX += tagWidth + 10
  })
}

async function loadCanvasImage(url) {
  if (!url) return null
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    try {
      const image = new Image()
      image.src = objectUrl
      await image.decode()
      return image
    } finally {
      URL.revokeObjectURL(objectUrl)
    }
  } catch {
    return null
  }
}

function clipCircleImage(ctx, image, x, y, size) {
  ctx.save()
  ctx.beginPath()
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2)
  ctx.clip()

  const imageRatio = image.width / image.height
  const targetRatio = 1
  let sx = 0
  let sy = 0
  let sw = image.width
  let sh = image.height

  if (imageRatio > targetRatio) {
    sw = image.height * targetRatio
    sx = (image.width - sw) / 2
  } else {
    sh = image.width / targetRatio
    sy = Math.max(0, (image.height - sh) * 0.18)
  }

  ctx.drawImage(image, sx, sy, sw, sh, x, y, size, size)
  ctx.restore()
}

function drawInitialAvatar(ctx, player, x, y, size) {
  const initials = String(player.name ?? '?')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  const gradient = ctx.createLinearGradient(x, y, x + size, y + size)
  gradient.addColorStop(0, '#0284c7')
  gradient.addColorStop(1, '#4338ca')
  fillRoundRect(ctx, x, y, size, size, size / 2, gradient)
  drawText(ctx, initials, x + size / 2, y + size / 2 + 22, {
    size: 58,
    weight: 900,
    color: '#ffffff',
    align: 'center',
  })
}

function downloadCanvas(canvas, fileName) {
  const link = document.createElement('a')
  link.download = fileName
  link.href = canvas.toDataURL('image/png')
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export async function createPlayerProfileCanvas(player) {
  const stats = player.stats ?? {}
  const caption = buildPerformanceCaption(player)
  const highlightLines = caption.lines.slice(0, 8)
  // Card height grows with the number of highlight lines so nothing clips.
  const panelH = 156 + highlightLines.length * 44
  const formY = 1344 + panelH + 24
  const height = formY + 160 + 70

  const canvas = document.createElement('canvas')
  canvas.width = WIDTH * SCALE
  canvas.height = height * SCALE
  const ctx = canvas.getContext('2d')
  ctx.scale(SCALE, SCALE)

  const photoUrl = localMediaUrl(player.photo_url || (player.source_player_id ? `/api/media/player/${player.source_player_id}/image` : ''))
  const logoUrl = localMediaUrl(player.club_logo_url || (player.source_team_id ? `/api/media/team/${player.source_team_id}/image` : ''))
  const [photo, logo] = await Promise.all([
    loadCanvasImage(photoUrl),
    loadCanvasImage(logoUrl),
  ])
  const percentileRows = await measuredPercentileRows(player)

  const bg = ctx.createLinearGradient(0, 0, WIDTH, height)
  bg.addColorStop(0, '#020617')
  bg.addColorStop(0.46, '#082f49')
  bg.addColorStop(1, '#172554')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, WIDTH, height)

  ctx.globalAlpha = 0.22
  ctx.strokeStyle = '#38bdf8'
  ctx.lineWidth = 2
  for (let i = -200; i < WIDTH + 300; i += 52) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i + 420, height)
    ctx.stroke()
  }
  ctx.fillStyle = '#22c55e'
  ctx.beginPath()
  ctx.arc(930, 160, 280, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1

  fillRoundRect(ctx, 54, 54, WIDTH - 108, height - 108, 40, 'rgba(248,250,252,0.96)')
  fillRoundRect(ctx, 78, 78, WIDTH - 156, 365, 34, '#0f172a')

  const headerGlow = ctx.createLinearGradient(78, 78, WIDTH - 78, 443)
  headerGlow.addColorStop(0, 'rgba(14,165,233,0.34)')
  headerGlow.addColorStop(0.52, 'rgba(37,99,235,0.16)')
  headerGlow.addColorStop(1, 'rgba(34,197,94,0.18)')
  fillRoundRect(ctx, 78, 78, WIDTH - 156, 365, 34, headerGlow)

  drawText(ctx, 'PITCHVISION SCOUT CARD', 116, 128, {
    size: 20,
    weight: 800,
    color: '#7dd3fc',
  })
  drawText(ctx, player.season ?? '', WIDTH - 116, 128, {
    size: 20,
    weight: 800,
    color: '#cbd5e1',
    align: 'right',
  })

  if (photo) {
    clipCircleImage(ctx, photo, 116, 172, 220)
  } else {
    drawInitialAvatar(ctx, player, 116, 172, 220)
  }

  if (logo) {
    ctx.save()
    fillRoundRect(ctx, WIDTH - 202, 168, 96, 96, 24, 'rgba(255,255,255,0.92)')
    ctx.drawImage(logo, WIDTH - 188, 182, 68, 68)
    ctx.restore()
  }

  drawText(ctx, player.name, 374, 220, {
    size: player.name.length > 18 ? 44 : 52,
    weight: 900,
    color: '#ffffff',
    maxWidth: 470,
  })
  drawText(ctx, `${player.position} | ${player.club}`, 376, 272, {
    size: 26,
    weight: 700,
    color: '#dbeafe',
    maxWidth: 520,
  })
  drawText(ctx, `${player.nationality} | Age ${player.age} | ${player.league}`, 376, 314, {
    size: 21,
    weight: 600,
    color: '#94a3b8',
    maxWidth: 530,
  })

  const isGk = player.position === 'GK'
  const isDef = ['CB', 'LB', 'RB'].includes(player.position)
  let pillX = 376
  pillX += drawPill(ctx, `${formatNumber(stats.appearances)} APPS`, pillX, 346, { fill: 'rgba(148,163,184,0.22)', color: '#e2e8f0' }) + 10
  pillX += drawPill(ctx, `${formatNumber(stats.minutesPlayed)} MIN`, pillX, 346, { fill: 'rgba(14,165,233,0.22)' }) + 10
  pillX += drawPill(ctx, `${formatNumber(stats.rating, 1)} AVG`, pillX, 346, { fill: 'rgba(34,197,94,0.2)', color: '#bbf7d0' }) + 10
  const thirdPill = isGk
    ? `${formatNumber(stats.cleanSheets)} CS`
    : isDef
      ? `${formatNumber((stats.tackles ?? 0) + (stats.interceptions ?? 0))} T+I`
      : `${formatNumber(stats.goalContributions)} G+A`
  drawPill(ctx, thirdPill, pillX, 346, { fill: 'rgba(250,204,21,0.18)', color: '#fef08a' })

  // Scope badge — makes clear what performance this card represents.
  const scopeLabel = (player.selected_competition && player.selected_competition !== 'All Competitions')
    ? player.selected_competition
    : 'All Competitions'
  drawText(ctx, scopeLabel.toUpperCase(), WIDTH - 116, 158, {
    size: 18,
    weight: 800,
    color: '#7dd3fc',
    align: 'right',
    maxWidth: 460,
  })

  const tiles = headlineTiles(stats, player.position)
  const tileX = [96, 270, 444, 618, 792]
  tiles.forEach((tile, index) => {
    drawMetricTile(ctx, tile.label, tile.value, tileX[index], 480, tile.wide ? 192 : 158, {
      fill: tile.fill,
      valueColor: tile.valueColor,
    })
  })

  const savePct = stats.totalShotsFaced ? ((stats.saves ?? 0) / stats.totalShotsFaced) * 100 : null

  fillRoundRect(ctx, 96, 640, 436, 210, 30, '#ffffff')
  if (isGk) {
    drawText(ctx, 'Shot Stopping', 126, 692, { size: 27, weight: 900, color: '#0f172a' })
    drawStatLine(ctx, 'Saves', formatNumber(stats.saves), 126, 742, 350)
    drawStatLine(ctx, 'Save accuracy', savePct == null ? '—' : `${metricValue(savePct, 1)}%`, 126, 792, 350)
    drawStatLine(ctx, 'Clean sheets', formatNumber(stats.cleanSheets), 126, 842, 350)
  } else {
    drawText(ctx, 'Measured Output', 126, 692, { size: 27, weight: 900, color: '#0f172a' })
    drawStatLine(ctx, 'Shots', formatNumber(stats.shots), 126, 742, 350)
    drawStatLine(ctx, 'Shots on target', formatNumber(stats.shotsOnTarget), 126, 792, 350)
    drawStatLine(ctx, 'Key passes', formatNumber(stats.keyPasses), 126, 842, 350)
  }

  fillRoundRect(ctx, 556, 640, 428, 210, 30, '#ffffff')
  drawText(ctx, isGk ? 'Distribution' : 'Measured Ball Use', 586, 692, { size: 27, weight: 900, color: '#0f172a' })
  drawStatLine(ctx, 'Touches', formatNumber(stats.touches), 586, 742, 338)
  drawStatLine(ctx, 'Possession lost', formatNumber(stats.possessionLost), 586, 792, 338, { valueColor: '#b91c1c' })
  drawStatLine(ctx, 'Pass accuracy', `${metricValue(stats.passAccuracy, 1)}%`, 586, 842, 338)

  fillRoundRect(ctx, 96, 880, 436, 210, 30, '#ffffff')
  if (isGk) {
    drawText(ctx, 'Goalkeeping', 126, 932, { size: 27, weight: 900, color: '#0f172a' })
    drawStatLine(ctx, 'Goals conceded', formatNumber(stats.goalsConceded), 126, 982, 350, { valueColor: '#b91c1c' })
    drawStatLine(ctx, 'High claims', formatNumber(stats.highClaims), 126, 1032, 350)
    drawStatLine(ctx, 'Punches', formatNumber(stats.punches), 126, 1082, 350)
  } else {
    drawText(ctx, 'Measured Dribbling', 126, 932, { size: 27, weight: 900, color: '#0f172a' })
    drawStatLine(ctx, 'Successful dribbles', formatNumber(stats.dribbles), 126, 982, 350)
    drawStatLine(ctx, 'Dribble attempts', formatNumber(stats.dribblesAttempted), 126, 1032, 350)
    drawStatLine(ctx, 'Dribble success', `${metricValue(stats.dribbleSuccess, 1)}%`, 126, 1082, 350)
  }

  fillRoundRect(ctx, 556, 880, 428, 210, 30, '#ffffff')
  if (isGk) {
    drawText(ctx, 'Sweeping & Discipline', 586, 932, { size: 27, weight: 900, color: '#0f172a' })
    drawStatLine(ctx, 'Run outs', formatNumber(stats.runOuts), 586, 982, 338)
    drawStatLine(ctx, 'Recoveries', formatNumber(stats.recoveries), 586, 1032, 338)
    drawStatLine(ctx, 'Yellow cards', formatNumber(stats.yellowCards), 586, 1082, 338)
    drawStatLine(ctx, 'Red cards', formatNumber(stats.redCards), 586, 1132, 338)
  } else {
    drawText(ctx, 'Defensive Work', 586, 932, { size: 27, weight: 900, color: '#0f172a' })
    drawStatLine(ctx, 'Tackles', formatNumber(stats.tackles), 586, 982, 338)
    drawStatLine(ctx, 'Successful tackles', formatNumber(stats.successfulTackles), 586, 1032, 338)
    drawStatLine(ctx, 'Recoveries', formatNumber(stats.recoveries), 586, 1082, 338)
    drawStatLine(ctx, 'Fouls', formatNumber(stats.fouls), 586, 1132, 338)
  }

  fillRoundRect(ctx, 96, 1120, 888, 200, 30, '#ffffff')
  drawText(ctx, 'Measured Peer Percentiles', 126, 1168, { size: 27, weight: 900, color: '#0f172a' })
  if (percentileRows.length) {
    drawBenchmarkTags(ctx, percentileRows, 545, 1140)
    percentileRows.slice(0, 4).forEach((row, index) => {
      drawPercentileBar(ctx, row, 126 + (index % 2) * 420, 1208 + Math.floor(index / 2) * 58, 350)
    })
  } else {
    drawText(ctx, 'Peer context unavailable', 126, 1228, { size: 20, weight: 800, color: '#64748b' })
  }

  // Match highlights — the same emoji performance lines as the share caption.
  fillRoundRect(ctx, 96, 1344, 888, panelH, 30, '#ffffff')
  drawText(ctx, 'Match Highlights', 126, 1392, { size: 27, weight: 900, color: '#0f172a' })
  highlightLines.forEach((line, index) => {
    drawText(ctx, line, 126, 1440 + index * 44, {
      size: 24,
      weight: 800,
      color: '#0f172a',
      maxWidth: 828,
    })
  })
  if (caption.verdict) {
    const verdictY = 1440 + highlightLines.length * 44 + 8
    fillRoundRect(ctx, 126, verdictY - 30, 828, 56, 18, '#0f172a')
    drawText(ctx, caption.verdict, 150, verdictY + 8, {
      size: 26,
      weight: 900,
      color: '#ffffff',
      maxWidth: 780,
    })
  }

  fillRoundRect(ctx, 96, formY, 888, 160, 30, '#ffffff')
  drawFormStrip(ctx, player.form ?? [], 126, formY + 44, 828)

  drawText(ctx, 'Generated by PitchVision', WIDTH - 96, formY + 196, {
    size: 18,
    weight: 800,
    color: '#64748b',
    align: 'right',
  })

  return canvas
}

export async function savePlayerProfileImage(player) {
  const canvas = await createPlayerProfileCanvas(player)
  downloadCanvas(canvas, `${safeFileName(player.name)}-pitchvision-profile.png`)
}
