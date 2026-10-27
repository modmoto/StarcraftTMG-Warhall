export const normalizeText = value =>
  value
    .replace(/[‐‑–−]/g, '-')
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
const aliases = {
  MARINE: 'Marines',
  MARAUDER: 'Marauders',
  MEDIC: 'Medics',
  "RAYNOR'S RAIDER (MARINE)": "Raynor's Raiders",
  ADEPT: 'Adepts',
  'PRAETOR GUARD (ZEALOT)': 'Praetor Guards',
  SENTRY: 'Sentries',
  ZEALOT: 'Zealots',
  HYDRALISK: 'Hydralisks',
  'CORPSER (ROACH)': 'Corpsers (Roach)',
  'VILE (ROACH)': 'Viles (Roach)',
  ROACH: 'Roaches',
  'KERRIGAN SWARM RAPTOR (ZERGLING)': 'Kerrigan Swarm Raptors (Zergling)',
  'RAPTOR (ZERGLING)': 'Raptors (Zergling)',
  'SWARMLING (ZERGLING)': 'Swarmlings',
  ZERGLING: 'Zerglings',
  RAVAGER: 'Ravagers',
  'NERAZIM WATCHERS (ADEPT)': 'Nerazim Watchers (Adept)',
};
export const displayName = raw =>
  aliases[normalizeText(raw)] ??
  normalizeText(raw)
    .toLowerCase()
    .replace(/\b[a-z]/g, c => c.toUpperCase());
