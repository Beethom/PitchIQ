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
const CONTACT_EMAIL = 'beethovenmarhone@gmail.com'

function openMailto(subjectPrefix, form) {
  const data = new FormData(form)
  const fields = []
  for (const [key, value] of data.entries()) {
    if (String(value).trim()) fields.push(`${key.charAt(0).toUpperCase() + key.slice(1)}: ${value}`)
  }
  const subject = `${subjectPrefix}${data.get('category') ? ` — ${data.get('category')}` : ''}`
  const body = fields.join('\n')
  window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

const pages = {
  about: {
    eyebrow: 'About PitchVision',
    title: 'See beyond the stats.',
    intro: 'PitchVision brings player data, match context, comparisons, leaderboards, lineups, and World Cup tracking into one fast, focused football workspace.',
    icon: Users,
    sections: [
      ['What we do', 'We turn raw football numbers into clear reads on players and matches. The platform combines performance tables, per-90 output, role signals, form trends, and side-by-side comparisons so you can understand a player with less noise.'],
      ['Who it is for', 'PitchVision is built for analysts, coaches, agencies, recruitment teams, and serious football fans who want a practical way to explore players, compare profiles, build lineups, and follow tournament performance.'],
      ['Our approach', 'We keep the flow direct: find a player, understand the profile, compare against peers, save the ones that matter, and come back when new data lands. Numbers are paired with context so they support decisions instead of replacing judgment.'],
    ],
    highlights: ['Player database', 'World Cup mode', 'Player comparisons', 'Lineup builder', 'Shortlists and watchlists'],
  },
  how: {
    eyebrow: 'How to Use PitchVision',
    title: 'Start with the dashboard, then go deeper when a player catches your eye.',
    intro: 'PitchVision follows a simple flow: scan, filter, compare, build, and save.',
    icon: HelpCircle,
    sections: [
      ['1. Scan the dashboard', 'The dashboard surfaces top performers, leaderboards, recent movers, and players who have been updated recently — a quick read on who is worth a closer look.'],
      ['2. Filter the board', 'Open the player board when you want a larger pool. Filter by competition group, position, age, minutes, starts, season, and the metric you want to sort by.'],
      ['3. Compare players', 'Put two players side by side. Radar charts, per-90 output, detailed stat tables, and peer benchmarks make the differences easy to see.'],
      ['4. Build and share lineups', 'Use the lineup builder to set a formation, place players, and create a shareable image card you can post or send to others.'],
      ['5. Save and revisit', 'Add players to shortlists to review them later, and compare saved players directly from the shortlist page.'],
      ['6. Switch to World Cup mode', 'World Cup mode focuses the app on tournament players, match center, lineups, countdowns, team stats, goalkeeper leaders, and live tournament rankings.'],
    ],
    highlights: ['Dashboard overview', 'Player filters', 'Compare mode', 'Lineup builder', 'Shortlists', 'World Cup match center'],
  },
  faq: {
    eyebrow: 'FAQ',
    title: 'Answers to the most common questions.',
    intro: 'A quick guide to where data comes from, how often it updates, World Cup mode, ratings, lineups, and languages.',
    icon: HelpCircle,
    variant: 'faq',
    highlights: ['Data and updates', 'World Cup mode', 'Ratings', 'Lineups'],
    faqs: [
      ['Where does PitchVision data come from?', 'PitchVision is built on trusted football data feeds covering player profiles, fixtures, match events, and lineups, combined with our own calculations to produce the comparisons and leaderboards you see in the app.'],
      ['How often do stats update?', 'Live World Cup match pages refresh automatically during active matches. Player and leaderboard pages update as new match data becomes available, so finished matches settle into their final numbers shortly after they end.'],
      ['What is World Cup mode?', 'World Cup mode focuses the whole experience on the FIFA World Cup — tournament players, fixtures, lineups, match center, team stats, tournament leaderboards, and goalkeeper-specific views.'],
      ['How are player ratings used?', 'Ratings are one signal among many. PitchVision pairs them with output, per-90 production, role metrics, form, and match context, so you are never relying on a single number to judge a player.'],
      ['Can I build and share lineups?', 'Yes. The lineup builder lets you pick a formation, place players on the pitch, and generate a shareable image card you can post or send. Your work is kept on your device until you choose to share it.'],
      ['Is PitchVision available in other languages?', 'Yes. PitchVision supports English and French, and you can switch languages at any time from the menu.'],
    ],
  },
  requestDemo: {
    eyebrow: 'Request Demo',
    title: 'See how PitchVision fits your scouting workflow.',
    intro: 'Tell us who you are, what you work on, and where the platform can help. The form prepares a demo request locally for now.',
    icon: MessageSquare,
    variant: 'demo',
    highlights: ['Club workflows', 'Agency reviews', 'Analyst demos', 'World Cup tracking'],
  },
  coverage: {
    eyebrow: 'Data Coverage',
    title: 'Coverage across leagues, cups, national teams, and World Cup workflows.',
    intro: 'Use this page to understand what PitchVision can show today and where provider timing or match publication affects availability.',
    icon: Database,
    variant: 'coverage',
    highlights: ['Club leagues', 'Domestic cups', 'National teams', 'World Cup 2026'],
    sections: [
      ['Competition groups', 'PitchVision supports grouped browsing for major leagues, European competitions, MLS, national-team rows, domestic cups, and World Cup-specific datasets.'],
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
    title: 'How PitchVision turns football data into scouting signals.',
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
      ['Limitations', 'Provider feeds can update after full time, own goals can affect attribution, and some competitions publish fewer event details. PitchVision should support decisions, not replace video review.'],
    ],
  },
  updates: {
    eyebrow: 'Changelog',
    title: 'Product updates and data improvements.',
    intro: 'A lightweight record of important PitchVision improvements, especially World Cup and data-quality work.',
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
    intro: 'PitchVision keeps the product focused on football scouting. This page explains the practical privacy principles for the platform.',
    icon: ShieldCheck,
    sections: [
      ['What the platform stores', 'PitchVision stores football data, saved shortlists, recently viewed players, and operational sync status needed to run the scouting experience.'],
      ['Local browser data', 'Some preferences, language selection, recently viewed profiles, and shortlists may be stored locally in your browser so the app feels fast and personal.'],
      ['Data use', 'Platform data is used to power scouting views, player comparisons, match center pages, and admin maintenance workflows. It is not designed for unrelated advertising workflows.'],
      ['Questions', 'For privacy questions or correction requests, contact the PitchVision team with the specific account, browser, or data item involved.'],
    ],
    highlights: ['Local preferences', 'Shortlist storage', 'Scouting data only', 'Correction requests'],
  },
  terms: {
    eyebrow: 'Terms',
    title: 'Platform terms and responsible use',
    intro: 'PitchVision is a scouting support platform. It helps organize evidence, but football decisions should still include human review and context.',
    icon: Scale,
    sections: [
      ['Use of the platform', 'Use PitchVision to research players, compare profiles, follow competitions, and organize scouting targets. Do not misuse the platform, scrape it aggressively, or attempt to bypass admin-only controls.'],
      ['Data accuracy', 'Football data can change after provider updates, match corrections, or sync repairs. Treat the platform as a decision-support tool and verify critical decisions with match video and official sources.'],
      ['Admin functions', 'Data Control actions are restricted operational tools. They are intended for maintenance, repairs, and controlled refreshes, not ordinary browsing.'],
      ['Changes', 'PitchVision may update features, pages, data sources, and these terms as the product evolves.'],
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
      sentText="Opening your email app to send this message to the PitchVision team."
      onSubmit={(form) => { openMailto('PitchVision contact', form); setSent(true) }}
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
      sentText="Opening your email app to send this demo request to the PitchVision team."
      onSubmit={(form) => { openMailto('PitchVision demo request', form); setSent(true) }}
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
          onSubmit(event.currentTarget)
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
