import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Trash2, X, Plus, Download, Share2 } from 'lucide-react'
import PageContainer from '../components/layout/PageContainer'
import PlayerAvatar from '../components/player/PlayerAvatar'
import PlayerSearch from '../components/player/PlayerSearch'
import CountryFlag from '../components/common/CountryFlag'
import Seo from '../components/common/Seo'
import { saveLineupImage, shareLineupToX } from '../utils/saveLineupImage'

// Outfield lines per formation (GK is always added separately).
const FORMATIONS = {
  '4-3-3': [4, 3, 3],
  '4-4-2': [4, 4, 2],
  '4-2-3-1': [4, 2, 3, 1],
  '4-3-1-2': [4, 3, 1, 2],
  '3-5-2': [3, 5, 2],
  '3-4-3': [3, 4, 3],
  '5-3-2': [5, 3, 2],
  '4-5-1': [4, 5, 1],
  '4-1-4-1': [4, 1, 4, 1],
}

const STORAGE_KEY = 'pitchvision_lineup_v1'

// Build slot coordinates (vertical pitch, attack up) for a formation.
function buildSlots(formationKey) {
  const lines = FORMATIONS[formationKey] ?? FORMATIONS['4-3-3']
  const slots = [{ id: 0, x: 50, y: 90, role: 'GK' }]
  const k = lines.length
  let idx = 1
  lines.forEach((count, lineIdx) => {
    const y = k > 1 ? 74 - lineIdx * (62 / (k - 1)) : 44
    for (let j = 0; j < count; j += 1) {
      slots.push({ id: idx, x: ((j + 1) / (count + 1)) * 100, y, role: 'OUT' })
      idx += 1
    }
  })
  return slots
}

export default function LineupBuilder() {
  const [formation, setFormation] = useState('4-3-3')
  const [picks, setPicks] = useState({}) // slotId -> player
  const [activeSlot, setActiveSlot] = useState(null)
  const [wcOnly, setWcOnly] = useState(false)
  const [dragId, setDragId] = useState(null)

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
      if (saved.formation && FORMATIONS[saved.formation]) setFormation(saved.formation)
      if (saved.picks) setPicks(saved.picks)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ formation, picks }))
    } catch { /* ignore */ }
  }, [formation, picks])

  const slots = useMemo(() => buildSlots(formation), [formation])
  const filled = slots.filter((s) => picks[s.id]).length
  const ratings = slots.map((s) => Number(picks[s.id]?.stats?.rating)).filter((r) => Number.isFinite(r) && r > 0)
  const avgRating = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2) : '—'

  const pickPlayer = (player) => {
    if (activeSlot == null) return
    setPicks((prev) => ({ ...prev, [activeSlot]: player }))
    setActiveSlot(null)
  }
  const removeSlot = (id) => setPicks((prev) => { const n = { ...prev }; delete n[id]; return n })
  const clearAll = () => setPicks({})
  const swapSlots = (a, b) => {
    if (a === b) return
    setPicks((prev) => {
      const n = { ...prev }
      const pa = n[a]; const pb = n[b]
      if (pb) n[a] = pb; else delete n[a]
      if (pa) n[b] = pa; else delete n[b]
      return n
    })
  }

  return (
    <div className="flex-1 min-w-0 bg-slate-50">
      <Seo
        title="Lineup Builder — Build Your Starting XI"
        description="Build your dream starting XI on a pitch. Pick a formation, search any player, and assemble your team on PitchVision."
        path="/line-builder"
      />

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">
            Lineup Builder
          </div>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Build your starting XI</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Pick a formation, tap a position, and search any player to fill your team.</p>
        </div>
      </section>

      <PageContainer>
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Pitch */}
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <select
                value={formation}
                onChange={(e) => setFormation(e.target.value)}
                aria-label="Formation"
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                {Object.keys(FORMATIONS).map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
              <span className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-600">{filled}/11 picked</span>
              <span className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-600">Avg {avgRating}</span>
              <label className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 shadow-sm">
                <input type="checkbox" checked={wcOnly} onChange={(e) => setWcOnly(e.target.checked)} className="accent-emerald-600" />
                World Cup only
              </label>
              <div className="ml-auto flex gap-2">
                <button type="button" onClick={() => shareLineupToX(formation, slots, picks)} disabled={filled === 0} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-950 px-3 py-2 text-sm font-bold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50">
                  <Share2 size={14} /> Share to X
                </button>
                <button type="button" onClick={() => saveLineupImage(formation, slots, picks)} disabled={filled === 0} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50">
                  <Download size={14} /> Save
                </button>
                <button type="button" onClick={clearAll} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 shadow-sm hover:bg-slate-50">
                  <Trash2 size={14} /> Clear
                </button>
              </div>
            </div>

            <div className="relative mx-auto aspect-[7/10] max-w-2xl overflow-hidden rounded-2xl border border-emerald-800/30 bg-[linear-gradient(180deg,#3f8f4f,#357a45)] shadow-inner">
              {/* pitch markings */}
              <div className="pointer-events-none absolute inset-3 rounded-xl border-2 border-white/40" />
              <div className="pointer-events-none absolute inset-x-3 top-1/2 h-0.5 -translate-y-1/2 bg-white/40" />
              <div className="pointer-events-none absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/40" />
              <div className="pointer-events-none absolute left-1/2 top-3 h-20 w-40 -translate-x-1/2 rounded-b-xl border-x-2 border-b-2 border-white/40" />
              <div className="pointer-events-none absolute bottom-3 left-1/2 h-20 w-40 -translate-x-1/2 rounded-t-xl border-x-2 border-t-2 border-white/40" />

              {slots.map((slot) => {
                const player = picks[slot.id]
                return (
                  <div
                    key={slot.id}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                    onDragOver={(e) => { if (dragId != null) e.preventDefault() }}
                    onDrop={(e) => { e.preventDefault(); if (dragId != null) { swapSlots(dragId, slot.id); setDragId(null) } }}
                  >
                    {player ? (
                      <div
                        className="flex flex-col items-center gap-1"
                        draggable
                        onDragStart={() => setDragId(slot.id)}
                        onDragEnd={() => setDragId(null)}
                      >
                        <div className="relative">
                          <button type="button" onClick={() => setActiveSlot(slot.id)} className="block cursor-grab rounded-full ring-2 ring-white/80 transition hover:scale-105 active:cursor-grabbing">
                            <PlayerAvatar player={player} size="md" />
                          </button>
                          <button type="button" onClick={() => removeSlot(slot.id)} aria-label="Remove" className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow">
                            <X size={11} />
                          </button>
                        </div>
                        <span className="max-w-[88px] truncate rounded bg-black/45 px-1.5 py-0.5 text-center text-[10px] font-black text-white">
                          {player.name}
                        </span>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setActiveSlot(slot.id)} className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-dashed border-white/70 bg-white/15 text-white transition hover:bg-white/30">
                        <Plus size={18} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Squad list */}
          <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-black uppercase tracking-[0.14em] text-slate-500">Squad</h2>
            <div className="space-y-1.5">
              {slots.map((slot) => {
                const player = picks[slot.id]
                return (
                  <div key={slot.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                    <span className="w-6 text-center text-[10px] font-black text-slate-400">{slot.role === 'GK' ? 'GK' : slot.id}</span>
                    {player ? (
                      <>
                        <PlayerAvatar player={player} size="sm" />
                        <div className="min-w-0 flex-1">
                          <Link to={`/player/${player.id}`} className="block truncate text-sm font-bold text-slate-950 hover:text-emerald-700">{player.name}</Link>
                          <p className="truncate text-[11px] text-slate-400">{player.club}</p>
                        </div>
                        <CountryFlag code={player.flag_code} nationality={player.nationality} size="xs" />
                      </>
                    ) : (
                      <button type="button" onClick={() => setActiveSlot(slot.id)} className="flex-1 text-left text-sm font-semibold text-slate-400 hover:text-emerald-700">Add player…</button>
                    )}
                  </div>
                )
              })}
            </div>
          </aside>
        </div>
      </PageContainer>

      {/* Player picker modal */}
      {activeSlot != null && (
        <div className="fixed inset-0 z-[120] flex items-start justify-center bg-slate-950/50 p-4 pt-24" onMouseDown={() => setActiveSlot(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-950">Add a player</h3>
              <button type="button" onClick={() => setActiveSlot(null)} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
            </div>
            <PlayerSearch onSelect={pickPlayer} placeholder={wcOnly ? 'Search World Cup players…' : 'Search any player…'} filter={wcOnly ? (p) => p.league === 'FIFA World Cup' : undefined} />
            <p className="mt-2 text-xs text-slate-400">{wcOnly ? 'Showing World Cup 2026 players only.' : 'Pick a player to fill this position.'}</p>
          </div>
        </div>
      )}
    </div>
  )
}
