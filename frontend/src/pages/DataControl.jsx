import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Activity,
  CheckCircle2,
  Database,
  Globe2,
  Play,
  RefreshCw,
  ShieldAlert,
  TimerReset,
  UserRound,
  Zap,
} from 'lucide-react'
import PageContainer from '../components/layout/PageContainer'
import Loader from '../components/common/Loader'
import ErrorMessage from '../components/common/ErrorMessage'
import SectionTitle from '../components/common/SectionTitle'
import PlayerSearch from '../components/player/PlayerSearch'
import { LEAGUES } from '../utils/constants'
import { adminService } from '../services/adminService'
import { playerService } from '../services/playerService'

const QUICK_GROUPS = [
  ['MLS', 'Liga MX, Clausura', 'CONCACAF Champions Cup'],
  ['Premier League', 'FA Cup', 'EFL Cup'],
  ['La Liga', 'Copa del Rey', 'UEFA Champions League'],
  ['Bundesliga', 'DFB Pokal', 'UEFA Champions League'],
  ['Serie A', 'Coppa Italia', 'UEFA Champions League'],
  ['Ligue 1', 'Coupe de France', 'UEFA Champions League'],
  ['FIFA World Cup', 'World Cup Qual. UEFA', 'World Cup Qual. CONMEBOL', 'World Cup Qual. CONCACAF'],
  ['Brasileirão Betano', 'CONMEBOL Libertadores', 'CONMEBOL Sudamericana'],
  ['Liga Profesional de Fútbol', 'Copa Argentina', 'Copa América'],
]

function StatusPill({ status }) {
  const map = {
    running: 'bg-amber-100 text-amber-800 border-amber-200',
    started: 'bg-sky-100 text-sky-800 border-sky-200',
    idle: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  }

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${map[status] ?? 'bg-slate-100 text-slate-700 border-slate-200'}`}>
      {status}
    </span>
  )
}

function MetricCard({ icon: Icon, label, value, sub }) {
  return (
    <div className="rounded-3xl border border-slate-200/70 bg-white/85 p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
        <Icon size={16} className="text-slate-400" />
      </div>
      <p className="mt-3 text-3xl font-black tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{sub}</p>
    </div>
  )
}

function CompetitionChip({ name, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-3 py-2 text-sm font-medium transition-all ${
        selected
          ? 'border-sky-300 bg-sky-50 text-sky-800 shadow-sm'
          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      {name}
    </button>
  )
}

export default function DataControl() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [nationalSubmitting, setNationalSubmitting] = useState(false)
  const [worldCupSubmitting, setWorldCupSubmitting] = useState(false)
  const [playerRepairSubmitting, setPlayerRepairSubmitting] = useState('')
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [repairMessage, setRepairMessage] = useState('')
  const [mode, setMode] = useState('incremental')
  const [dryRun, setDryRun] = useState(false)
  const [selectedCompetitions, setSelectedCompetitions] = useState(['MLS'])

  const selectedCount = selectedCompetitions.length

  const selectedLabel = useMemo(() => {
    if (!selectedCount) return 'all competitions'
    if (selectedCount <= 3) return selectedCompetitions.join(', ')
    return `${selectedCount} competitions`
  }, [selectedCompetitions, selectedCount])

  async function loadStatus() {
    try {
      setError('')
      const data = await adminService.getSyncStatus()
      setStatus(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStatus()
  }, [])

  useEffect(() => {
    if (status?.status !== 'running') return undefined
    const timer = setInterval(loadStatus, 3000)
    return () => clearInterval(timer)
  }, [status?.status])

  function toggleCompetition(name) {
    setSelectedCompetitions((current) =>
      current.includes(name)
        ? current.filter((item) => item !== name)
        : [...current, name],
    )
  }

  function applyQuickGroup(group) {
    setSelectedCompetitions(group)
  }

  async function handleStart() {
    try {
      setSubmitting(true)
      setError('')
      const payload = {
        competitions: selectedCompetitions,
        dry_run: dryRun,
      }
      const data = mode === 'full'
        ? await adminService.startFullSync(payload)
        : await adminService.startIncrementalSync(payload)

      setStatus(data)
      await loadStatus()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleNationalBackfill() {
    try {
      setNationalSubmitting(true)
      setError('')
      const data = await adminService.startNationalMatchBackfill({
        limit: 25,
        max_matches: 120,
        force: false,
      })
      setStatus(data)
      await loadStatus()
    } catch (err) {
      setError(err.message)
    } finally {
      setNationalSubmitting(false)
    }
  }

  async function handleWorldCupSync() {
    try {
      setWorldCupSubmitting(true)
      setError('')
      const data = await adminService.startIncrementalSync({
        competitions: ['FIFA World Cup'],
        dry_run: false,
      })
      setStatus(data)
      await loadStatus()
    } catch (err) {
      setError(err.message)
    } finally {
      setWorldCupSubmitting(false)
    }
  }

  async function handlePlayerRepair(kind) {
    if (!selectedPlayer?.id) return
    try {
      setPlayerRepairSubmitting(kind)
      setRepairMessage('')
      setError('')
      const result = kind === 'form'
        ? await playerService.syncForm(selectedPlayer.id)
        : await playerService.syncDefensive(selectedPlayer.id, 10)
      setRepairMessage(result?.message || `${selectedPlayer.name} repair complete.`)
    } catch (err) {
      setError(err?.response?.data?.detail || err.message)
    } finally {
      setPlayerRepairSubmitting('')
    }
  }

  if (loading) {
    return (
      <PageContainer title="Data Control" subtitle="Targeted sync tools for current competitions.">
        <Loader text="Loading sync controls…" />
      </PageContainer>
    )
  }

  return (
    <PageContainer title="Data Control" subtitle="Refresh one competition at a time so the database stays current without wasting API calls.">
      <div className="space-y-8">
        {error && <ErrorMessage message={error} onRetry={loadStatus} />}

        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-[32px] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_30%),linear-gradient(135deg,_#ffffff_0%,_#eef6ff_48%,_#f8fafc_100%)] shadow-sm"
        >
          <div className="grid gap-6 p-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-700">
                <Zap size={13} />
                Precision Sync
              </div>
              <div>
                <h2 className="text-3xl font-black tracking-tight text-slate-950">
                  Push only the competitions you need right now.
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                  Use incremental sync for recently completed fixtures and full sync for a targeted bootstrap.
                  The safest default is one competition at a time.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <MetricCard
                  icon={Activity}
                  label="Current Status"
                  value={status?.status ?? 'idle'}
                  sub={status?.message ?? 'Ready for a targeted refresh'}
                />
                <MetricCard
                  icon={Database}
                  label="Last Player Touch"
                  value={status?.players ?? 0}
                  sub="players touched in the latest sync result"
                />
                <MetricCard
                  icon={CheckCircle2}
                  label="Last Fixtures"
                  value={status?.fixtures ?? 0}
                  sub="fixtures imported by the latest sync result"
                />
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200/70 bg-white/85 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Live Run State</p>
                  <p className="mt-2 text-2xl font-black text-slate-950">Sync Monitor</p>
                </div>
                <StatusPill status={status?.status ?? 'idle'} />
              </div>

              <div className="mt-5 space-y-4 text-sm text-slate-600">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">Mode</p>
                  <p className="mt-1">{status?.mode ?? 'incremental'}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">Competition Scope</p>
                  <p className="mt-1">{status?.competitions?.length ? status.competitions.join(', ') : 'No active selection recorded'}</p>
                </div>
                <button
                  type="button"
                  onClick={loadStatus}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <RefreshCw size={15} />
                  Refresh status
                </button>
              </div>
            </div>
          </div>
        </motion.section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[28px] border border-slate-200/70 bg-white/90 p-6 shadow-sm">
            <SectionTitle
              title="Sync Launcher"
              subtitle="Choose a mode and only the competitions you want to refresh."
            />

            <div className="space-y-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Mode</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setMode('incremental')}
                    className={`rounded-3xl border p-4 text-left transition ${mode === 'incremental' ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-slate-50 hover:bg-white'}`}
                  >
                    <div className="flex items-center gap-2 text-slate-900">
                      <TimerReset size={16} />
                      <span className="font-semibold">Incremental</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">Best for keeping one competition current from recent fixtures.</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('full')}
                    className={`rounded-3xl border p-4 text-left transition ${mode === 'full' ? 'border-sky-300 bg-sky-50' : 'border-slate-200 bg-slate-50 hover:bg-white'}`}
                  >
                    <div className="flex items-center gap-2 text-slate-900">
                      <Database size={16} />
                      <span className="font-semibold">Full Bootstrap</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">Use sparingly when a competition needs a broader rebuild.</p>
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Quick Sets</p>
                    <p className="mt-1 text-sm text-slate-500">One-click bundles for the most common refresh groups.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedCompetitions([])}
                    className="text-sm font-medium text-slate-500 transition hover:text-slate-900"
                  >
                    Clear selection
                  </button>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {QUICK_GROUPS.map((group) => (
                    <button
                      key={group.join('|')}
                      type="button"
                      onClick={() => applyQuickGroup(group)}
                      className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-slate-300 hover:bg-white"
                    >
                      <p className="text-sm font-semibold text-slate-900">{group[0]}</p>
                      <p className="mt-1 text-xs leading-6 text-slate-500">{group.slice(1).join(' • ')}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Competition Selection</p>
                    <p className="mt-1 text-sm text-slate-500">Selected scope: {selectedLabel}</p>
                  </div>
                  <label className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={dryRun}
                      onChange={(event) => setDryRun(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    />
                    Dry run
                  </label>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {LEAGUES.map((competition) => (
                    <CompetitionChip
                      key={competition}
                      name={competition}
                      selected={selectedCompetitions.includes(competition)}
                      onClick={() => toggleCompetition(competition)}
                    />
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleStart}
                  disabled={submitting || status?.status === 'running'}
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? <RefreshCw size={15} className="animate-spin" /> : <Play size={15} />}
                  Start {mode === 'full' ? 'full' : 'incremental'} sync
                </button>
                <p className="text-sm text-slate-500">
                  {selectedCount
                    ? `This will target ${selectedLabel}.`
                    : 'Leaving selection empty will target every competition, which is much more expensive.'}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[28px] border border-slate-200/70 bg-white/90 p-6 shadow-sm">
              <SectionTitle
                title="Restricted Operations"
                subtitle="Admin-only repair actions hidden from regular player and World Cup screens."
              />
              <div className="grid gap-4">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">World Cup player rows</p>
                      <p className="mt-1 text-sm text-slate-500">Refresh official FIFA World Cup rows after the provider publishes match player stats.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleWorldCupSync}
                      disabled={worldCupSubmitting || status?.status === 'running'}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {worldCupSubmitting ? <RefreshCw size={15} className="animate-spin" /> : <Globe2 size={15} />}
                      Sync World Cup
                    </button>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-slate-900">
                    <UserRound size={16} />
                    <p className="font-semibold">Player profile repair</p>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">Run exact recent-form or defensive event repair for one selected player.</p>
                  <div className="mt-4">
                    <PlayerSearch
                      onSelect={(player) => {
                        setSelectedPlayer(player)
                        setRepairMessage('')
                      }}
                      placeholder="Search player to repair..."
                    />
                  </div>
                  {selectedPlayer && (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <p className="font-semibold text-slate-950">{selectedPlayer.name}</p>
                          <p className="mt-0.5 text-sm text-slate-500">{selectedPlayer.club} · {selectedPlayer.position} · {selectedPlayer.league}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handlePlayerRepair('form')}
                            disabled={!!playerRepairSubmitting}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-indigo-200 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <RefreshCw size={14} className={playerRepairSubmitting === 'form' ? 'animate-spin' : ''} />
                            Sync actual last 5
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePlayerRepair('defence')}
                            disabled={!!playerRepairSubmitting}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-emerald-200 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <ShieldAlert size={14} className={playerRepairSubmitting === 'defence' ? 'animate-pulse' : ''} />
                            Sync exact defence
                          </button>
                        </div>
                      </div>
                      {repairMessage && (
                        <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">{repairMessage}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200/70 bg-white/90 p-6 shadow-sm">
              <SectionTitle
                title="National Match Backfill"
                subtitle="Apply exact player-event logs to profiles still using national fallback rows."
              />
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleNationalBackfill}
                  disabled={nationalSubmitting || status?.status === 'running'}
                  className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {nationalSubmitting ? <RefreshCw size={15} className="animate-spin" /> : <Globe2 size={15} />}
                  Backfill next 25 players
                </button>
                <p className="text-sm text-slate-500">
                  Uses the same player-events sync as recent form and national profile splits.
                </p>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200/70 bg-white/90 p-6 shadow-sm">
              <SectionTitle
                title="Recommended Playbook"
                subtitle="How to keep data current without another 14k-call day."
              />
              <div className="space-y-4 text-sm leading-7 text-slate-600">
                <div className="rounded-3xl bg-emerald-50 p-4">
                  <p className="font-semibold text-emerald-900">1. Use incremental first</p>
                  <p className="mt-1">For active competitions like MLS, run incremental sync most of the time. It only looks at recent fixtures.</p>
                </div>
                <div className="rounded-3xl bg-sky-50 p-4">
                  <p className="font-semibold text-sky-900">2. Full sync only when needed</p>
                  <p className="mt-1">Bootstrap a competition once, or rerun it after a mapping fix. Don’t use full sync as the everyday refresh path.</p>
                </div>
                <div className="rounded-3xl bg-amber-50 p-4">
                  <p className="font-semibold text-amber-900">3. Avoid empty selection</p>
                  <p className="mt-1">An empty competition list means “all competitions,” which is the fastest way to burn through quota.</p>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200/70 bg-[linear-gradient(135deg,_#111827_0%,_#172554_100%)] p-6 text-white shadow-sm">
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-0.5 text-amber-300" size={18} />
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">Guardrail</p>
                  <p className="mt-2 text-lg font-semibold">Target one tournament or a tiny bundle at a time.</p>
                  <p className="mt-2 text-sm leading-7 text-slate-300">
                    That keeps your current-season data fresh while protecting quota for the next sync window.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </PageContainer>
  )
}
