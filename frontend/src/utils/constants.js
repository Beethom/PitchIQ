export const POSITIONS = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST']

export const LEAGUES = [
  'Premier League',
  'La Liga',
  'Bundesliga',
  'Serie A',
  'Ligue 1',
  'FA Cup',
  'EFL Cup',
  'DFB Pokal',
  'Copa del Rey',
  'Coppa Italia',
  'Coupe de France',
  'UEFA Champions League',
  'UEFA Europa League',
  'UEFA Conference League',
  'MLS',
  'UEFA Nations League',
  'CONCACAF Nations League',
  'CONCACAF Gold Cup',
  'Copa América',
  'FIFA World Cup',
  'World Cup Qual. CONMEBOL',
  'World Cup Qual. UEFA',
  'World Cup Qual. CONCACAF',
  'International Friendlies',
]

export const SEASONS = ['2026', '2025', '25/26', '24/25', '2024', '23/24']

export const COMPETITION_DEFAULT_SEASONS = {
  'Premier League': '25/26',
  'La Liga': '25/26',
  Bundesliga: '25/26',
  'Serie A': '25/26',
  'Ligue 1': '25/26',
  'FA Cup': '25/26',
  'EFL Cup': '25/26',
  'DFB Pokal': '25/26',
  'Copa del Rey': '25/26',
  'Coppa Italia': '25/26',
  'Coupe de France': '25/26',
  'UEFA Champions League': '25/26',
  'UEFA Europa League': '25/26',
  'UEFA Conference League': '25/26',
  MLS: '2026',
  'UEFA Nations League': '24/25',
  'CONCACAF Nations League': '24/25',
  'CONCACAF Gold Cup': '2025',
  'Copa América': '2024',
  'FIFA World Cup': '2026',
  'World Cup Qual. CONMEBOL': '2026',
  'World Cup Qual. UEFA': '2026',
  'World Cup Qual. CONCACAF': '2025',
  'International Friendlies': '2026',
}

export const WORLD_CUP_2026_GROUPS = [
  { group: 'A', nations: ['Mexico', 'South Africa', 'South Korea', 'Czechia'] },
  { group: 'B', nations: ['Canada', 'Bosnia & Herzegovina', 'Qatar', 'Switzerland'] },
  { group: 'C', nations: ['Brazil', 'Morocco', 'Haiti', 'Scotland'] },
  { group: 'D', nations: ['USA', 'Paraguay', 'Australia', 'Türkiye'] },
  { group: 'E', nations: ['Germany', 'Curaçao', 'Ivory Coast', 'Ecuador'] },
  { group: 'F', nations: ['Netherlands', 'Japan', 'Sweden', 'Tunisia'] },
  { group: 'G', nations: ['Belgium', 'Egypt', 'Iran', 'New Zealand'] },
  { group: 'H', nations: ['Spain', 'Cape Verde', 'Saudi Arabia', 'Uruguay'] },
  { group: 'I', nations: ['France', 'Senegal', 'Iraq', 'Norway'] },
  { group: 'J', nations: ['Argentina', 'Algeria', 'Austria', 'Jordan'] },
  { group: 'K', nations: ['Portugal', 'DR Congo', 'Uzbekistan', 'Colombia'] },
  { group: 'L', nations: ['England', 'Croatia', 'Ghana', 'Panama'] },
]

export const WORLD_CUP_2026_NATIONS = WORLD_CUP_2026_GROUPS.flatMap(({ nations }) => nations)

export const POSITION_COLORS = {
  GK:  'bg-amber-100 text-amber-700',
  CB:  'bg-sky-100 text-sky-700',
  LB:  'bg-sky-100 text-sky-700',
  RB:  'bg-sky-100 text-sky-700',
  CDM: 'bg-violet-100 text-violet-700',
  CM:  'bg-violet-100 text-violet-700',
  CAM: 'bg-violet-100 text-violet-700',
  LW:  'bg-emerald-100 text-emerald-700',
  RW:  'bg-emerald-100 text-emerald-700',
  ST:  'bg-red-100 text-red-700',
}

// Stats shown in the radar chart — normalised per-appearance so all positions are comparable
export const RADAR_STATS = [
  { key: 'goals',         label: 'Goals',    max: 1.2 },
  { key: 'chancesCreated',label: 'Creation', max: 3.5 },
  { key: 'passAccuracy',  label: 'Passing',  max: 100 },
  { key: 'dribbles',      label: 'Dribbles', max: 5 },
  { key: 'defensiveWorkrate', label: 'Def Work', max: 100 },
  { key: 'shotConversion',label: 'Conversion', max: 45 },
]

// Stats shown in the per-90 bar chart
export const BAR_STATS = [
  { key: 'goals',    label: 'Goals' },
  { key: 'assists',  label: 'Assists' },
  { key: 'shots',    label: 'Shots' },
  { key: 'chancesCreated',label: 'Chances' },
  { key: 'dribbles', label: 'Dribbles' },
  { key: 'progressivePasses', label: 'Prog. Passes' },
]

// All stats displayed in the comparison table, grouped by category
export const STAT_GROUPS = [
  {
    label: 'Attack',
    stats: [
      { key: 'goals',             label: 'Goals' },
      { key: 'assists',           label: 'Assists' },
      { key: 'goalContributions', label: 'Goal Contributions' },
      { key: 'shots',             label: 'Shots' },
      { key: 'shotsOnTarget',     label: 'Shots on Target' },
      { key: 'shotConversion',    label: 'Shot Conversion %' },
      { key: 'missedChances',     label: 'Missed Chances' },
      { key: 'bigChancesMissed',  label: 'Big Chances Missed' },
      { key: 'xG',                label: 'xG' },
      { key: 'xA',                label: 'xA' },
    ],
  },
  {
    label: 'Passing & Creation',
    stats: [
      { key: 'passAccuracy',      label: 'Pass Accuracy %' },
      { key: 'totalPasses',       label: 'Passes Attempted' },
      { key: '_accuratePasses',   label: 'Successful Passes' },
      { key: 'progressivePasses', label: 'Progressive Passes' },
      { key: 'finalThirdPasses',  label: 'Final-third Passes' },
      { key: 'throughPasses',     label: 'Through Passes' },
      { key: 'backPasses',        label: 'Back Passes' },
      { key: 'keyPasses',         label: 'Key Passes' },
      { key: 'chancesCreated',    label: 'Chances Created' },
      { key: 'bigChancesCreated', label: 'Big Chances Created' },
      { key: 'crosses',           label: 'Crosses' },
      { key: 'accurateCrosses',   label: 'Accurate Crosses' },
      { key: 'crossAccuracy',     label: 'Cross Accuracy %' },
    ],
  },
  {
    label: 'Dribbling & Possession',
    stats: [
      { key: 'touches',                label: 'Touches' },
      { key: 'touchesPerMatch',        label: 'Touches per Match' },
      { key: 'dribbles',               label: 'Dribbles Completed' },
      { key: 'dribblesAttempted',      label: 'Dribbles Attempted' },
      { key: 'dribbleSuccess',         label: 'Dribble Success %' },
      { key: 'possessionLost',         label: 'Possession Lost' },
      { key: 'possessionLostPerMatch', label: 'Poss. Lost per Match' },
    ],
  },
  {
    label: 'Defence',
    stats: [
      { key: 'recoveries',        label: 'Recoveries' },
      { key: 'interceptions',     label: 'Interceptions' },
      { key: 'tackles',           label: 'Tackles' },
      { key: 'successfulTackles', label: 'Successful Tackles' },
      { key: 'clearances',        label: 'Clearances' },
      { key: 'aerialDuelsWon',    label: 'Aerial Duels Won' },
      { key: 'fouls',             label: 'Fouls' },
      { key: 'defensiveWorkrate',    label: 'Work Rate (0–100)' },
      { key: 'defensiveContribution',label: 'Contribution (0–100)' },
      { key: 'defensiveIntensity',   label: 'Defensive Intensity' },
      { key: 'avgTeamPossession',    label: 'Avg Team Possession %' },
    ],
  },
  {
    label: 'Goalkeeping',
    stats: [
      { key: 'saves',           label: 'Saves' },
      { key: 'totalShotsFaced', label: 'Shots Faced' },
      { key: 'goalsConceded',   label: 'Goals Conceded' },
      { key: 'highClaims',      label: 'High Claims' },
      { key: 'punches',         label: 'Punches' },
      { key: 'runOuts',         label: 'Run Outs' },
    ],
  },
  {
    label: 'Discipline',
    stats: [
      { key: 'yellowCards', label: 'Yellow Cards' },
      { key: 'redCards',    label: 'Red Cards' },
    ],
  },
]
