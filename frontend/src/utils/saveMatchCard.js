import { localMediaUrl } from './mediaUrl'
import { buildPerformanceCaption, flagEmoji } from './performanceCaption'

const WIDTH = 1400
const HEIGHT = 1200
const SCALE = 2

const num = (v) => Math.round(Number(v) || 0)
const dec = (v, d = 1) => (Number.isFinite(Number(v)) ? Number(v).toFixed(d) : '—')

function safeFileName(value = 'match') {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80) || 'match'
}

function ratingLabel(rating) {
  if (rating >= 8.5) return ['EXCELLENT PERFORMANCE', '#22c55e']
  if (rating >= 7.5) return ['GREAT PERFORMANCE', '#4ade80']
  if (rating >= 7) return ['GOOD PERFORMANCE', '#a3e635']
  if (rating >= 6.5) return ['SOLID PERFORMANCE', '#facc15']
  return ['QUIET GAME', '#fb923c']
}

function drawRoundRect(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rad, y)
  ctx.arcTo(x + w, y, x + w, y + h, rad)
  ctx.arcTo(x + w, y + h, x, y + h, rad)
  ctx.arcTo(x, y + h, x, y, rad)
  ctx.arcTo(x, y, x + w, y, rad)
  ctx.closePath()
}

function panel(ctx, x, y, w, h, r = 18) {
  drawRoundRect(ctx, x, y, w, h, r)
  ctx.fillStyle = 'rgba(255,255,255,0.04)'
  ctx.fill()
  drawRoundRect(ctx, x, y, w, h, r)
  ctx.strokeStyle = 'rgba(255,255,255,0.09)'
  ctx.lineWidth = 1
  ctx.stroke()
}

function text(ctx, str, x, y, { size = 20, weight = 600, color = '#e2e8f0', align = 'left', maxWidth } = {}) {
  ctx.font = `${weight} ${size}px Inter, Arial, sans-serif`
  ctx.fillStyle = color
  ctx.textAlign = align
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(String(str ?? ''), x, y, maxWidth)
}

function statRow(ctx, label, value, x, y, w, { valueColor = '#ffffff' } = {}) {
  text(ctx, label, x, y, { size: 17, weight: 600, color: '#94a3b8' })
  text(ctx, value, x + w, y, { size: 18, weight: 800, color: valueColor, align: 'right' })
  ctx.strokeStyle = 'rgba(255,255,255,0.07)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x, y + 16)
  ctx.lineTo(x + w, y + 16)
  ctx.stroke()
}

function sectionTitle(ctx, str, x, y) {
  text(ctx, str.toUpperCase(), x, y, { size: 16, weight: 900, color: '#cbd5e1' })
}

async function loadImage(url) {
  if (!url) return null
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    const obj = URL.createObjectURL(blob)
    try {
      const img = new Image()
      img.src = obj
      await img.decode()
      return img
    } finally {
      URL.revokeObjectURL(obj)
    }
  } catch {
    return null
  }
}

function clipCircle(ctx, img, x, y, size) {
  ctx.save()
  ctx.beginPath()
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2)
  ctx.clip()
  const ratio = img.width / img.height
  let sx = 0; let sy = 0; let sw = img.width; let sh = img.height
  if (ratio > 1) { sw = img.height; sx = (img.width - sw) / 2 } else { sh = img.width; sy = Math.max(0, (img.height - sh) * 0.15) }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, size, size)
  ctx.restore()
}

function drawVerticalPitch(ctx, x, y, w, h) {
  drawRoundRect(ctx, x, y, w, h, 10)
  ctx.fillStyle = '#0b1220'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'
  ctx.lineWidth = 1.5
  ctx.strokeRect(x + 8, y + 8, w - 16, h - 16)
  ctx.beginPath(); ctx.moveTo(x + 8, y + h / 2); ctx.lineTo(x + w - 8, y + h / 2); ctx.stroke()
  ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, 34, 0, Math.PI * 2); ctx.stroke()
  ctx.strokeRect(x + w / 2 - 52, y + 8, 104, 58)
  ctx.strokeRect(x + w / 2 - 52, y + h - 66, 104, 58)
}

// Real heatmap from provider points. Coordinates are 0-100: x = pitch length
// (0 own goal → 100 opponent goal), y = width. Drawn on a vertical pitch with
// the attack pointing up.
function drawHeatmap(ctx, x, y, w, h, points) {
  drawVerticalPitch(ctx, x, y, w, h)
  if (!points || !points.length) {
    text(ctx, 'No heatmap data', x + w / 2, y + h / 2, { size: 16, weight: 700, color: '#64748b', align: 'center' })
    return
  }
  ctx.save()
  drawRoundRect(ctx, x + 8, y + 8, w - 16, h - 16, 6)
  ctx.clip()
  const innerX = x + 8; const innerY = y + 8; const innerW = w - 16; const innerH = h - 16
  // attack up: high x → top
  const px = (p) => innerX + (p.y / 100) * innerW
  const py = (p) => innerY + (1 - p.x / 100) * innerH
  ctx.globalCompositeOperation = 'lighter'
  points.forEach((p) => {
    const cx = px(p); const cy = py(p)
    const r = 30
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, r)
    g.addColorStop(0, 'rgba(239,68,68,0.30)')
    g.addColorStop(0.5, 'rgba(249,115,22,0.18)')
    g.addColorStop(1, 'rgba(34,197,94,0)')
    ctx.fillStyle = g
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill()
  })
  ctx.globalCompositeOperation = 'source-over'
  ctx.restore()
}

// Real touch positions from the heatmap points, drawn as discrete dots on a
// vertical pitch (attack → up). Labelled "Touches" — these are real positions,
// not passes.
function drawTouchMap(ctx, x, y, w, h, points) {
  drawVerticalPitch(ctx, x, y, w, h)
  if (!points || !points.length) {
    text(ctx, 'No touch data', x + w / 2, y + h / 2 + 6, { size: 15, weight: 700, color: '#64748b', align: 'center' })
    return
  }
  ctx.save()
  drawRoundRect(ctx, x + 8, y + 8, w - 16, h - 16, 6)
  ctx.clip()
  const innerX = x + 8; const innerY = y + 8; const innerW = w - 16; const innerH = h - 16
  // x = length (0 own goal → 100 opp goal): attack up → high x at top.
  // y = width → horizontal.
  points.forEach((p) => {
    const tx = innerX + (p.y / 100) * innerW
    const ty = innerY + (1 - p.x / 100) * innerH
    ctx.fillStyle = 'rgba(56,189,248,0.7)'
    ctx.beginPath(); ctx.arc(tx, ty, 4, 0, Math.PI * 2); ctx.fill()
  })
  ctx.restore()
}

const SHOT_STYLE = {
  goal: ['#22c55e', 9],
  save: ['#eab308', 7],
  miss: ['#ef4444', 7],
  block: ['#f97316', 7],
  post: ['#e2e8f0', 7],
}

// Real shot map. Shots carry playerCoordinates (0-100): x = length toward goal,
// y = width. Goal is at the top of the panel.
function drawShotMap(ctx, x, y, w, h, shots) {
  drawRoundRect(ctx, x, y, w, h, 10)
  ctx.fillStyle = '#0b1220'; ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1.5
  ctx.strokeRect(x + w / 2 - 90, y + 14, 180, 84)
  ctx.strokeRect(x + w / 2 - 40, y + 14, 80, 36)
  ctx.beginPath(); ctx.arc(x + w / 2, y + h - 30, 30, Math.PI, Math.PI * 2); ctx.stroke()

  if (!shots || !shots.length) {
    text(ctx, 'No shots', x + w / 2, y + h / 2 + 10, { size: 15, weight: 700, color: '#64748b', align: 'center' })
    return
  }
  shots.forEach((shot) => {
    if (shot.x == null || shot.y == null) return
    const [color, radius] = SHOT_STYLE[shot.type] ?? ['#94a3b8', 7]
    // x: 0..100 distance from own goal; attacking goal at top → high x near top.
    const sx = x + 14 + (shot.y / 100) * (w - 28)
    const sy = y + 14 + (1 - (shot.x - 50) / 50) * (h - 50)
    ctx.fillStyle = color
    ctx.beginPath(); ctx.arc(sx, Math.max(y + 16, Math.min(y + h - 16, sy)), radius, 0, Math.PI * 2); ctx.fill()
    if (shot.type === 'goal') {
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(sx, Math.max(y + 16, Math.min(y + h - 16, sy)), radius + 3, 0, Math.PI * 2); ctx.stroke()
    }
  })
}

function drawTimeline(ctx, x, y, w, events) {
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'
  ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.stroke()
  for (let m = 0; m <= 90; m += 15) {
    const mx = x + (m / 90) * w
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'
    ctx.beginPath(); ctx.moveTo(mx, y - 5); ctx.lineTo(mx, y + 5); ctx.stroke()
    text(ctx, `${m}'`, mx, y + 28, { size: 14, weight: 700, color: '#64748b', align: 'center' })
  }
  events.forEach((ev) => {
    const ex = x + (Math.min(90, ev.minute) / 90) * w
    const r = ev.small ? 5 : 8
    ctx.fillStyle = ev.color
    ctx.beginPath(); ctx.arc(ex, y, r, 0, Math.PI * 2); ctx.fill()
    if (ev.isPlayer) {
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(ex, y, r + 3, 0, Math.PI * 2); ctx.stroke()
    }
    if (!ev.small) text(ctx, `${ev.minute}'`, ex, y - 16, { size: 13, weight: 800, color: '#cbd5e1', align: 'center' })
  })
}

// Mini goal-frame showing where shots crossed the goal line.
// goal_mouth.y = across the goal (0-100), z = height.
function drawGoalFrame(ctx, x, y, w, h, shots) {
  const postL = x + w * 0.18; const postR = x + w * 0.82
  const crossbar = y + h * 0.28; const ground = y + h * 0.86
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(postL, ground); ctx.lineTo(postL, crossbar)
  ctx.lineTo(postR, crossbar); ctx.lineTo(postR, ground)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1
  for (let i = 1; i < 6; i += 1) {
    const gx = postL + ((postR - postL) / 6) * i
    ctx.beginPath(); ctx.moveTo(gx, crossbar); ctx.lineTo(gx, ground); ctx.stroke()
  }
  const onTarget = (shots || []).filter((s) => s.goal_mouth && s.goal_mouth.y != null)
  if (!onTarget.length) {
    text(ctx, 'No shots on target', x + w / 2, ground + 22, { size: 12, weight: 700, color: '#64748b', align: 'center' })
    return
  }
  onTarget.forEach((s) => {
    const gy = s.goal_mouth.y
    const gz = Math.max(0, Math.min(100, s.goal_mouth.z ?? 0))
    const px = postL + (gy / 100) * (postR - postL)
    const py = ground - (gz / 100) * (ground - crossbar)
    const [color] = SHOT_STYLE[s.type] ?? ['#94a3b8']
    ctx.fillStyle = color
    ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.fill()
  })
}

// Full-match timeline: goals, assists, cards, substitutions for both teams,
// with this player's own moments ringed in white.
function buildMatchTimeline(incidents, shots, playerId) {
  const events = []
  ;(incidents || []).forEach((inc) => {
    if (inc.minute == null) return
    if (inc.type === 'goal') {
      events.push({ minute: inc.minute, color: '#22c55e', isPlayer: playerId != null && inc.player === playerId })
      if (inc.assist != null) {
        events.push({ minute: inc.minute, color: '#38bdf8', small: true, isPlayer: playerId != null && inc.assist === playerId })
      }
    } else if (inc.type === 'card') {
      events.push({ minute: inc.minute, color: (inc.subtype === 'red' || inc.subtype === 'yellowRed') ? '#ef4444' : '#eab308', isPlayer: playerId != null && inc.player === playerId })
    } else if (inc.type === 'substitution') {
      const involved = playerId != null && (inc.player_in === playerId || inc.player_out === playerId)
      events.push({ minute: inc.minute, color: '#a855f7', small: true, isPlayer: involved })
    }
  })
  return events.sort((a, b) => a.minute - b.minute)
}

// A readable, scout-style narrative from the match stats.
function buildNarrative(player, stats, opponent, isMotm, xg) {
  const rating = Number(stats.rating) || 0
  const g = num(stats.goals); const a = num(stats.assists)
  const isGk = player.position === 'GK'
  const isDef = ['CB', 'LB', 'RB'].includes(player.position)
  const grade = rating >= 9 ? 'a world-class display' : rating >= 8 ? 'an outstanding display' : rating >= 7 ? 'a strong performance' : rating >= 6 ? 'a steady performance' : 'a quiet outing'
  const parts = [`${player.name} produced ${grade} against ${opponent || 'the opposition'}`]

  const goalPhrase = g >= 3 ? `a ${g === 3 ? 'hat-trick' : `${g}-goal haul`}` : g === 2 ? 'a brace' : g === 1 ? 'a goal' : ''
  const out = []
  if (goalPhrase) out.push(`scoring ${goalPhrase}`)
  if (a > 0) out.push(`providing ${a} assist${a > 1 ? 's' : ''}`)
  if (out.length) parts[0] += `, ${out.join(' and ')}`
  parts[0] += '.'

  const detail = []
  if (xg > 0 && !isGk) detail.push(`He registered an xG of ${dec(xg, 2)}`)
  if (num(stats.keyPasses) >= 2) detail.push(`${num(stats.keyPasses)} key passes`)
  if (num(stats.dribbles) >= 3) detail.push(`${num(stats.dribbles)} successful dribbles`)
  if (isDef || isGk) {
    if (num(stats.recoveries)) detail.push(`${num(stats.recoveries)} recoveries`)
    if (num(stats.clearances)) detail.push(`${num(stats.clearances)} clearances`)
    if (isGk && num(stats.saves)) detail.push(`${num(stats.saves)} saves`)
  }
  if (detail.length) parts.push(`${detail.join(', ').replace(/, ([^,]*)$/, ' and $1')}.`)

  if (isMotm) parts.push(`A ${dec(rating, 1)} rating earned him Player of the Match honours.`)
  else if (rating > 0) parts.push(`He finished with a ${dec(rating, 1)} match rating.`)
  return parts.join(' ')
}

export async function createMatchCardCanvas(player, meta = {}) {
  const stats = player.stats ?? {}
  const rating = Number(stats.rating) || 0
  const [ratingText, ratingColor] = ratingLabel(rating)
  const isGk = player.position === 'GK'
  const isDef = ['CB', 'LB', 'RB'].includes(player.position)
  const leftSided = ['LW', 'LB', 'LM'].includes(player.position)

  const scope = player.selected_competition || ''
  const opponent = meta.opponent || (scope.startsWith('vs ') ? scope.slice(3) : '')
  const competition = meta.competition || player.league || ''
  const dateLabel = meta.date || ''
  const caption = buildPerformanceCaption(player)
  const heatmapPts = meta.heatmap || []
  const shots = meta.shots || []
  const incidents = meta.incidents || []
  const xgSum = shots.reduce((a, s) => a + (Number(s.xg) || 0), 0)
  const xgotSum = shots.reduce((a, s) => a + (Number(s.xgot) || 0), 0)

  const canvas = document.createElement('canvas')
  canvas.width = WIDTH * SCALE
  canvas.height = HEIGHT * SCALE
  const ctx = canvas.getContext('2d')
  ctx.scale(SCALE, SCALE)

  const ev = meta.event || {}
  const photo = await loadImage(localMediaUrl(player.photo_url || (player.source_player_id ? `/api/media/player/${player.source_player_id}/image` : '')))
  const crest = await loadImage(localMediaUrl(player.club_logo_url || (player.source_team_id ? `/api/media/team/${player.source_team_id}/image` : '')))
  const homeCrest = ev.home_crest ? await loadImage(localMediaUrl(ev.home_crest)) : null
  const awayCrest = ev.away_crest ? await loadImage(localMediaUrl(ev.away_crest)) : null
  const hasScore = ev.home_score != null && ev.away_score != null

  // Background
  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT)
  bg.addColorStop(0, '#070b14'); bg.addColorStop(0.5, '#0a1120'); bg.addColorStop(1, '#0b1428')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  const P = 28
  // ---- Header ----
  text(ctx, 'PLAYER PERFORMANCE', P, 56, { size: 30, weight: 900, color: '#ffffff' })
  text(ctx, 'AGAINST ', P, 88, { size: 19, weight: 800, color: '#94a3b8' })
  ctx.font = '800 19px Inter, Arial, sans-serif'
  const againstW = ctx.measureText('AGAINST ').width
  text(ctx, (opponent || 'OPPONENT').toUpperCase(), P + againstW, 88, { size: 19, weight: 900, color: '#ef4444' })

  text(ctx, competition.toUpperCase(), WIDTH / 2, 48, { size: 18, weight: 900, color: '#e2e8f0', align: 'center' })
  const venueLine = [dateLabel, ev.venue].filter(Boolean).join('  ·  ')
  if (venueLine) text(ctx, venueLine, WIDTH / 2, 76, { size: 14, weight: 700, color: '#94a3b8', align: 'center' })

  if (hasScore) {
    // Scoreline with both crests on the right.
    const cy = 56
    if (awayCrest) ctx.drawImage(awayCrest, WIDTH - P - 36, cy - 26, 36, 36)
    const scoreStr = `${ev.home_score} - ${ev.away_score}`
    ctx.font = '900 30px Inter, Arial, sans-serif'
    const sW = ctx.measureText(scoreStr).width
    text(ctx, scoreStr, WIDTH - P - 48 - sW, cy, { size: 30, weight: 900, color: '#ffffff' })
    if (homeCrest) ctx.drawImage(homeCrest, WIDTH - P - 48 - sW - 44, cy - 26, 36, 36)
    text(ctx, 'FULL TIME', WIDTH - P, 84, { size: 13, weight: 800, color: '#94a3b8', align: 'right' })
  }
  // Opponent crest next to the "AGAINST" line.
  const oppCrest = (ev.home_name && opponent && ev.home_name.toLowerCase() === opponent.toLowerCase()) ? homeCrest : awayCrest
  if (oppCrest) {
    ctx.font = '900 19px Inter, Arial, sans-serif'
    const oppW = ctx.measureText((opponent || 'OPPONENT').toUpperCase()).width
    ctx.drawImage(oppCrest, P + againstW + oppW + 12, 70, 24, 24)
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.1)'
  ctx.beginPath(); ctx.moveTo(P, 108); ctx.lineTo(WIDTH - P, 108); ctx.stroke()

  // ---- Columns ----
  const colLeftX = P; const colLeftW = 360
  const colMidX = colLeftX + colLeftW + 20; const colMidW = 440
  const colRightX = colMidX + colMidW + 20; const colRightW = WIDTH - colRightX - P

  // Left: player + rating + key stats
  const lpY = 128
  if (photo) clipCircle(ctx, photo, colLeftX, lpY, 116)
  else { drawRoundRect(ctx, colLeftX, lpY, 116, 116, 58); ctx.fillStyle = '#1e293b'; ctx.fill() }
  text(ctx, player.name, colLeftX + 134, lpY + 44, { size: player.name.length > 16 ? 26 : 31, weight: 900, color: '#ffffff', maxWidth: colLeftW - 134 })
  text(ctx, `${flagEmoji(player.flag_code)} #${stats.shirtNumber ?? player.shirt_number ?? '—'}  |  ${player.position}`, colLeftX + 134, lpY + 82, { size: 18, weight: 700, color: '#94a3b8' })
  if (crest) ctx.drawImage(crest, colLeftX + 134, lpY + 96, 28, 28)
  if (meta.isMotm) {
    const label = '★ PLAYER OF THE MATCH'
    ctx.font = '900 13px Inter, Arial, sans-serif'
    const bw = ctx.measureText(label).width + 24
    drawRoundRect(ctx, colLeftX + 170, lpY + 100, bw, 26, 13); ctx.fillStyle = '#facc15'; ctx.fill()
    text(ctx, label, colLeftX + 182, lpY + 118, { size: 13, weight: 900, color: '#0f172a' })
  }

  // Overall rating
  let ry = lpY + 190
  sectionTitle(ctx, 'Overall Rating', colLeftX, ry)
  text(ctx, dec(rating, 1), colLeftX, ry + 78, { size: 76, weight: 900, color: ratingColor })
  ctx.font = '900 76px Inter, Arial, sans-serif'
  const rw = ctx.measureText(dec(rating, 1)).width
  text(ctx, '/10', colLeftX + rw + 10, ry + 78, { size: 24, weight: 800, color: '#64748b' })
  text(ctx, ratingText, colLeftX, ry + 112, { size: 17, weight: 800, color: ratingColor })

  // Key counting stats
  let ksy = ry + 148
  const keyList = isGk
    ? [['Minutes Played', `${num(stats.minutesPlayed)}'`], ['Saves', num(stats.saves)], ['Goals Conceded', num(stats.goalsConceded)], ['Clean Sheet', num(stats.cleanSheets) ? 'Yes' : 'No'], ['High Claims', num(stats.highClaims)]]
    : [['Minutes Played', `${num(stats.minutesPlayed)}'`], ['Goals', num(stats.goals)], ['Assists', num(stats.assists)], ['Shots', num(stats.shots)], ['Shots on Target', num(stats.shotsOnTarget)]]
  keyList.forEach(([l, v]) => { statRow(ctx, l, `${v}`, colLeftX, ksy, colLeftW); ksy += 30 })

  // Middle: heatmap
  const hmY = 128
  panel(ctx, colMidX, hmY, colMidW, 472)
  sectionTitle(ctx, 'Heatmap', colMidX + 22, hmY + 34)
  drawHeatmap(ctx, colMidX + 22, hmY + 56, colMidW - 44, 360, heatmapPts)
  text(ctx, '→  ATTACK DIRECTION', colMidX + colMidW / 2, hmY + 452, { size: 14, weight: 800, color: '#64748b', align: 'center' })

  // Right: key stats + shot map
  const ksPanelY = 128
  const ksPanelH = 268
  panel(ctx, colRightX, ksPanelY, colRightW, ksPanelH)
  sectionTitle(ctx, 'Key Stats', colRightX + 22, ksPanelY + 34)
  const passPct = num(stats.totalPasses) ? Math.round((num(stats._accuratePasses) / num(stats.totalPasses)) * 100) : num(stats.passAccuracy)
  // Two compact columns to fit creativity + discipline alongside the basics.
  const rightStats = [
    ['Touches', `${num(stats.touches)}`],
    ['Pass Acc.', `${passPct}%`],
    ['Chances Created', `${num(stats.chancesCreated ?? stats.keyPasses)}`],
    ['Big Chances', `${num(stats.bigChancesCreated)}`],
    ['Big Ch. Missed', `${num(stats.bigChancesMissed)}`],
    ['Dribbles', `${num(stats.dribbles)}/${num(stats.dribblesAttempted ?? stats._totalDribbles ?? stats.dribbles)}`],
    ['Crosses', `${num(stats.accurateCrosses)}/${num(stats.crosses)}`],
    ['Long Balls', `${num(stats.accurateLongBalls)}/${num(stats.longBalls)}`],
    ['Carries', `${num(stats.carries)}`],
    ['Prog. Carries', `${num(stats.progressiveCarries)}`],
    ['Fouls Won', `${num(stats.foulsSuffered)}`],
    ['Fouls', `${num(stats.fouls)}`],
    ['xG', dec(xgSum || stats.xG, 2)],
    ['xA', dec(stats.xA, 2)],
  ]
  const ksColW = (colRightW - 44 - 18) / 2
  let rsy = ksPanelY + 60
  for (let i = 0; i < rightStats.length; i += 2) {
    statRow(ctx, rightStats[i][0], rightStats[i][1], colRightX + 22, rsy, ksColW)
    if (rightStats[i + 1]) statRow(ctx, rightStats[i + 1][0], rightStats[i + 1][1], colRightX + 22 + ksColW + 18, rsy, ksColW)
    rsy += 29
  }

  const smY = ksPanelY + ksPanelH + 16
  panel(ctx, colRightX, smY, colRightW, 192)
  sectionTitle(ctx, 'Shot Map', colRightX + 22, smY + 30)
  const shotsTotal = shots.length
  const shotsOnTarget = shots.filter((s) => s.type === 'goal' || s.type === 'save').length
  const shotsGoals = shots.filter((s) => s.type === 'goal').length
  text(ctx, `${shotsTotal} shots · ${shotsOnTarget} on target · ${shotsGoals} ${shotsGoals === 1 ? 'goal' : 'goals'}`, colRightX + colRightW - 22, smY + 30, { size: 13, weight: 800, color: '#94a3b8', align: 'right' })
  // Pitch view on the left, goal-frame placement on the right.
  const smPitchW = Math.round((colRightW - 44) * 0.56)
  drawShotMap(ctx, colRightX + 22, smY + 44, smPitchW, 116, shots)
  const gfX = colRightX + 22 + smPitchW + 16
  drawGoalFrame(ctx, gfX, smY + 48, colRightW - 44 - smPitchW - 16, 96, shots)
  text(ctx, 'POSITION', colRightX + 22, smY + 178, { size: 11, weight: 800, color: '#64748b' })
  text(ctx, 'GOAL PLACEMENT', gfX, smY + 178, { size: 11, weight: 800, color: '#64748b' })

  // ---- Row 2: defensive / duels (left+mid) + large Touch Map (right, tall) ----
  const r2Y = 620
  panel(ctx, colLeftX, r2Y, colLeftW, 200)
  sectionTitle(ctx, 'Defensive Actions', colLeftX + 22, r2Y + 34)
  let dy = r2Y + 66
  ;[['Tackles', num(stats.tackles)], ['Interceptions', num(stats.interceptions)], ['Blocks', num(stats.blocks)], ['Clearances', num(stats.clearances)], ['Recoveries', num(stats.recoveries)]]
    .forEach(([l, v]) => { statRow(ctx, l, `${v}`, colLeftX + 22, dy, colLeftW - 44); dy += 26 })

  panel(ctx, colMidX, r2Y, colMidW, 200)
  sectionTitle(ctx, 'Duels', colMidX + 22, r2Y + 34)
  let uy = r2Y + 70
  const duelSuccess = stats.duelSuccess != null ? `${num(stats.duelSuccess)}%` : '—'
  ;[['Ground Duels (Won)', num(stats.groundDuelsWon)], ['Aerial Duels (Won)', num(stats.aerialDuelsWon)], ['Duel Success Rate', duelSuccess]]
    .forEach(([l, v]) => { statRow(ctx, l, `${v}`, colMidX + 22, uy, colMidW - 44); uy += 38 })

  // Large vertical Touch Map down the right side, spanning rows 2 + 3.
  const tmPanelH = 460
  panel(ctx, colRightX, r2Y, colRightW, tmPanelH)
  sectionTitle(ctx, 'Touch Map', colRightX + 22, r2Y + 34)
  const tmH = 372
  const tmW = Math.round(tmH * 0.66)
  const tmX = colRightX + (colRightW - tmW) / 2
  drawTouchMap(ctx, tmX, r2Y + 50, tmW, tmH, heatmapPts)
  text(ctx, `↑ ATTACK   ●  ${heatmapPts.length} touches`, colRightX + 22, r2Y + tmPanelH - 18, { size: 13, weight: 700, color: '#94a3b8', align: 'left' })

  // ---- Row 3 (left+mid): timeline then summary ----
  const r3Y = 840
  const lmW = colLeftW + 20 + colMidW
  panel(ctx, colLeftX, r3Y, lmW, 150)
  sectionTitle(ctx, 'Match Timeline', colLeftX + 22, r3Y + 34)
  const events = buildMatchTimeline(incidents, shots, meta.playerSourceId)
  drawTimeline(ctx, colLeftX + 40, r3Y + 86, lmW - 80, events)
  text(ctx, '● GOAL   ● ASSIST   ● CARD   ● SUB   ◯ THIS PLAYER', colLeftX + 40, r3Y + 132, { size: 13, weight: 700, color: '#94a3b8' })

  const sumY = r3Y + 166
  panel(ctx, colLeftX, sumY, lmW, 150)
  sectionTitle(ctx, 'Performance Summary', colLeftX + 22, sumY + 30)
  const summary = buildNarrative(player, stats, opponent, meta.isMotm, xgSum || Number(stats.xG) || 0)
  const words = summary.split(/\s+/)
  let line = ''
  let ty = sumY + 60
  ctx.font = '600 16px Inter, Arial, sans-serif'
  words.forEach((wd) => {
    const test = line ? `${line} ${wd}` : wd
    if (ctx.measureText(test).width > lmW - 44 && line) {
      text(ctx, line, colLeftX + 22, ty, { size: 16, weight: 600, color: '#cbd5e1' })
      line = wd; ty += 24
    } else { line = test }
  })
  if (line) text(ctx, line, colLeftX + 22, ty, { size: 16, weight: 600, color: '#cbd5e1' })

  text(ctx, 'GENERATED BY PITCHIQ', WIDTH - P, HEIGHT - 16, { size: 13, weight: 800, color: '#475569', align: 'right' })
  return canvas
}

export async function saveMatchCard(player, meta = {}) {
  const canvas = await createMatchCardCanvas(player, meta)
  const link = document.createElement('a')
  link.download = `${safeFileName(player.name)}-match-card.png`
  link.href = canvas.toDataURL('image/png')
  document.body.appendChild(link)
  link.click()
  link.remove()
}
