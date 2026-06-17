import { Link } from 'react-router-dom'
import { useLanguage } from '../../i18n/LanguageProvider'
import { FR_TRANSLATIONS } from '../../i18n/translations'

const productLinks = [
  { to: '/', label: 'Dashboard' },
  { to: '/world-cup', label: 'World Cup' },
  { to: '/scouting-board', label: 'Scouting Board' },
  { to: '/compare', label: 'Compare Players' },
  { to: '/coverage', label: 'Data Coverage' },
  { to: '/methodology', label: 'Methodology' },
]

const companyLinks = [
  { to: '/about', label: 'About Us' },
  { to: '/how-it-works', label: 'How to Use' },
  { to: '/faq', label: 'FAQ' },
  { to: '/updates', label: 'Updates' },
  { to: '/request-demo', label: 'Request Demo' },
  { to: '/contact', label: 'Contact' },
]

const legalLinks = [
  { to: '/privacy', label: 'Privacy' },
  { to: '/terms', label: 'Terms' },
]

export default function Footer() {
  const { language } = useLanguage()
  const text = (value) => (language === 'fr' ? FR_TRANSLATIONS[value] || value : value)

  return (
    <footer className="hidden border-t border-slate-200 bg-white/90 xl:block">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 md:grid-cols-[1.2fr_1fr_1fr_1fr] lg:px-8">
        <div>
          <Link to="/" className="inline-flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-950 text-sm font-black text-white">IQ</span>
            <span className="text-lg font-black text-slate-950">PitchVision</span>
          </Link>
          <p className="mt-3 max-w-xs text-sm leading-6 text-slate-500">
            {text('A football scouting workspace for player discovery, comparison, shortlists, and tournament tracking.')}
          </p>
        </div>

        <FooterColumn title="Product" links={productLinks} text={text} />
        <FooterColumn title="Company" links={companyLinks} text={text} />
        <FooterColumn title="Legal" links={legalLinks} text={text} />
      </div>
    </footer>
  )
}

function FooterColumn({ title, links, text }) {
  return (
    <div>
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{text(title)}</p>
      <div className="mt-3 space-y-2">
        {links.map((link) => (
          <Link key={link.to} to={link.to} className="block text-sm font-semibold text-slate-600 transition hover:text-slate-950">
            {text(link.label)}
          </Link>
        ))}
      </div>
    </div>
  )
}
