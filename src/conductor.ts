import type { World } from './sim/world';
import type { AudioEngine } from './audio/engine';

export interface AutoPoint { t: number; v: number }
export interface Lane {
  key: 'resource' | 'temperature' | 'light' | 'static' | 'mutation' | 'tempo' | 'reverb' | 'sync' | 'density';
  label: string;
  color: string;
  enabled: boolean;
  points: AutoPoint[];
  describe: (v: number) => string;
}

export function defaultLanes(): Lane[] {
  return [
    { key: 'resource', label: 'Nutrient flux', color: '#ffe27a', enabled: true, points: [{ t: 0, v: 0.5 }, { t: 0.3, v: 0.8 }, { t: 0.6, v: 0.2 }, { t: 1, v: 0.5 }], describe: (v) => `×${(0.1 + v * 2.4).toFixed(2)}` },
    { key: 'temperature', label: 'Temperature', color: '#ff7a5c', enabled: true, points: [{ t: 0, v: 0.5 }, { t: 0.5, v: 0.62 }, { t: 1, v: 0.5 }], describe: (v) => `${v >= 0.5 ? '+' : ''}${((v - 0.5) * 0.6).toFixed(2)}` },
    { key: 'light', label: 'Light', color: '#fff4c2', enabled: false, points: [{ t: 0, v: 0.5 }, { t: 1, v: 0.5 }], describe: (v) => `${v >= 0.5 ? '+' : ''}${((v - 0.5) * 0.8).toFixed(2)}` },
    { key: 'static', label: 'Electrical static', color: '#d6ff4a', enabled: false, points: [{ t: 0, v: 0 }, { t: 0.7, v: 0 }, { t: 0.8, v: 0.8 }, { t: 0.9, v: 0 }], describe: (v) => `+${(v * 0.8).toFixed(2)}` },
    { key: 'mutation', label: 'Mutation rate', color: '#c78bff', enabled: false, points: [{ t: 0, v: 0.25 }, { t: 1, v: 0.25 }], describe: (v) => `${(v * 0.25).toFixed(3)}` },
    { key: 'tempo', label: 'Tempo', color: '#7fd8ff', enabled: true, points: [{ t: 0, v: 0.35 }, { t: 0.5, v: 0.5 }, { t: 1, v: 0.35 }], describe: (v) => `${Math.round(40 + v * 140)} bpm` },
    { key: 'sync', label: 'Sync coupling', color: '#a0ffc8', enabled: false, points: [{ t: 0, v: 0.3 }, { t: 1, v: 0.9 }], describe: (v) => `×${(v * 3).toFixed(2)}` },
    { key: 'density', label: 'Call density', color: '#ff8fd8', enabled: false, points: [{ t: 0, v: 0.5 }, { t: 1, v: 0.5 }], describe: (v) => `×${(v * 2).toFixed(2)}` },
    { key: 'reverb', label: 'Reverb space', color: '#8fa8ff', enabled: false, points: [{ t: 0, v: 0.45 }, { t: 1, v: 0.45 }], describe: (v) => `${Math.round(v * 100)}%` },
  ];
}

export function sampleLane(l: Lane, t: number): number {
  const p = l.points;
  if (!p.length) return 0.5;
  if (t <= p[0].t) return p[0].v;
  for (let i = 1; i < p.length; i++) {
    if (t <= p[i].t) {
      const a = p[i - 1], b = p[i];
      const f = (t - a.t) / Math.max(1e-6, b.t - a.t);
      const s = f * f * (3 - 2 * f);
      return a.v + (b.v - a.v) * s;
    }
  }
  return p[p.length - 1].v;
}

export function applyLanes(lanes: Lane[], t: number, world: World, audio: AudioEngine) {
  const g = world.globals;
  for (const l of lanes) {
    if (!l.enabled) continue;
    const v = sampleLane(l, t);
    switch (l.key) {
      case 'resource': g.resourceMul = 0.1 + v * 2.4; break;
      case 'temperature': g.tempOffset = (v - 0.5) * 0.6; break;
      case 'light': g.lightOffset = (v - 0.5) * 0.8; break;
      case 'static': g.instabilityAdd = v * 0.8; break;
      case 'mutation': g.mutationRate = v * 0.25; break;
      case 'tempo': g.tempo = Math.round(40 + v * 140); audio.setTempo(g.tempo); break;
      case 'sync': g.syncStrength = v * 3; break;
      case 'density': g.callDensity = v * 2; break;
      case 'reverb': audio.setReverb(v); break;
    }
  }
}
