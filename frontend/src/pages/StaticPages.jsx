import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Database,
  HelpCircle,
  Layers3,
  Mail,
  MessageSquare,
  Scale,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react'
import PageContainer from '../components/layout/PageContainer'

const CONTACT_CATEGORIES = ['Data issue', 'Support', 'Demo', 'Partnership', 'Feature request']
const DEMO_ROLES = ['Club staff', 'Scout', 'Analyst', 'Agent', 'Coach', 'Media', 'Other']

const pages = {
  about: {
    eyebrow: 'About PitchIQ',
    title: 'Football scouting built for fast, evidence-led decisions.',
    intro: 'PitchIQ brings player data, match context, comparisons, shortlists, and World Cup tracking into one scouting workspace.',
    icon: Users,
    sections: [
      ['What we do', 'We help scouts, coaches, analysts, and football decision-makers move from raw data to clear player reads. The platform combines performance tables, role signals, form trends, and comparison tools so you can evaluate players with less noise.'],
      ['Who it is for', 'PitchIQ is designed for football staff, agencies, recruitment teams, and serious fans who want a practical way to explore players, compare profiles, and follow tournament performance.'],
      ['Our approach', 'The product keeps the scouting workflow direct: find a player, understand the profile, compare against peers, save the target, and revisit the evidence when new data arrives.'],
    ],
    highlights: ['Current player database', 'World Cup mode', 'Player comparisons', 'Shortlists and watchlists'],
  },
  how: {
    eyebrow: 'How to Use PitchIQ',
    title: 'Start with the dashboard, then move deeper when a player catches your eye.',
    intro: 'PitchIQ is built around a simple scouting flow: scan, filter, compare, save, and review.',
    icon: HelpCircle,
    sections: [
      ['1. Scan the dashboard', 'Use the dashboard to see top performers, recent signals, market leaders, watchlists, and players who have been updated recently.'],
      ['2. Filter the scouting board', 'Open the scouting board when you need a larger pool. Filter by competition group, position, age, minutes, starts, season, and sorting metric.'],
      ['3. Compare players', 'Use Compare to put two players side by side. Radar, per-90 output, detailed stat tables, and peer benchmarks help show the differences quickly.'],
      ['4. Save and revisit', 'Add players to shortlists when you want to review them later. Saved players can be compared directly from the shortlist page.'],
      ['5. Use World Cup mode', 'World Cup mode focuses the app on tournament players, match center, lineups, countdowns, team stats, goalkeeper leaders, and tournament rankings.'],
    ],
    highlights: ['Dashboard overview', 'Scouting filters', 'Compare mode', 'Shortlists', 'World Cup match center'],
  },
  faq: {
    eyebrow: 'FAQ',
    title: 'Answers for scouts, analysts, clients, and admins.',
    intro: 'A practical guide to data sources, update timing, World Cup mode, player ratings, admin controls, and account access.',
    icon: HelpCircle,
    variant: 'faq',
    highlights: ['Data sources', 'Update timing', 'World Cup mode', 'Admin controls'],
    faqs: [
      ['Where does PitchIQ data come from?', 'PitchIQ uses provider football feeds, stored player profiles, fixture data, match events, lineups, and local scouting calculations to build the views in the app.'],
      ['How often do stats update?', 'Most scouting pages update when the database is refreshed. Live World Cup match pages poll automatically during active matches, while full player rows depend on provider publication and admin refreshes.'],
      ['What is World Cup mode?', 'World Cup mode narrows the experience to FIFA World Cup players, fixtures, lineups, match center data, tournament leaderboards, and goalkeeper-specific views.'],
      ['How are player ratings used?', 'Ratings come from available match or season data and are used as one signal. PitchIQ pairs ratings with output, per-90 production, role metrics, form, and context rather than treating rating as the only answer.'],
      ['Why are admin controls hidden?', 'Sync, repair, and backfill controls are operational tools. They live in Data Control so normal users can browse without triggering provider calls or maintenance workflows.'],
      ['How does account access work?', 'The current interface separates public browsing from admin-only workflows in the UI. Production access should be paired with authentication, roles, and server-side authorization.'],
    ],
  },
  requestDemo: {
    eyebrow: 'Request Demo',
    title: 'See how PitchIQ fits your scouting workflow.',
    intro: 'Tell us who you are, what you work on, and where the platform can help. The form prepares a demo request locally for now.',
    icon: MessageSquare,
    variant: 'demo',
    highlights: ['Club workflows', 'Agency reviews', 'Analyst demos', 'World Cup tracking'],
  },
  coverage: {
    eyebrow: 'Data Coverage',
    title: 'Coverage across leagues, cups, national teams, and World Cup workflows.',
    intro: 'Use this page to understand what PitchIQ can show today and where provider timing or match publication affects availability.',
    icon: Database,
    variant: 'coverage',
    highlights: ['Club leagues', 'Domestic cups', 'National teams', 'World Cup 2026'],
    sections: [
      ['Competition groups', 'PitchIQ supports grouped browsing for major leagues, European competitions, MLS, national-team rows, domestic cups, and World Cup-specific datasets.'],
      ['Seasons', 'The app supports season filters such as 25/26, 2026, and tournament-specific seasons depending on the competition and provider feed.'],
      ['World Cup support', 'World Cup mode includes fixtures, countdowns, match center, lineups, team stats, top performers, tournament leaderboards, and goalkeeper sections.'],
      ['Available stats', 'Coverage includes minutes, appearances, starts, goals, assists, xG, xA, shots, passing, touches, dribbling, defensive work, goalkeeper saves, clean sheets, goals conceded, and more when provider data exists.'],
    ],
    matrix: [
      ['Player profiles', 'Names, clubs, teams, positions, age, nationality, season rows, totals, and competition splits.'],
      ['Attacking', 'Goals, assists, shots, shots on target, xG, xA, chances created, big chances, conversion.'],
      ['Possession', 'Passes, pass accuracy, touches, final-third passes, through passes, crosses, long balls, possession lost.'],
      ['Defending', 'Tackles, successful tackles, interceptions, recoveries, clearances, duels, fouls, work-rate proxies.'],
      ['Goalkeeping', 'Saves, shots faced, save percentage, clean sheets, goals conceded, claims and related keeper impact signals.'],
      ['Match center', 'Fixture status, score, countdown, incidents, lineups, formations, radar, minutes played, team stats.'],
    ],
  },
  methodology: {
    eyebrow: 'Methodology',
    title: 'How PitchIQ turns football data into scouting signals.',
    intro: 'Methodology pages help clients understand what each view means, how to read it, and where the limitations are.',
    icon: Layers3,
    variant: 'methodology',
    highlights: ['Ratings', 'Radar', 'Per 90', 'Goalkeeping', 'Limitations'],
    sections: [
      ['Ratings', 'Ratings are treated as a summary signal, not the final verdict. They are most useful when paired with minutes, role, competition, and recent form.'],
      ['Radar', 'Radar views normalize selected team or player metrics so profiles can be compared visually. Radar shape should be read as a pattern, not as a single score.'],
      ['Per-90 stats', 'Per-90 values help compare players with different minutes. Small samples can distort per-90 output, so minutes and starts should always be checked.'],
      ['Goalkeeper stats', 'Keeper views combine saves, shots faced, save percentage, clean sheets, goals conceded, minutes, and impact signals. Goals conceded are tied to fixture scores when available.'],
      ['Form', 'Recent form uses match logs when exact data exists. If exact logs are unavailable, the app may show season-average estimates until a repair or refresh adds match rows.'],
      ['Defensive metrics', 'Defensive activity depends heavily on event and lineup data. Recoveries, tackles, fouls, and work-rate signals should be read with team style and match state in mind.'],
      ['Limitations', 'Provider feeds can update after full time, own goals can affect attribution, and some competitions publish fewer event details. PitchIQ should support decisions, not replace video review.'],
    ],
  },
  updates: {
    eyebrow: 'Changelog',
    title: 'Product updates and data improvements.',
    intro: 'A lightweight record of important PitchIQ improvements, especially World Cup and data-quality work.',
    icon: CalendarDays,
    variant: 'updates',
    highlights: ['World Cup fixes', 'Goalkeeping stats', 'French support', 'Admin controls'],
    updates: [
      ['June 2026', 'Moved admin-only sync and repair controls into Data Control, keeping user-facing pages focused on scouting workflows.'],
      ['June 2026', 'Expanded French translation coverage across the website, app navigation, World Cup pages, dashboard, and support pages.'],
      ['June 2026', 'Improved World Cup goalkeeper sections with saves, clean sheets, shots faced, save percentage, goals conceded, and keeper leaderboards.'],
      ['June 2026', 'Added World Cup match center upgrades including countdowns, lineups, team radar, minutes played, and richer match stats.'],
      ['June 2026', 'Added About, How to Use, Contact, Privacy, Terms, FAQ, Request Demo, Coverage, Methodology, and Updates pages.'],
    ],
  },
  contact: {
    eyebrow: 'Contact',
    title: 'Need help, feedback, or a scouting workflow review?',
    intro: 'Send a support, data, demo, partnership, or feature request from one place.',
    icon: Mail,
    variant: 'contact',
    highlights: ['Data issue reports', 'Team onboarding', 'Feature requests', 'Partnerships'],
    sections: [
      ['Support', 'For account, data, or platform questions, send a message with the page, player, fixture, or workflow you were using.'],
      ['Partnerships', 'For club, academy, agency, or analyst workflows, include your use case and the competitions or player markets you care about most.'],
      ['Data corrections', 'If a stat looks wrong, include the player name, competition, season, and match if possible. That makes it easier to verify and repair.'],
    ],
  },
  privacy: {
    eyebrow: 'Privacy',
    title: 'Privacy and data handling',
    intro: 'PitchIQ keeps the product focused on football scouting. This page explains the practical privacy principles for the platform.',
    icon: ShieldCheck,
    sections: [
      ['What the platform stores', 'PitchIQ stores football data, saved shortlists, recently viewed players, and operational sync status needed to run the scouting experience.'],
      ['Local browser data', 'Some preferences, language selection, recently viewed profiles, and shortlists may be stored locally in your browser so the app feels fast and personal.'],
      ['Data use', 'Platform data is used to power scouting views, player comparisons, match center pages, and admin maintenance workflows. It is not designed for unrelated advertising workflows.'],
      ['Questions', 'For privacy questions or correction requests, contact the PitchIQ team with the specific account, browser, or data item involved.'],
    ],
    highlights: ['Local preferences', 'Shortlist storage', 'Scouting data only', 'Correction requests'],
  },
  terms: {
    eyebrow: 'Terms',
    title: 'Platform terms and responsible use',
    intro: 'PitchIQ is a scouting support platform. It helps organize evidence, but football decisions should still include human review and context.',
    icon: Scale,
    sections: [
      ['Use of the platform', 'Use PitchIQ to research players, compare profiles, follow competitions, and organize scouting targets. Do not misuse the platform, scrape it aggressively, or attempt to bypass admin-only controls.'],
      ['Data accuracy', 'Football data can change after provider updates, match corrections, or sync repairs. Treat the platform as a decision-support tool and verify critical decisions with match video and official sources.'],
      ['Admin functions', 'Data Control actions are restricted operational tools. They are intended for maintenance, repairs, and controlled refreshes, not ordinary browsing.'],
      ['Changes', 'PitchIQ may update features, pages, data sources, and these terms as the product evolves.'],
    ],
    highlights: ['Decision support', 'Human review', 'Admin-only controls', 'Responsible usage'],
  },
}

export default function StaticPage({ page = 'about' }) {
  const content = pages[page] ?? pages.about
  const Icon = content.icon ?? BarChart3

  return (
    <div className="flex-1 min-w-0">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_320px] lg:px-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-sky-700">
              <Icon size={13} />
              {content.eyebrow}
            </div>
            <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
              {content.title}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">{content.intro}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/" className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800">
                Open Dashboard
              </Link>
              <Link to="/request-demo" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50">
                Request Demo
              </Link>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Platform Includes</p>
            <div className="mt-4 space-y-3">
              {content.highlights.map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <CheckCircle2 size={15} className="text-emerald-600" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <PageContainer>
        {content.variant === 'faq' && <FaqList items={content.faqs} />}
        {content.variant === 'demo' && <DemoForm />}
        {content.variant === 'contact' && <ContactForm />}
        {content.variant === 'coverage' && <CoveragePage content={content} />}
        {content.variant === 'methodology' && <SectionGrid sections={content.sections} />}
        {content.variant === 'updates' && <UpdatesList items={content.updates} />}
        {!content.variant && <SectionGrid sections={content.sections} />}
        {content.variant === 'contact' && <SectionGrid sections={content.sections} className="mt-6" />}
      </PageContainer>
    </div>
  )
}

function SectionGrid({ sections, className = '' }) {
  return (
    <div className={`grid gap-4 lg:grid-cols-2 ${className}`}>
      {sections.map(([title, body]) => (
        <section key={title} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">{title}</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">{body}</p>
        </section>
      ))}
    </div>
  )
}

function FaqList({ items }) {
  return (
    <div className="space-y-3">
      {items.map(([question, answer]) => (
        <details key={question} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm" open>
          <summary className="cursor-pointer text-base font-black text-slate-950">{question}</summary>
          <p className="mt-3 text-sm leading-7 text-slate-600">{answer}</p>
        </details>
      ))}
    </div>
  )
}

function CoveragePage({ content }) {
  return (
    <div className="space-y-6">
      <SectionGrid sections={content.sections} />
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-black text-slate-950">Stats Available</h2>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {content.matrix.map(([label, body]) => (
            <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="font-black text-slate-950">{label}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function UpdatesList({ items }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-black text-slate-950">Recent Updates</h2>
      <div className="mt-5 space-y-4">
        {items.map(([date, body], index) => (
          <div key={`${date}-${index}`} className="grid gap-3 border-l-2 border-sky-200 pl-4 sm:grid-cols-[140px_1fr]">
            <p className="text-sm font-black text-sky-700">{date}</p>
            <p className="text-sm leading-7 text-slate-600">{body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function ContactForm() {
  const [sent, setSent] = useState(false)

  return (
    <FormShell
      title="Send a message"
      description="Choose a category so the team knows whether this is support, data, demo, partnership, or product feedback."
      sent={sent}
      sentText="Message prepared. The team can connect this form to email or CRM next."
      onSubmit={() => setSent(true)}
    >
      <Input label="Name" name="name" required />
      <Input label="Email" name="email" type="email" required />
      <Select label="Category" name="category" options={CONTACT_CATEGORIES} />
      <Input label="Organization" name="organization" />
      <Textarea label="Message" name="message" required />
    </FormShell>
  )
}

function DemoForm() {
  const [sent, setSent] = useState(false)

  return (
    <FormShell
      title="Request access"
      description="Share enough context for a useful demo: role, organization, competitions, and what you want to evaluate."
      sent={sent}
      sentText="Demo request prepared. The team can connect this form to email or CRM next."
      onSubmit={() => setSent(true)}
    >
      <Input label="Name" name="name" required />
      <Input label="Email" name="email" type="email" required />
      <Input label="Organization" name="organization" required />
      <Select label="Role" name="role" options={DEMO_ROLES} />
      <Textarea label="Message" name="message" required />
    </FormShell>
  )
}

function FormShell({ title, description, sent, sentText, onSubmit, children }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5">
        <h2 className="text-xl font-black text-slate-950">{title}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">{description}</p>
      </div>
      <form
        className="grid gap-4 lg:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        {children}
        <div className="lg:col-span-2">
          <button type="submit" className="inline-flex rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800">
            Submit
          </button>
          {sent && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{sentText}</p>}
        </div>
      </form>
    </section>
  )
}

function Input({ label, name, type = 'text', required = false }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</span>
      <input name={name} type={type} required={required} className="input h-11 w-full" />
    </label>
  )
}

function Select({ label, name, options }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</span>
      <select name={name} className="select h-11 w-full">
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  )
}

function Textarea({ label, name, required = false }) {
  return (
    <label className="block lg:col-span-2">
      <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</span>
      <textarea name={name} required={required} rows={6} className="input w-full resize-y" />
    </label>
  )
}
