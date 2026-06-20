import { localMediaUrl } from './mediaUrl'

const W = 1080
const H = 1350
const SCALE = 2

async function loadImg(url) {
  if (!url) return null
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const obj = URL.createObjectURL(await res.blob())
    try { const im = new Image(); im.src = obj; await im.decode(); return im } finally { URL.revokeObjectURL(obj) }
  } catch { return null }
}

function initials(name = '') {
  return String(name).split(/\s+/).filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase() || '?'
}

export async function saveLineupImage(formation, slots, picks, opts = {}) {
  const { name = '', captain = null, theme = {} } = opts
  const pitchColor = theme.solid || '#357a45'
  const ringColor = theme.ring || '#ffffff'
  const canvas = document.createElement('canvas')
  canvas.width = W * SCALE
  canvas.height = H * SCALE
  const ctx = canvas.getContext('2d')
  ctx.scale(SCALE, SCALE)
  const txt = (s, x, y, { size = 24, weight = 700, color = '#fff', align = 'left' } = {}) => {
    ctx.font = `${weight} ${size}px Inter, Arial, sans-serif`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'
    ctx.fillText(String(s ?? ''), x, y)
  }

  ctx.fillStyle = '#0b1428'; ctx.fillRect(0, 0, W, H)
  txt('PITCHVISION', 48, 56, { size: 30, weight: 900, color: '#38bdf8' })
  txt(formation, W - 48, 60, { size: 30, weight: 900, align: 'right' })
  txt((name || 'MY STARTING XI').toUpperCase(), 48, 92, { size: 22, weight: 800, color: '#94a3b8' })

  // pitch
  const px = 60; const py = 150; const pw = W - 120; const ph = H - 230
  ctx.fillStyle = pitchColor
  ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 18); ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2
  ctx.strokeRect(px + 16, py + 16, pw - 32, ph - 32)
  ctx.beginPath(); ctx.moveTo(px + 16, py + ph / 2); ctx.lineTo(px + pw - 16, py + ph / 2); ctx.stroke()
  ctx.beginPath(); ctx.arc(px + pw / 2, py + ph / 2, 60, 0, Math.PI * 2); ctx.stroke()

  // photos
  const imgs = await Promise.all(slots.map((s) => {
    const p = picks[s.id]
    if (!p) return null
    return loadImg(localMediaUrl(p.photo_url || (p.source_player_id ? `/api/media/player/${p.source_player_id}/image` : '')))
  }))

  slots.forEach((s, i) => {
    const cx = px + 16 + (s.x / 100) * (pw - 32)
    const cy = py + 16 + (s.y / 100) * (ph - 32)
    const r = 30
    const p = picks[s.id]
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath()
    ctx.fillStyle = '#0b1428'; ctx.fill(); ctx.clip()
    if (p && imgs[i]) {
      const im = imgs[i]; const ratio = im.width / im.height
      let sw = im.width, sh = im.height, sx = 0, sy = 0
      if (ratio > 1) { sw = im.height; sx = (im.width - sw) / 2 } else { sh = im.width; sy = Math.max(0, (im.height - sh) * 0.15) }
      ctx.drawImage(im, sx, sy, sw, sh, cx - r, cy - r, r * 2, r * 2)
    } else if (p) {
      txt(initials(p.name), cx, cy + 8, { size: 22, weight: 900, align: 'center', color: '#cbd5e1' })
    } else {
      txt('+', cx, cy + 9, { size: 26, weight: 900, align: 'center', color: '#94a3b8' })
    }
    ctx.restore()
    ctx.strokeStyle = ringColor; ctx.lineWidth = 3
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()
    if (p && captain === s.id) {
      ctx.fillStyle = '#facc15'
      ctx.beginPath(); ctx.arc(cx - r + 4, cy - r + 4, 11, 0, Math.PI * 2); ctx.fill()
      txt('C', cx - r + 4, cy - r + 9, { size: 13, weight: 900, align: 'center', color: '#0f172a' })
    }
    if (p) {
      const short = p.name.split(' ').slice(-1)[0]
      ctx.font = '800 20px Inter, Arial, sans-serif'
      const w = ctx.measureText(short).width + 14
      ctx.fillStyle = 'rgba(0,0,0,0.5)'
      ctx.beginPath(); ctx.roundRect(cx - w / 2, cy + r + 6, w, 26, 8); ctx.fill()
      txt(short, cx, cy + r + 24, { size: 20, weight: 800, align: 'center' })
    }
  })

  txt('Build yours at pitchvision.app', W / 2, H - 36, { size: 22, weight: 800, color: '#64748b', align: 'center' })

  const link = document.createElement('a')
  link.download = `pitchvision-xi-${formation}.png`
  link.href = canvas.toDataURL('image/png')
  document.body.appendChild(link); link.click(); link.remove()
}

export function shareLineupToX(formation, slots, picks, name = '') {
  const ids = slots.map((s) => picks[s.id]?.id || 0).join(',')
  const named = slots.filter((s) => picks[s.id]).map((s) => picks[s.id].name)
  const title = name ? `${name} (${formation})` : `My ${formation} XI`
  const text = `${title} ⚽\n\n${named.join(', ')}\n\nBuild yours 👇`
  const v = Date.now().toString(36)
  const shareUrl = `https://www.pitchvision.app/share/xi?f=${encodeURIComponent(formation)}&p=${ids}&v=${v}`
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`, '_blank', 'noopener,noreferrer')
}
