export type HabitatType = 'abyss' | 'glass' | 'marsh' | 'bloom' | 'null' | 'custom';

export interface HabitatParams {
  name: string;
  type: HabitatType;
  resourceRate: number; // food spawn
  light: number; // photosynthesis & visibility
  temperature: number; // thermal niche
  pressure: number; // penalizes fast movement, favors large bodies
  viscosity: number; // drag
  instability: number; // electrical jolts + broadband masking
  resonance: number; // rewards harmonic voices (signal carry)
  spectralCenter: number; // frequency band that propagates best (0 low..1 high)
  tonality: number; // 1 = tonal signals carry, 0 = noisy signals cut through
  damping: number; // acoustic attenuation
  callCost: number; // energetic cost of vocalizing
  mutationMul: number; // radiation
  color: [number, number, number];
  color2: [number, number, number];
}

export const HABITAT_PRESETS: Record<HabitatType, HabitatParams> = {
  abyss: {
    name: 'The Abyss', type: 'abyss', resourceRate: 0.35, light: 0.02, temperature: 0.12, pressure: 0.9, viscosity: 0.6,
    instability: 0.05, resonance: 0.3, spectralCenter: 0.1, tonality: 0.7, damping: 0.25, callCost: 0.4, mutationMul: 0.8,
    color: [0.01, 0.02, 0.07], color2: [0.05, 0.1, 0.35],
  },
  glass: {
    name: 'The Glass Garden', type: 'glass', resourceRate: 0.5, light: 0.55, temperature: 0.45, pressure: 0.35, viscosity: 0.35,
    instability: 0.05, resonance: 0.95, spectralCenter: 0.62, tonality: 0.95, damping: 0.1, callCost: 0.35, mutationMul: 1,
    color: [0.02, 0.06, 0.08], color2: [0.25, 0.75, 0.8],
  },
  marsh: {
    name: 'The Static Marsh', type: 'marsh', resourceRate: 0.55, light: 0.3, temperature: 0.62, pressure: 0.4, viscosity: 0.55,
    instability: 0.85, resonance: 0.1, spectralCenter: 0.75, tonality: 0.1, damping: 0.45, callCost: 0.5, mutationMul: 1.8,
    color: [0.05, 0.05, 0.02], color2: [0.6, 0.65, 0.15],
  },
  bloom: {
    name: 'The Bloom Chamber', type: 'bloom', resourceRate: 1, light: 0.95, temperature: 0.78, pressure: 0.15, viscosity: 0.3,
    instability: 0.1, resonance: 0.5, spectralCenter: 0.55, tonality: 0.6, damping: 0.2, callCost: 0.3, mutationMul: 1.2,
    color: [0.07, 0.02, 0.05], color2: [0.9, 0.3, 0.55],
  },
  null: {
    name: 'The Null Zone', type: 'null', resourceRate: 0.07, light: 0.1, temperature: 0.3, pressure: 0.5, viscosity: 0.4,
    instability: 0.02, resonance: 0.2, spectralCenter: 0.4, tonality: 0.5, damping: 0.6, callCost: 2.5, mutationMul: 0.6,
    color: [0.015, 0.015, 0.02], color2: [0.25, 0.25, 0.3],
  },
  custom: {
    name: 'Custom Habitat', type: 'custom', resourceRate: 0.5, light: 0.5, temperature: 0.5, pressure: 0.5, viscosity: 0.4,
    instability: 0.2, resonance: 0.5, spectralCenter: 0.5, tonality: 0.5, damping: 0.3, callCost: 0.5, mutationMul: 1,
    color: [0.03, 0.03, 0.05], color2: [0.6, 0.4, 0.9],
  },
};

export const HABITAT_SLIDERS: { k: keyof HabitatParams; label: string; hint: string }[] = [
  { k: 'resourceRate', label: 'Nutrient flux', hint: 'Food particle spawn rate' },
  { k: 'light', label: 'Light', hint: 'Photosynthesis for translucent bodies; darkness rewards bioluminescence' },
  { k: 'temperature', label: 'Temperature', hint: 'Organisms pay energy for thermal mismatch' },
  { k: 'pressure', label: 'Pressure', hint: 'Fast movement costs more; favors large slow bodies' },
  { k: 'viscosity', label: 'Viscosity', hint: 'Movement drag' },
  { k: 'instability', label: 'Electrical static', hint: 'Random jolts & broadband masking noise' },
  { k: 'resonance', label: 'Resonance', hint: 'Harmonic voices carry further' },
  { k: 'spectralCenter', label: 'Acoustic window', hint: 'Frequency band that propagates best (low → high)' },
  { k: 'tonality', label: 'Tonal clarity', hint: 'High: pure tones carry. Low: noisy signals cut through static' },
  { k: 'damping', label: 'Acoustic damping', hint: 'Signal attenuation with distance' },
  { k: 'callCost', label: 'Call cost', hint: 'Energy spent per vocalization (×)', },
  { k: 'mutationMul', label: 'Radiation', hint: 'Local mutation multiplier (×)' },
];

export function sliderMax(k: keyof HabitatParams) {
  return k === 'callCost' ? 3 : k === 'mutationMul' ? 3 : 1;
}

export function cloneHabitat(h: HabitatParams): HabitatParams {
  return { ...h, color: [...h.color] as [number, number, number], color2: [...h.color2] as [number, number, number] };
}
