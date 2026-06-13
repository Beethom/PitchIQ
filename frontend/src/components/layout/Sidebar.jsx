import { NavLink } from 'react-router-dom'
import { BarChart2, Bookmark, ClipboardList, Database, HelpCircle, Info, Mail, MessageSquare, Newspaper, Trophy, Users } from 'lucide-react'
import { useLanguage } from '../../i18n/LanguageProvider'
import { FR_TRANSLATIONS } from '../../i18n/translations'

const links = [
  { to: '/',        label: 'Dashboard', icon: BarChart2 },
  { to: '/world-cup', label: 'World Cup Mode', icon: Trophy },
  { to: '/scouting-board', label: 'Scouting Board', icon: ClipboardList },
  { to: '/compare', label: 'Compare',   icon: Users },
  { to: '/shortlists', label: 'Shortlists', icon: Bookmark },
]

const supportLinks = [
  { to: '/about', label: 'About Us', icon: Info },
  { to: '/how-it-works', label: 'How to Use', icon: HelpCircle },
  { to: '/faq', label: 'FAQ', icon: HelpCircle },
  { to: '/coverage', label: 'Data Coverage', icon: Database },
  { to: '/methodology', label: 'Methodology', icon: ClipboardList },
  { to: '/updates', label: 'Updates', icon: Newspaper },
  { to: '/request-demo', label: 'Request Demo', icon: MessageSquare },
  { to: '/contact', label: 'Contact', icon: Mail },
]

export default function Sidebar() {
  const { language } = useLanguage()
  const text = (value) => (language === 'fr' ? FR_TRANSLATIONS[value] || value : value)

  return (
    <aside className="hidden min-h-screen w-56 shrink-0 flex-col border-r border-slate-200/80 bg-white/68 pb-4 pt-6 backdrop-blur-xl lg:flex">
      <nav className="flex-1 px-3 space-y-1">
        <p className="mb-3 px-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
          {text('Menu')}
        </p>
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold transition-colors ${
                isActive
                  ? 'border border-slate-950 bg-slate-950 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-950'
              }`
            }
          >
            <Icon size={17} />
            {text(label)}
          </NavLink>
        ))}
        <p className="mb-3 mt-7 px-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
          {text('Support')}
        </p>
        {supportLinks.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold transition-colors ${
                isActive
                  ? 'border border-slate-950 bg-slate-950 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-950'
              }`
            }
          >
            <Icon size={17} />
            {text(label)}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
