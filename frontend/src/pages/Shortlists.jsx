import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bookmark, Check, GitCompareArrows, Trash2 } from 'lucide-react'
import PageContainer from '../components/layout/PageContainer'
import PlayerCard from '../components/player/PlayerCard'
import { SHORTLISTS, clearShortlist, getShortlists, removePlayerFromShortlist } from '../utils/shortlists'

export default function Shortlists() {
  const [active, setActive] = useState(SHORTLISTS[0])
  const [store, setStore] = useState(() => getShortlists())
  const [selectedIds, setSelectedIds] = useState([])

  useEffect(() => {
    const refresh = () => setStore(getShortlists())
    window.addEventListener('pitchiq:shortlists-updated', refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener('pitchiq:shortlists-updated', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  const players = store[active] || []
  const selectedPlayers = players.filter((player) => selectedIds.includes(player.id))
  const compareHref = selectedPlayers.length === 2
    ? `/compare?playerA=${selectedPlayers[0].id}&playerB=${selectedPlayers[1].id}`
    : '/compare'

  function switchList(list) {
    setActive(list)
    setSelectedIds([])
  }

  function toggleSelected(playerId) {
    setSelectedIds((current) => {
      if (current.includes(playerId)) return current.filter((id) => id !== playerId)
      return [...current, playerId].slice(-2)
    })
  }

  function removeSaved(playerId) {
    setSelectedIds((current) => current.filter((id) => id !== playerId))
    removePlayerFromShortlist(active, playerId)
  }

  function clearActiveList() {
    setSelectedIds([])
    clearShortlist(active)
  }

  return (
    <div className="flex-1 min-w-0">
      <div className="bg-gradient-to-r from-emerald-600 via-sky-600 to-indigo-600 px-4 py-8 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Saved Players</p>
          <h1 className="mt-2 text-3xl font-black">Shortlists</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/75">
            Keep players organized for later scouting, transfer review, and comparisons.
          </p>
        </div>
      </div>

      <PageContainer>
        <div className="space-y-6">
          <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {SHORTLISTS.map((list) => (
                <button
                  key={list}
                  type="button"
                  onClick={() => switchList(list)}
                  className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                    active === list
                      ? 'border-slate-950 bg-slate-950 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {list} ({(store[list] || []).length})
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {selectedPlayers.length === 2 ? (
                <Link
                  to={compareHref}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  <GitCompareArrows size={15} />
                  Compare selected
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-400"
                >
                  <GitCompareArrows size={15} />
                  Select 2 to compare
                </button>
              )}
              <button
                type="button"
                onClick={clearActiveList}
                disabled={!players.length}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-500 transition hover:border-red-200 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 size={14} />
                Clear {active}
              </button>
            </div>
          </div>

          {!!players.length && (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
              {selectedPlayers.length ? (
                <span>
                  Selected: <strong className="text-slate-950">{selectedPlayers.map((player) => player.name).join(' vs ')}</strong>
                </span>
              ) : (
                <span>Select two saved players to compare them instantly.</span>
              )}
            </div>
          )}

          {!players.length ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-20 text-center">
              <div className="rounded-2xl bg-emerald-50 p-4 text-emerald-600">
                <Bookmark size={28} />
              </div>
              <p className="mt-4 font-semibold text-slate-800">No players saved in {active}</p>
              <p className="mt-1 text-sm text-slate-400">Use Save on any player card or profile.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3">
              {players.map((player) => (
                <div key={player.id} className="relative">
                  <button
                    type="button"
                    onClick={() => toggleSelected(player.id)}
                    className={`absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-black shadow-lg transition ${
                      selectedIds.includes(player.id)
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white/90 text-slate-600 hover:text-slate-950'
                    }`}
                    title={`Select ${player.name} for comparison`}
                  >
                    {selectedIds.includes(player.id) && <Check size={13} />}
                    {selectedIds.includes(player.id) ? 'Selected' : 'Select'}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSaved(player.id)}
                    className="absolute right-3 top-3 z-10 rounded-full bg-white/90 p-2 text-slate-400 shadow-lg transition hover:text-red-600"
                    title={`Remove from ${active}`}
                  >
                    <Trash2 size={14} />
                  </button>
                  <PlayerCard player={player} />
                </div>
              ))}
            </div>
          )}
        </div>
      </PageContainer>
    </div>
  )
}
