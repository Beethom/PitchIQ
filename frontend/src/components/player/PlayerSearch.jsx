import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Clock, Search, X } from 'lucide-react'
import axios from 'axios'
import { playerService } from '../../services/playerService'
import PlayerAvatar from './PlayerAvatar'
import CountryFlag from '../common/CountryFlag'
import ClubLogo from '../common/ClubLogo'
import { dedupePlayers } from '../../utils/dedupePlayers'
import { getRecentlyViewed } from '../../utils/recentlyViewed'

export default function PlayerSearch({ onSelect, placeholder = 'Search players...', filter }) {
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen]       = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const [dropdownStyle, setDropdownStyle] = useState(null)
  const wrapperRef            = useRef(null)
  const dropdownRef           = useRef(null)
  const inputRef              = useRef(null)
  const requestRef            = useRef(0)

  const recentPlayers = getRecentlyViewed().slice(0, 5)
  const showRecents   = !query.trim() && open && recentPlayers.length > 0
  const displayList   = showRecents ? recentPlayers : results

  const updateDropdownPosition = () => {
    const node = inputRef.current
    if (!node) return
    const rect = node.getBoundingClientRect()
    const gutter = 8
    const width = Math.min(rect.width, window.innerWidth - gutter * 2)
    const left = Math.min(Math.max(rect.left, gutter), window.innerWidth - width - gutter)
    const availableBelow = window.innerHeight - rect.bottom - gutter * 2
    const availableAbove = rect.top - gutter * 2
    const opensAbove = availableBelow < 176 && availableAbove > availableBelow
    const maxHeight = Math.max(176, opensAbove ? availableAbove : availableBelow)

    setDropdownStyle({
      left,
      width,
      maxHeight,
      ...(opensAbove
        ? { bottom: window.innerHeight - rect.top + gutter, top: 'auto' }
        : { top: rect.bottom + gutter, bottom: 'auto' }),
    })
  }

  useEffect(() => {
    function handleClickOutside(e) {
      const clickedInput = wrapperRef.current?.contains(e.target)
      const clickedDropdown = dropdownRef.current?.contains(e.target)
      if (!clickedInput && !clickedDropdown) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!open) return
    updateDropdownPosition()
    window.addEventListener('resize', updateDropdownPosition)
    window.addEventListener('scroll', updateDropdownPosition, true)
    return () => {
      window.removeEventListener('resize', updateDropdownPosition)
      window.removeEventListener('scroll', updateDropdownPosition, true)
    }
  }, [open, query, displayList.length])

  useEffect(() => {
    setActiveIdx(-1)
    if (!query.trim()) { setResults([]); return }
    const controller = new AbortController()
    const requestId = requestRef.current + 1
    requestRef.current = requestId

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await playerService.search(query, { signal: controller.signal })
        if (requestRef.current !== requestId) return
        const scoped = typeof filter === 'function' ? data.filter(filter) : data
        setResults(dedupePlayers(scoped))
        setOpen(true)
      } catch (error) {
        if (axios.isCancel(error) || error.code === 'ERR_CANCELED') return
        if (requestRef.current === requestId) {
          setResults([])
          setOpen(true)
        }
      } finally {
        if (requestRef.current === requestId) setLoading(false)
      }
    }, 300)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  const handleSelect = (player) => {
    onSelect(player)
    setQuery('')
    setOpen(false)
    setResults([])
    setActiveIdx(-1)
  }

  const handleKeyDown = (e) => {
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, displayList.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, -1))
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault()
      handleSelect(displayList[activeIdx])
    } else if (e.key === 'Escape') {
      setOpen(false)
      inputRef.current?.blur()
    }
  }

  const showDropdown = open && (showRecents || results.length > 0 || loading || query.trim())

  return (
    <>
      <div ref={wrapperRef} className="relative w-full">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            ref={inputRef}
            className="input w-full pl-9 pr-8"
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
          />
          {query && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              onClick={() => { setQuery(''); setResults([]); setOpen(false) }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {showDropdown && createPortal(
        <ul
          ref={dropdownRef}
          style={dropdownStyle ?? undefined}
          className="fixed z-[100] overflow-y-auto overscroll-contain rounded-lg border border-slate-200 bg-white shadow-xl"
        >
          {showRecents && (
            <li className="flex items-center gap-1.5 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <Clock size={11} /> Recent
            </li>
          )}
          {loading && <li className="px-4 py-3 text-sm text-slate-500">Searching…</li>}
          {!loading && !showRecents && results.length === 0 && query.trim() && (
            <li className="px-4 py-3 text-sm text-slate-500">No players found</li>
          )}
          {displayList.map((player, idx) => (
            <li
              key={player.id}
              className={`flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors ${activeIdx === idx ? 'bg-sky-50' : 'hover:bg-sky-50'}`}
              onMouseDown={() => handleSelect(player)}
              onMouseEnter={() => setActiveIdx(idx)}
            >
              <PlayerAvatar player={player} size="sm" />

              <div className="flex-1 min-w-0">
                <div className="flex min-w-0 items-center gap-1.5">
                  <p className="truncate text-sm font-bold text-slate-950">{player.name}</p>
                  <span className="shrink-0">
                    <CountryFlag code={player.flag_code} nationality={player.nationality} size="xs" />
                  </span>
                </div>
                <div className="mt-0.5 flex min-w-0 items-center gap-1">
                  <span className="shrink-0">
                    <ClubLogo url={player.club_logo_url} club={player.club} size="xs" />
                  </span>
                  <p className="text-xs text-slate-500 truncate">{player.club}</p>
                </div>
              </div>

              {showRecents && (
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                  {player.position}
                </span>
              )}
            </li>
          ))}
        </ul>,
        document.body
      )}
    </>
  )
}
