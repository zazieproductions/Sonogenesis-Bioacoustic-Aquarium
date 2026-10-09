import { RNG, clamp } from './rng';

export type GeneGroup = 'Morphology' | 'Pigment' | 'Behavior' | 'Metabolism' | 'Voice';

export interface GeneDef {
  k: string;
  label: string;
  g: GeneGroup;
}

export const GENES: GeneDef[] = [
  { k: 'size', label: 'Body size', g: 'Morphology' },
  { k: 'symmetry', label: 'Radial symmetry', g: 'Morphology' },
  { k: 'segments', label: 'Segmentation', g: 'Morphology' },
  { k: 'branching', label: 'Branching', g: 'Morphology' },
  { k: 'bell', label: 'Bell / medusoid', g: 'Morphology' },
  { k: 'tentacles', label: 'Tentacles', g: 'Morphology' },
  { k: 'cells', label: 'Cellular colony', g: 'Morphology' },
  { k: 'spikes', label: 'Spines / geometry', g: 'Morphology' },
  { k: 'crystal', label: 'Crystalline facets', g: 'Morphology' },
  { k: 'spores', label: 'Spore halo', g: 'Morphology' },
  { k: 'hue', label: 'Pigment hue', g: 'Pigment' },
  { k: 'hueSpread', label: 'Hue spread', g: 'Pigment' },
  { k: 'opacity', label: 'Opacity', g: 'Pigment' },
  { k: 'lumin', label: 'Bioluminescence', g: 'Pigment' },
  { k: 'speed', label: 'Locomotion', g: 'Behavior' },
  { k: 'wander', label: 'Wander', g: 'Behavior' },
  { k: 'sociality', label: 'Sociality', g: 'Behavior' },
  { k: 'aggression', label: 'Aggression', g: 'Behavior' },
  { k: 'diet', label: 'Predation', g: 'Behavior' },
  { k: 'tempPref', label: 'Thermal niche', g: 'Behavior' },
  { k: 'sense', label: 'Sensory range', g: 'Behavior' },
  { k: 'hearing', label: 'Acoustic sensitivity', g: 'Behavior' },
  { k: 'metab', label: 'Metabolic efficiency', g: 'Metabolism' },
  { k: 'reproThresh', label: 'Reproductive threshold', g: 'Metabolism' },
  { k: 'brood', label: 'Brood size', g: 'Metabolism' },
  { k: 'lifespan', label: 'Lifespan', g: 'Metabolism' },
  { k: 'sexual', label: 'Sexual reproduction', g: 'Metabolism' },
  { k: 'callRate', label: 'Call rate', g: 'Voice' },
  { k: 'syncTend', label: 'Sync coupling', g: 'Voice' },
  { k: 'mimicry', label: 'Vocal mimicry', g: 'Voice' },
  { k: 'wave', label: 'Waveform', g: 'Voice' },
  { k: 'pitch', label: 'Fundamental', g: 'Voice' },
  { k: 'pitchRange', label: 'Pitch range', g: 'Voice' },
  { k: 'harmonics', label: 'Harmonic complexity', g: 'Voice' },
  { k: 'fmRatio', label: 'FM ratio', g: 'Voice' },
  { k: 'fmIndex', label: 'FM depth', g: 'Voice' },
  { k: 'noise', label: 'Noise / grain', g: 'Voice' },
  { k: 'attack', label: 'Attack', g: 'Voice' },
  { k: 'decay', label: 'Decay', g: 'Voice' },
  { k: 'cutoff', label: 'Filter cutoff', g: 'Voice' },
  { k: 'resonance', label: 'Resonance', g: 'Voice' },
  { k: 'rhythm', label: 'Rhythmic division', g: 'Voice' },
  { k: 'drone', label: 'Drone tendency', g: 'Voice' },
];

export const G: Record<string, number> = {};
GENES.forEach((d, i) => (G[d.k] = i));
export const GENE_COUNT = GENES.length;
export const GROUPS: GeneGroup[] = ['Morphology', 'Pigment', 'Behavior', 'Metabolism', 'Voice'];

export function randomGenome(rng: RNG, bias?: Partial<Record<string, number>>): number[] {
  const g: number[] = [];
  for (let i = 0; i < GENE_COUNT; i++) g.push(rng.next());
  if (bias) {
    for (const k in bias) {
      const v = bias[k]!;
      g[G[k]] = clamp(v + rng.gauss() * 0.08);
    }
  }
  return g;
}

export function mutate(g: number[], rate: number, strength: number, rng: RNG): { genome: number[]; count: number } {
  const out = g.slice();
  let count = 0;
  for (let i = 0; i < out.length; i++) {
    if (rng.chance(rate)) {
      count++;
      if (rng.chance(0.06)) out[i] = rng.next(); // macro-mutation
      else out[i] = clamp(out[i] + rng.gauss() * strength);
    }
  }
  return { genome: out, count };
}

export function crossover(a: number[], b: number[], rng: RNG): number[] {
  // Linkage-preserving crossover: genes inherited in group blocks, with slight blending.
  const out: number[] = new Array(a.length);
  const choice: Record<string, boolean> = {};
  for (const grp of GROUPS) choice[grp] = rng.chance(0.5);
  for (let i = 0; i < a.length; i++) {
    const src = rng.chance(0.15) ? rng.chance(0.5) : choice[GENES[i].g];
    const v = src ? a[i] : b[i];
    const other = src ? b[i] : a[i];
    out[i] = clamp(v * 0.85 + other * 0.15);
  }
  return out;
}

export function geneticDistance(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const w = GENES[i].g === 'Pigment' ? 1.4 : GENES[i].g === 'Voice' ? 1.1 : 1;
    s += Math.abs(a[i] - b[i]) * w;
  }
  return s / a.length;
}

export const WAVES: OscillatorType[] = ['sine', 'triangle', 'square', 'sawtooth'];

export interface Phenotype {
  radius: number;
  maxSpeed: number;
  turn: number;
  capacity: number;
  metabolism: number;
  lifespan: number;
  maturity: number;
  senseRange: number;
  hearing: number;
  sociality: number;
  aggression: number;
  diet: number;
  tempPref: number;
  reproFrac: number;
  brood: number;
  sexual: number;
  callRate: number;
  syncTend: number;
  mimicry: number;
  lumin: number;
  opacity: number;
  hue: number;
  hue2: number;
  // voice
  wave: OscillatorType;
  freq: number;
  spectral: number; // 0..1 log position of fundamental
  pitchRange: number;
  harmonics: number;
  fmRatio: number;
  fmIndex: number;
  noise: number;
  attack: number;
  decay: number;
  cutoff: number;
  resonance: number;
  rhythmDiv: number;
  drone: boolean;
  harmonicity: number;
  loudness: number;
}

const RHYTHM_DIVS = [0.25, 0.5, 1, 1, 2, 3, 4];

export function express(g: number[]): Phenotype {
  const size = g[G.size];
  const radius = 5 + Math.pow(size, 1.4) * 34;
  const speedGene = g[G.speed];
  const maxSpeed = (18 + speedGene * 85) * (1.15 - size * 0.55);
  // Bigger bodies resonate lower (physical coupling) — genotype pitch shifts within that.
  const spectral = clamp(g[G.pitch] * 0.62 + (1 - size) * 0.38);
  const freq = 38 * Math.pow(2, spectral * 6.2);
  const fmRatioRaw = 0.5 + g[G.fmRatio] * 6.5;
  const nearInt = Math.abs(fmRatioRaw - Math.round(fmRatioRaw));
  const harmonicity = clamp((1 - nearInt * 2) * 0.6 + (1 - g[G.noise]) * 0.4);
  const lifespan = 70 + g[G.lifespan] * 260 * (0.7 + size * 0.5);
  return {
    radius,
    maxSpeed,
    turn: 0.5 + g[G.wander] * 3,
    capacity: 40 + radius * 4.5,
    metabolism: (0.35 + radius * 0.03 + speedGene * 0.65) * (1.35 - g[G.metab] * 0.6) + g[G.lumin] * 0.18 + g[G.sense] * 0.2,
    lifespan,
    maturity: lifespan * 0.14,
    senseRange: 60 + g[G.sense] * 220,
    hearing: 0.2 + g[G.hearing] * 0.8,
    sociality: g[G.sociality],
    aggression: g[G.aggression],
    diet: clamp((g[G.diet] - 0.35) / 0.65),
    tempPref: g[G.tempPref],
    reproFrac: 0.45 + g[G.reproThresh] * 0.45,
    brood: 1 + Math.floor(g[G.brood] * 3.2),
    sexual: g[G.sexual],
    callRate: g[G.callRate],
    syncTend: g[G.syncTend],
    mimicry: g[G.mimicry],
    lumin: g[G.lumin],
    opacity: 0.15 + g[G.opacity] * 0.75,
    hue: g[G.hue] * 360,
    hue2: (g[G.hue] * 360 + g[G.hueSpread] * 140) % 360,
    wave: WAVES[Math.min(3, Math.floor(g[G.wave] * 4))],
    freq,
    spectral,
    pitchRange: 0.1 + g[G.pitchRange] * 1.4,
    harmonics: g[G.harmonics],
    fmRatio: fmRatioRaw,
    fmIndex: Math.pow(g[G.fmIndex], 2) * 6,
    noise: g[G.noise],
    attack: 0.002 + Math.pow(g[G.attack], 2.2) * 0.6 * (0.4 + size),
    decay: 0.04 + Math.pow(g[G.decay], 1.6) * 1.6 * (0.3 + size * 1.4),
    cutoff: g[G.cutoff],
    resonance: g[G.resonance],
    rhythmDiv: RHYTHM_DIVS[Math.min(RHYTHM_DIVS.length - 1, Math.floor(g[G.rhythm] * RHYTHM_DIVS.length))],
    drone: size > 0.5 && g[G.drone] > 0.55,
    harmonicity,
    loudness: 0.4 + size * 0.6,
  };
}

const SYL_A = ['vel', 'aur', 'cth', 'lum', 'syr', 'nox', 'pha', 'quel', 'zor', 'thal', 'ix', 'myr', 'oph', 'cyr', 'xen', 'hal', 'sel', 'vor', 'bry', 'drae'];
const SYL_B = ['ia', 'o', 'ula', 'ix', 'ora', 'eum', 'ella', 'yx', 'ion', 'ae', 'is', 'ana'];
const SYL_C = ['phona', 'sonans', 'abyssi', 'vitrea', 'statica', 'florens', 'nulla', 'canora', 'tremens', 'lucida', 'resonans', 'cantrix', 'murmura', 'glacia', 'pulsar'];

export function speciesName(id: number, seed: number): string {
  const r = new RNG((id * 2654435761 + seed) >>> 0);
  const g = r.pick(SYL_A) + r.pick(SYL_B) + (r.chance(0.4) ? r.pick(SYL_A) : '');
  return g.charAt(0).toUpperCase() + g.slice(1) + ' ' + r.pick(SYL_C);
}
