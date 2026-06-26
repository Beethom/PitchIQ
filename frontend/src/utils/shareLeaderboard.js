import { flagEmoji } from './performanceCaption'

const TAB_EMOJI = {
  goals: '⚽️', assists: '🎯', ga: '🎯', penaltyGoals: '🥅', rating: '⭐️', minutes: '⏱️',
  foulsSuffered: '🤕', shots: '🎯', shotsOnTarget: '🎯', xG: '📈', chancesCreated: '📐',
  bigChancesCreated: '🔑', bigChancesMissed: '😱', totalPasses: '🔄', accuratePasses: '👟',
  passAccuracy: '🎯', keyPasses: '🔑', xA: '📐', touches: '🖐️', oppHalfPasses: '📥',
  crosses: '↗️', accurateCrosses: '↗️', dribbles: '💨', totalDribbles: '💨', dribbleSuccess: '💨',
  carries: '⏩', progressiveCarries: '⏭️', possessionLost: '❌', dispossessed: '❌', miscontrols: '❌',
  tackles: '🦵', successfulTackles: '🦵', interceptions: '🧤', recoveries: '♻️', clearances: '🛡️',
  blocks: '🧱', duelsWon: '⚔️', aerialDuelsWon: '🛩️', fouls: '🚫', yellowCards: '🟨', redCards: '🟥',
  distanceCovered: '🔋', sprints: '🏃', topSpeed: '⚡️', saves: '🧤', savesP90: '🧤', savePct: '🧤',
  cleanSheets: '🧱', leastConceded: '🚪', mostConceded: '🚪', shotsFaced: '🎯', goalsPrevented: '🛑',
  inForm: '🔥',
}

function rowsFor(players, tab, limit = 10) {
  return players.slice(0, limit).map((p) => ({
    name: p.name,
    flag: flagEmoji(p.flag_code),
    club: p.club,
    pos: p.position,
    value: tab.fmt(tab.fn(p)),
  }))
}

// Tweet-style caption (matches the stat-leaders post format).
export function buildLeaderboardCaption(categoryLabel, tab, players) {
  const emoji = TAB_EMOJI[tab.key] || '📊'
  const top = players.slice(0, 5)
  const lines = top.map((p, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`
    const pos = p.position ? ` (${p.position})` : ''
    return `${medal} ${flagEmoji(p.flag_code)} ${p.name}${pos} — ${tab.fmt(tab.fn(p))}`
  })
  const heading = tab.label.startsWith('In-Form') ? tab.label : `${tab.label} leaders`
  return `📊 ${heading} — #FIFAWorldCup\n\n${lines.join('\n')}\n\nvia pitchvision.app`
}

export function shareLeaderboardToX(categoryLabel, tab, players) {
  const text = buildLeaderboardCaption(categoryLabel, tab, players)
  return shareLeaderboardImage(categoryLabel, tab, players, text)
}

// ---- Branded leaderboard image ----
const W = 1080
const SCALE = 2

function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rad, y)
  ctx.arcTo(x + w, y, x + w, y + h, rad)
  ctx.arcTo(x + w, y + h, x, y + h, rad)
  ctx.arcTo(x, y + h, x, y, rad)
  ctx.arcTo(x, y, x + w, y, rad)
  ctx.closePath()
}

function txt(ctx, s, x, y, { size = 28, weight = 700, color = '#e2e8f0', align = 'left' } = {}) {
  ctx.font = `${weight} ${size}px Inter, Arial, sans-serif`
  ctx.fillStyle = color
  ctx.textAlign = align
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(String(s ?? ''), x, y)
}

export function createLeaderboardCanvas(categoryLabel, tab, players) {
  const rows = rowsFor(players, tab, 10)
  const top = 250
  const rowH = 84
  const H = top + rows.length * rowH + 70
  const canvas = document.createElement('canvas')
  canvas.width = W * SCALE
  canvas.height = H * SCALE
  const ctx = canvas.getContext('2d')
  ctx.scale(SCALE, SCALE)

  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#070b14'); bg.addColorStop(0.5, '#0a1120'); bg.addColorStop(1, '#0b1428')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  const P = 56
  txt(ctx, 'PITCHVISION', P, 80, { size: 26, weight: 900, color: '#7dd3fc' })
  txt(ctx, 'STAT LEADERS', W - P, 80, { size: 22, weight: 900, color: '#94a3b8', align: 'right' })
  txt(ctx, (TAB_EMOJI[tab.key] || '📊') + '  ' + tab.label, P, 150, { size: 52, weight: 900, color: '#ffffff' })
  txt(ctx, `${categoryLabel} · FIFA World Cup`, P, 192, { size: 24, weight: 700, color: '#94a3b8' })
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(P, 220); ctx.lineTo(W - P, 220); ctx.stroke()

  rows.forEach((r, i) => {
    const y = top + i * rowH
    if (i === 0) { rr(ctx, P - 12, y - 4, W - 2 * (P - 12), rowH - 12, 16); ctx.fillStyle = 'rgba(56,189,248,0.10)'; ctx.fill() }
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`
    txt(ctx, medal, P + 6, y + 44, { size: 30, weight: 900, color: i < 3 ? '#facc15' : '#64748b', align: 'center' })
    txt(ctx, `${r.flag}  ${r.name}`, P + 56, y + 44, { size: 30, weight: 800, color: '#ffffff' })
    const sub = [r.pos, r.club].filter(Boolean).join(' · ')
    if (sub) txt(ctx, sub, P + 56, y + 70, { size: 18, weight: 600, color: '#64748b' })
    txt(ctx, r.value, W - P, y + 50, { size: 34, weight: 900, color: '#38bdf8', align: 'right' })
  })

  txt(ctx, 'pitchvision.app', W / 2, H - 30, { size: 22, weight: 800, color: '#475569', align: 'center' })
  return canvas
}

function canvasToBlob(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png')
  })
}

export async function shareLeaderboardImage(categoryLabel, tab, players, text = buildLeaderboardCaption(categoryLabel, tab, players)) {
  const canvas = createLeaderboardCanvas(categoryLabel, tab, players)
  const blob = await canvasToBlob(canvas)
  const filename = `pitchvision-${tab.key}-leaders.png`

  if (blob) {
    const file = new File([blob], filename, { type: 'image/png' })
    const shareData = {
      title: `${tab.label} leaders`,
      text,
      files: [file],
    }

    if (navigator.canShare?.(shareData) && navigator.share) {
      try {
        await navigator.share(shareData)
        return
      } catch (error) {
        if (error?.name === 'AbortError') return
      }
    }
  }

  saveLeaderboardImage(categoryLabel, tab, players)
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`
  window.open(url, '_blank', 'noopener,noreferrer')
}

// Always open the X (Twitter) compose window with the caption prefilled, and
// download the image card so it can be attached. Unlike shareLeaderboardToX
// (which prefers the native share sheet), this is a dedicated "Post to X".
export function postLeaderboardToX(categoryLabel, tab, players, text = buildLeaderboardCaption(categoryLabel, tab, players)) {
  saveLeaderboardImage(categoryLabel, tab, players)
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`
  window.open(url, '_blank', 'noopener,noreferrer')
}

export function saveLeaderboardImage(categoryLabel, tab, players) {
  const canvas = createLeaderboardCanvas(categoryLabel, tab, players)
  const link = document.createElement('a')
  link.download = `pitchvision-${tab.key}-leaders.png`
  link.href = canvas.toDataURL('image/png')
  document.body.appendChild(link)
  link.click()
  link.remove()
}
