import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Trash2, X, Plus, Download, Share2, Sparkles, Link2 } from 'lucide-react'
import PageContainer from '../components/layout/PageContainer'
import PlayerAvatar from '../components/player/PlayerAvatar'
import PlayerSearch from '../components/player/PlayerSearch'
import CountryFlag from '../components/common/CountryFlag'
import Seo from '../components/common/Seo'
import { saveLineupImage, shareLineupToX } from '../utils/saveLineupImage'
import { usePlayers } from '../hooks/usePlayers'
import api from '../services/api'

const FORMATIONS = {
  '4-3-3': [4, 3, 3], '4-4-2': [4, 4, 2], '4-2-3-1': [4, 2, 3, 1],
  '4-3-1-2': [4, 3, 1, 2], '4-1-2-1-2': [4, 1, 2, 1, 2], '4-4-1-1': [4, 4, 1, 1],
  '4-2-2-2': [4, 2, 2, 2], '3-5-2': [3, 5, 2], '3-4-3': [3, 4, 3],
  '3-4-2-1': [3, 4, 2, 1], '3-4-1-2': [3, 4, 1, 2], '3-1-4-2': [3, 1, 4, 2],
  '5-3-2': [5, 3, 2], '5-4-1': [5, 4, 1], '5-2-3': [5, 2, 3],
  '4-5-1': [4, 5, 1], '4-1-4-1': [4, 1, 4, 1],
}

const THEMES = {
  emerald: { name: 'Emerald', pitch: 'linear-gradient(180deg,#3f8f4f,#357a45)', solid: '#357a45', ring: '#ffffff', accent: '#10b981' },
  sky: { name: 'Sky', pitch: 'linear-gradient(180deg,#1f6feb,#0b4aa2)', solid: '#0b4aa2', ring: '#e0f2fe', accent: '#38bdf8' },
  crimson: { name: 'Crimson', pitch: 'linear-gradient(180deg,#9f1239,#7f1d1d)', solid: '#7f1d1d', ring: '#fee2e2', accent: '#fb7185' },
  night: { name: 'Night', pitch: 'linear-gradient(180deg,#1e293b,#0f172a)', solid: '#1e293b', ring: '#cbd5e1', accent: '#a78bfa' },
  gold: { name: 'Gold', pitch: 'linear-gradient(180deg,#a16207,#713f12)', solid: '#7a4a12', ring: '#fef9c3', accent: '#facc15' },
}

const POS_GROUPS = {
  GK: ['GK'], DEF: ['CB', 'LB', 'RB'], MID: ['CDM', 'CM', 'CAM', 'LM', 'RM'], FWD: ['LW', 'RW', 'ST', 'CF'],
}

const STORAGE_KEY = 'pitchvision_lineup_v1'
const BENCH_SIZE = 7

function roleLabel(group, count, j, lineIdx, lastLine) {
  if (group === 'GK') return 'GK'
  if (group === 'DEF') {
    if (count >= 5 && j === 0) return 'LWB'
    if (count >= 4 && j === 0) return 'LB'
    if (count >= 4 && j === count - 1) return 'RB'
    return 'CB'
  }
  if (group === 'FWD') {
    if (count >= 3 && j === 0) return 'LW'
    if (count >= 3 && j === count - 1) return 'RW'
    return 'ST'
  }
  if (count >= 4 && j === 0) return 'LM'
  if (count >= 4 && j === count - 1) return 'RM'
  return lineIdx === lastLine - 1 ? 'CAM' : 'CM'
}

function buildSlots(formationKey) {
  const lines = FORMATIONS[formationKey] ?? FORMATIONS['4-3-3']
  const slots = [{ id: 0, x: 50, y: 90, group: 'GK', label: 'GK' }]
  const k = lines.length
  let idx = 1
  lines.forEach((count, lineIdx) => {
    const y = k > 1 ? 74 - lineIdx * (62 / (k - 1)) : 44
    const group = lineIdx === 0 ? 'DEF' : lineIdx === k - 1 ? 'FWD' : 'MID'
    for (let j = 0; j < count; j += 1) {
      slots.push({ id: idx, x: ((j + 1) / (count + 1)) * 100, y, group, label: roleLabel(group, count, j, lineIdx + 1, k) })
      idx += 1
    }
  })
  return slots
}

export default function LineupBuilder() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [formation, setFormation] = useState('4-3-3')
  const [picks, setPicks] = useState({})        // pitch slotId -> player
  const [bench, setBench] = useState({})         // bench idx -> player
  const [active, setActive] = useState(null)     // { kind:'pitch'|'bench', id }
  const [drag, setDrag] = useState(null)         // { kind, id }
  const [wcOnly, setWcOnly] = useState(false)
  const [xiName, setXiName] = useState('')
  const [captain, setCaptain] = useState(null)
  const [theme, setTheme] = useState('emerald')
  const [shareLink, setShareLink] = useState('')
  const [savingLink, setSavingLink] = useState(false)
  const { players: wcPool } = usePlayers({ league: 'FIFA World Cup', season: '2026', limit: 2000 })

  // Load a shared lineup from ?xi=, else from localStorage.
  useEffect(() => {
    const xi = searchParams.get('xi')
    if (xi) {
      api.get(`/lineups/${xi}`).then(({ data }) => {
        if (data.formation && FORMATIONS[data.formation]) setFormation(data.formation)
        setPicks(data.picks || {})
        setBench(data.bench || {})
        setXiName(data.xiName || '')
        setCaptain(data.captain ?? null)
        if (THEMES[data.theme]) setTheme(data.theme)
      }).catch(() => {})
      return
    }
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
      if (saved.formation && FORMATIONS[saved.formation]) setFormation(saved.formation)
      if (saved.picks) setPicks(saved.picks)
      if (saved.bench) setBench(saved.bench)
      if (saved.xiName) setXiName(saved.xiName)
      if (saved.captain != null) setCaptain(saved.captain)
      if (THEMES[saved.theme]) setTheme(saved.theme)
    } catch { /* ignore */ }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ formation, picks, bench, xiName, captain, theme })) } catch { /* ignore */ }
    setShareLink('')
  }, [formation, picks, bench, xiName, captain, theme])

  const slots = useMemo(() => buildSlots(formation), [formation])
  const filled = slots.filter((s) => picks[s.id]).length
  const ratings = slots.map((s) => Number(picks[s.id]?.stats?.rating)).filter((r) => Number.isFinite(r) && r > 0)
  const avgRating = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2) : '—'
  const ratingColor = (r) => (r >= 8 ? 'bg-emerald-600' : r >= 7 ? 'bg-emerald-500' : r >= 6 ? 'bg-amber-500' : 'bg-slate-500')
  const th = THEMES[theme]

  const getP = (kind, id) => (kind === 'pitch' ? picks[id] : bench[id])
  const setP = (kind, id, player) => {
    const setter = kind === 'pitch' ? setPicks : setBench
    setter((prev) => { const n = { ...prev }; if (player) n[id] = player; else delete n[id]; return n })
  }
  const pickPlayer = (player) => {
    if (!active) return
    setP(active.kind, active.id, player)
    setActive(null)
  }
  const dndSwap = (sk, si, dk, di) => {
    if (sk === dk && si === di) return
    const sp = getP(sk, si); const dp = getP(dk, di)
    setP(dk, di, sp); setP(sk, si, dp)
  }
  const removeAt = (kind, id) => setP(kind, id, null)
  const clearAll = () => { setPicks({}); setBench({}); setCaptain(null) }

  const autoFill = () => {
    if (!wcPool.length) return
    const used = new Set(); const next = {}
    const bestFor = (groups) => {
      const c = wcPool.filter((p) => groups.includes(p.position) && !used.has(p.id) && (p.stats?.rating ?? 0) > 0)
        .sort((a, b) => (b.stats?.rating ?? 0) - (a.stats?.rating ?? 0))[0]
      if (c) used.add(c.id); return c
    }
    slots.forEach((s) => { const p = bestFor(POS_GROUPS[s.group] || POS_GROUPS.MID) || bestFor(Object.values(POS_GROUPS).flat()); if (p) next[s.id] = p })
    setPicks(next); setCaptain(null)
  }

  const copyShareLink = async () => {
    setSavingLink(true)
    try {
      const { data } = await api.post('/lineups/', { formation, picks, bench, xiName, captain, theme })
      const url = `https://www.pitchvision.app/line-builder?xi=${data.id}`
      setShareLink(url)
      try { await navigator.clipboard.writeText(url) } catch { /* clipboard blocked */ }
    } catch { setShareLink('error') } finally { setSavingLink(false) }
  }

  const Chip = ({ kind, id, player, label }) => (
    <div
      onDragOver={(e) => { if (drag) e.preventDefault() }}
      onDrop={(e) => { e.preventDefault(); if (drag) { dndSwap(drag.kind, drag.id, kind, id); setDrag(null) } }}
    >
      {player ? (
        <div className="flex flex-col items-center gap-1" draggable onDragStart={() => setDrag({ kind, id })} onDragEnd={() => setDrag(null)}>
          <div className="relative">
            <button type="button" onClick={() => setActive({ kind, id })} className="block cursor-grab rounded-full transition hover:scale-105 active:cursor-grabbing" style={{ boxShadow: `0 0 0 2px ${th.ring}` }}>
              <PlayerAvatar player={player} size="md" />
            </button>
            {Number(player.stats?.rating) > 0 && (
              <span className={`absolute -left-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-black text-white ring-1 ring-white ${ratingColor(Number(player.stats.rating))}`}>
                {Number(player.stats.rating).toFixed(1)}
              </span>
            )}
            {kind === 'pitch' && (
              <button type="button" onClick={(e) => { e.stopPropagation(); setCaptain((c) => (c === id ? null : id)) }} aria-label="Captain"
                className={`absolute -bottom-1 -left-1 flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-black ring-1 ring-white shadow ${captain === id ? 'bg-yellow-400 text-slate-900' : 'bg-slate-900/70 text-white'}`}>C</button>
            )}
            <button type="button" onClick={() => removeAt(kind, id)} aria-label="Remove" className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow"><X size={11} /></button>
          </div>
          <span className="max-w-[88px] truncate rounded bg-black/45 px-1.5 py-0.5 text-center text-[10px] font-black text-white">{player.name}</span>
        </div>
      ) : (
        <button type="button" onClick={() => setActive({ kind, id })} className="flex flex-col items-center justify-center gap-0.5 rounded-full border-2 border-dashed border-white/70 bg-white/15 text-white transition hover:bg-white/30" style={{ width: 48, height: 48 }}>
          <Plus size={16} />
          {label && <span className="text-[8px] font-black leading-none">{label}</span>}
        </button>
      )}
    </div>
  )

  return (
    <div className="flex-1 min-w-0 bg-slate-50">
      <Seo title="Lineup Builder — Build Your Starting XI" description="Build your dream starting XI on a pitch. Pick a formation, search any player, auto-fill, and share your team on PitchVision." path="/line-builder" />

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">Lineup Builder</div>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Build your starting XI</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Pick a formation, tap a position, drag to swap, auto-fill the best XI, add a bench, then save or share it.</p>
          <input value={xiName} onChange={(e) => setXiName(e.target.value)} maxLength={40} placeholder="Name your XI (e.g. My Dream Team)" className="mt-4 w-full max-w-md rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
        </div>
      </section>

      <PageContainer>
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <select value={formation} onChange={(e) => setFormation(e.target.value)} aria-label="Formation" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
                {Object.keys(FORMATIONS).map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
              <span className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-600">{filled}/11</span>
              <span className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-600">Avg {avgRating}</span>
              <label className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 shadow-sm">
                <input type="checkbox" checked={wcOnly} onChange={(e) => setWcOnly(e.target.checked)} className="accent-emerald-600" /> WC only
              </label>
              <button type="button" onClick={autoFill} disabled={!wcPool.length} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"><Sparkles size={14} /> Auto-fill</button>
              {/* theme swatches */}
              <div className="flex items-center gap-1.5">
                {Object.entries(THEMES).map(([key, t]) => (
                  <button key={key} type="button" onClick={() => setTheme(key)} title={t.name} aria-label={t.name}
                    className={`h-7 w-7 rounded-full border-2 ${theme === key ? 'border-slate-900' : 'border-white'} shadow`} style={{ background: t.pitch }} />
                ))}
              </div>
            </div>

            <div className="mb-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => shareLineupToX(formation, slots, picks, xiName)} disabled={filled === 0} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-950 px-3 py-2 text-sm font-bold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"><Share2 size={14} /> Share to X</button>
              <button type="button" onClick={() => saveLineupImage(formation, slots, picks, { name: xiName, captain, theme: th })} disabled={filled === 0} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"><Download size={14} /> Save image</button>
              <button type="button" onClick={copyShareLink} disabled={filled === 0 || savingLink} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"><Link2 size={14} /> {savingLink ? 'Saving…' : 'Copy link'}</button>
              <button type="button" onClick={clearAll} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 shadow-sm hover:bg-slate-50"><Trash2 size={14} /> Clear</button>
              {shareLink && shareLink !== 'error' && <span className="self-center truncate text-xs font-bold text-emerald-700">Link copied!</span>}
              {shareLink === 'error' && <span className="self-center text-xs font-bold text-red-600">Could not create link</span>}
            </div>

            <div className="relative mx-auto aspect-[7/10] max-w-2xl overflow-hidden rounded-2xl border border-emerald-800/30 shadow-inner" style={{ background: th.pitch }}>
              <div className="pointer-events-none absolute inset-3 rounded-xl border-2 border-white/40" />
              <div className="pointer-events-none absolute inset-x-3 top-1/2 h-0.5 -translate-y-1/2 bg-white/40" />
              <div className="pointer-events-none absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/40" />
              <div className="pointer-events-none absolute left-1/2 top-3 h-20 w-40 -translate-x-1/2 rounded-b-xl border-x-2 border-b-2 border-white/40" />
              <div className="pointer-events-none absolute bottom-3 left-1/2 h-20 w-40 -translate-x-1/2 rounded-t-xl border-x-2 border-t-2 border-white/40" />
              {slots.map((slot) => (
                <div key={slot.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${slot.x}%`, top: `${slot.y}%` }}>
                  <Chip kind="pitch" id={slot.id} player={picks[slot.id]} label={slot.label} />
                </div>
              ))}
            </div>

            {/* Bench */}
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-black uppercase tracking-[0.14em] text-slate-500">Bench</h2>
              <div className="flex flex-wrap gap-4">
                {Array.from({ length: BENCH_SIZE }).map((_, i) => (
                  <Chip key={i} kind="bench" id={i} player={bench[i]} label="SUB" />
                ))}
              </div>
            </div>
          </div>

          {/* Squad list */}
          <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-black uppercase tracking-[0.14em] text-slate-500">Starting XI</h2>
            <div className="space-y-1.5">
              {slots.map((slot) => {
                const player = picks[slot.id]
                return (
                  <div key={slot.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                    <span className="w-8 text-center text-[10px] font-black text-slate-400">{slot.label}</span>
                    {player ? (
                      <>
                        <PlayerAvatar player={player} size="sm" />
                        <div className="min-w-0 flex-1">
                          <Link to={`/player/${player.id}`} className="block truncate text-sm font-bold text-slate-950 hover:text-emerald-700">{player.name}</Link>
                          <p className="truncate text-[11px] text-slate-400">{player.club}</p>
                        </div>
                        {captain === slot.id && <span className="rounded bg-yellow-400 px-1 text-[9px] font-black text-slate-900">C</span>}
                        <CountryFlag code={player.flag_code} nationality={player.nationality} size="xs" />
                      </>
                    ) : (
                      <button type="button" onClick={() => setActive({ kind: 'pitch', id: slot.id })} className="flex-1 text-left text-sm font-semibold text-slate-400 hover:text-emerald-700">Add player…</button>
                    )}
                  </div>
                )
              })}
            </div>
          </aside>
        </div>
      </PageContainer>

      {active && (
        <div className="fixed inset-0 z-[120] flex items-start justify-center bg-slate-950/50 p-4 pt-24" onMouseDown={() => setActive(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-950">Add a player{active.kind === 'bench' ? ' (bench)' : ''}</h3>
              <button type="button" onClick={() => setActive(null)} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
            </div>
            <PlayerSearch onSelect={pickPlayer} placeholder={wcOnly ? 'Search World Cup players…' : 'Search any player…'} filter={wcOnly ? (p) => p.league === 'FIFA World Cup' : undefined} />
            <p className="mt-2 text-xs text-slate-400">{wcOnly ? 'Showing World Cup 2026 players only.' : 'Pick a player to fill this spot.'}</p>
          </div>
        </div>
      )}
    </div>
  )
}
