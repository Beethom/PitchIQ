import { NavLink } from 'react-router-dom'
import { BarChart2, Bookmark, ClipboardList, HelpCircle, Info, MessageSquare, Trophy, Users, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { useLanguage } from '../../i18n/LanguageProvider'
import { FR_TRANSLATIONS } from '../../i18n/translations'

const links = [
  { to: '/',        label: 'Dashboard', icon: BarChart2 },
  { to: '/world-cup', label: 'World Cup', icon: Trophy },
  { to: '/scouting-board', label: 'Scouting', icon: ClipboardList },
  { to: '/compare', label: 'Compare',   icon: Users },
  { to: '/shortlists', label: 'Shortlists', icon: Bookmark },
  { to: '/about', label: 'About Us', icon: Info },
  { to: '/how-it-works', label: 'How to Use', icon: HelpCircle },
  { to: '/request-demo', label: 'Request Demo', icon: MessageSquare },
]

function LangToggle() {
  const { language, toggleLanguage } = useLanguage()
  const fr = language === 'fr'

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${
        fr
          ? 'border-blue-600 bg-blue-600 text-white'
          : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-800'
      }`}
    >
      {fr ? '🇺🇸 EN' : '🇫🇷 FR'}
    </button>
  )
}

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { language } = useLanguage()
  const text = (value) => (language === 'fr' ? FR_TRANSLATIONS[value] || value : value)

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/86 shadow-[0_12px_36px_-32px_rgba(15,23,42,0.75)] backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <NavLink to="/" className="flex items-center gap-2 shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-950 shadow-sm">
              <span className="text-white font-bold text-sm">IQ</span>
            </div>
            <span className="text-lg font-black tracking-tight text-slate-950">
              PitchIQ
            </span>
          </NavLink>

          {/* Desktop nav */}
          <nav className="hidden xl:flex items-center gap-1">
            {links.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
                    isActive
                      ? 'bg-slate-950 text-white shadow-sm'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-950'
                  }`
                }
              >
                <Icon size={16} />
                {text(label)}
              </NavLink>
            ))}
          </nav>

          <LangToggle />

          {/* Mobile toggle */}
          <button
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 xl:hidden"
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="space-y-1 border-t border-slate-200/70 bg-white/92 px-4 py-3 xl:hidden">
          <div className="px-3 pb-2">
            <LangToggle />
          </div>
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
                  isActive
                    ? 'bg-slate-950 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                }`
              }
            >
              <Icon size={16} />
              {text(label)}
            </NavLink>
          ))}
        </div>
      )}
    </header>
  )
}
