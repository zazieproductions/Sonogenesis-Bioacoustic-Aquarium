import { RNG, clamp, hashGenome } from './rng';
import { express, mutate, crossover, geneticDistance, randomGenome, speciesName, Phenotype, G } from './genome';
import { HabitatParams, HABITAT_PRESETS, HabitatType, cloneHabitat } from './habitats';

export const ZONE_W = 760;
export const WORLD_H = 900;
const CELL = 140;

export type CallType = 'pulse' | 'social' | 'mating' | 'territory' | 'food' | 'distress';
export const CALL_TYPES: CallType[] = ['pulse', 'social', 'mating', 'territory', 'food', 'distress'];
export const CALL_COLORS: Record<CallType, string> = {
  pulse: '#7fd8ff',
  social: '#a0ffc8',
  mating: '#ff8fd8',
  territory: '#ff6a3d',
  food: '#ffe27a',
  distress: '#ff3355',
};

export interface Organism {
  id: number;
  genome: number[];
  ph: Phenotype;
  body?: unknown;
  speciesId: number;
  parentId: number;
  parent2Id: number;
  generation: number;
  x: number; y: number; vx: number; vy: number; angle: number;
  energy: number;
  health: number;
  age: number;
  alive: boolean;
  phase: number;
  motif: number[];
  voiceEnv: number;
  lastCallType: CallType | null;
  callCd: number;
  respTimer: number;
  respCd: number;
  mateTarget: number;
  mateWait: number;
  memX: number; memY: number; memW: number; memT: number;
  bondId: number; bondStr: number;
  distressCd: number;
  state: string;
  muted: boolean;
  trail: number[];
  zone: number;
  children: number;
  born: number;
  mutations: number;
  wanderA: number;
  callsMade: number;
}

export interface Food { x: number; y: number; e: number; alive: boolean }
export interface Signal { x: number; y: number; r: number; maxR: number; type: CallType; age: number; src: number }

export interface AudioEvent {
  id: number; type: CallType; x: number; y: number; intensity: number; notes: number[]; ph: Phenotype; muted: boolean; time: number;
}

export interface Species {
  id: number; name: string; rep: number[]; hue: number; born: number; extinct: number | null; count: number; peak: number;
  parent: number; totalBorn: number;
}

export interface LineageRec {
  id: number; parentId: number; parent2Id: number; speciesId: number; gen: number; born: number; died: number | null;
  hue: number; genome: number[]; children: number[]; cause?: string;
}

export interface StatSample {
  t: number; pop: number; food: number; species: Record<number, number>; meanFreq: number; meanSize: number;
  meanEnergy: number; births: number; deaths: number; mutations: number; calls: number; meanNoise: number;
  meanHarm: number; meanGen: number; diversity: number; callMix: Record<CallType, number>;
}

export interface WorldEvent { t: number; kind: 'speciation' | 'extinction' | 'habitat' | 'info' | 'founder'; text: string; hue?: number }

export interface Globals {
  resourceMul: number; tempOffset: number; lightOffset: number; instabilityAdd: number;
  mutationRate: number; mutationStrength: number; speciationThreshold: number; maxPop: number;
  freezeLife: boolean; tempo: number; syncStrength: number; callDensity: number;
}

export interface KeyFrame { t: number; orgs: SerialOrg[]; pop: number; species: number }

export interface SerialOrg {
  id: number; genome: number[]; speciesId: number; parentId: number; parent2Id: number; generation: number;
  x: number; y: number; vx: number; vy: number; angle: number; energy: number; age: number; phase: number; motif: number[];
  muted: boolean; children: number; born: number; mutations: number;
}

export function signalEfficiency(ph: Phenotype, h: HabitatParams): number {
  const band = 1 - Math.min(1, Math.abs(ph.spectral - h.spectralCenter) * 1.7);
  const tonalMatch = 1 - Math.abs(1 - ph.noise - h.tonality);
  let eff = 0.18 + 0.47 * band + 0.35 * tonalMatch + h.resonance * ph.harmonicity * 0.35;
  eff *= 1 - h.damping * 0.6;
  return clamp(eff, 0.08, 1.4);
}

export function callRange(ph: Phenotype, h: HabitatParams) {
  return (90 + 170 * ph.loudness) * signalEfficiency(ph, h);
}

export class World {
  seed: number;
  rng: RNG;
  time = 0;
  nextId = 1;
  nextSpecies = 1;
  zones: HabitatParams[] = [];
  orgs: Organism[] = [];
  food: Food[] = [];
  foodPool: Food[] = [];
  signals: Signal[] = [];
  species = new Map<number, Species>();
  lineage = new Map<number, LineageRec>();
  stats: StatSample[] = [];
  events: WorldEvent[] = [];
  keyframes: KeyFrame[] = [];
  audioEvents: AudioEvent[] = [];
  globals: Globals = {
    resourceMul: 1, tempOffset: 0, lightOffset: 0, instabilityAdd: 0, mutationRate: 0.08, mutationStrength: 0.07,
    speciationThreshold: 0.09, maxPop: 380, freezeLife: false, tempo: 92, syncStrength: 1, callDensity: 1,
  };
  totalMutations = 0;
  private acc = { births: 0, deaths: 0, mutations: 0, calls: 0, callMix: {} as Record<CallType, number> };
  private statTimer = 0;
  private kfTimer = 0;
  private grid: number[][] = [];
  private foodGrid: number[][] = [];
  private cols = 0;
  private rows = 0;
  private foodAcc: number[] = [];

  constructor(seed: number, empty = false) {
    this.seed = seed;
    this.rng = new RNG(seed);
    this.cols = Math.ceil((ZONE_W * 5) / CELL);
    this.rows = Math.ceil(WORLD_H / CELL);
    for (let i = 0; i < this.cols * this.rows; i++) {
      this.grid.push([]);
      this.foodGrid.push([]);
    }
    this.resetCallMix();
    if (!empty) this.generate();
  }

  get width() {
    return ZONE_W * this.zones.length;
  }

  private resetCallMix() {
    this.acc.callMix = { pulse: 0, social: 0, mating: 0, territory: 0, food: 0, distress: 0 };
  }

  generate() {
    const r = this.rng;
    const order: HabitatType[] = ['abyss', 'glass', 'marsh', 'bloom', 'null'];
    // seeded permutation of habitats, with seed-specific parameter variation
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(r.next() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    this.zones = order.map((t) => {
      const h = cloneHabitat(HABITAT_PRESETS[t]);
      for (const k of ['resourceRate', 'light', 'temperature', 'pressure', 'instability', 'spectralCenter'] as const) {
        h[k] = clamp(h[k] + r.gauss() * 0.05);
      }
      return h;
    });
    this.foodAcc = this.zones.map(() => 0);
    for (let z = 0; z < this.zones.length; z++) {
      const n = Math.floor(30 + 70 * this.zones[z].resourceRate);
      for (let i = 0; i < n; i++) this.addFood(z * ZONE_W + r.range(20, ZONE_W - 20), r.range(20, WORLD_H - 20), r.range(7, 13));
    }
    const nSpecies = 8;
    for (let s = 0; s < nSpecies; s++) {
      const zone = s % this.zones.length;
      const base = randomGenome(r, { tempPref: this.zones[zone].temperature, diet: r.next() * 0.55 });
      const cx = zone * ZONE_W + r.range(120, ZONE_W - 120);
      const cy = r.range(150, WORLD_H - 150);
      const founder = this.spawn(cx, cy, base, { newSpecies: true, silentEvent: true });
      for (let i = 0; i < 4; i++) {
        const g = mutate(base, 0.15, 0.03, r).genome;
        this.spawn(cx + r.range(-80, 80), cy + r.range(-80, 80), g, { speciesId: founder.speciesId, parentId: 0 });
      }
    }
    this.events.push({ t: 0, kind: 'info', text: `World #${this.seed} formed — ${nSpecies} founder lineages seeded.` });
  }

  addFood(x: number, y: number, e: number) {
    const f = this.foodPool.pop() || { x: 0, y: 0, e: 0, alive: true };
    f.x = x; f.y = y; f.e = e; f.alive = true;
    this.food.push(f);
  }

  zoneIndex(x: number) {
    return Math.max(0, Math.min(this.zones.length - 1, Math.floor(x / ZONE_W)));
  }

  env(z: number): HabitatParams {
    return this.zones[z];
  }

  tempAt(x: number) {
    const f = x / ZONE_W - 0.5;
    const i = Math.floor(f);
    const t = f - i;
    const a = this.zones[Math.max(0, Math.min(this.zones.length - 1, i))].temperature;
    const b = this.zones[Math.max(0, Math.min(this.zones.length - 1, i + 1))].temperature;
    const s = t * t * (3 - 2 * t);
    return clamp(a + (b - a) * s + this.globals.tempOffset);
  }

  makeMotif(genome: number[]): number[] {
    const r = new RNG(hashGenome(genome));
    const len = 2 + Math.floor(genome[G.segments] * 3.99);
    const span = Math.max(1, Math.round(genome[G.pitchRange] * 7));
    const m: number[] = [];
    for (let i = 0; i < len; i++) m.push(r.int(-Math.floor(span / 2), span));
    return m;
  }

  spawn(
    x: number, y: number, genome: number[],
    opts: { speciesId?: number; parentId?: number; parent2Id?: number; generation?: number; newSpecies?: boolean; motif?: number[]; energyFrac?: number; energy?: number; mutations?: number; silentEvent?: boolean } = {},
  ): Organism {
    const ph = express(genome);
    let speciesId = opts.speciesId ?? 0;
    if (opts.newSpecies || !speciesId) {
      speciesId = this.createSpecies(genome, opts.speciesId ?? 0, opts.silentEvent);
    }
    const o: Organism = {
      id: this.nextId++, genome, ph, speciesId, parentId: opts.parentId ?? 0, parent2Id: opts.parent2Id ?? 0,
      generation: opts.generation ?? 0,
      x: clamp(x, 5, this.width - 5), y: clamp(y, 5, WORLD_H - 5), vx: 0, vy: 0, angle: this.rng.range(0, Math.PI * 2),
      energy: opts.energy ?? ph.capacity * (opts.energyFrac ?? 0.6), health: 1, age: 0, alive: true,
      phase: this.rng.next(), motif: opts.motif ?? this.makeMotif(genome), voiceEnv: 0, lastCallType: null,
      callCd: 0, respTimer: 0, respCd: 0, mateTarget: 0, mateWait: 0, memX: 0, memY: 0, memW: 0, memT: 0,
      bondId: 0, bondStr: 0, distressCd: 0, state: 'drift', muted: false, trail: [], zone: 0, children: 0,
      born: this.time, mutations: opts.mutations ?? 0, wanderA: this.rng.range(0, Math.PI * 2), callsMade: 0,
    };
    o.zone = this.zoneIndex(o.x);
    this.orgs.push(o);
    const sp = this.species.get(speciesId)!;
    sp.count++;
    sp.totalBorn++;
    if (sp.count > sp.peak) sp.peak = sp.count;
    this.lineage.set(o.id, {
      id: o.id, parentId: o.parentId, parent2Id: o.parent2Id, speciesId, gen: o.generation, born: this.time, died: null,
      hue: ph.hue, genome: genome.slice(), children: [],
    });
    const p = this.lineage.get(o.parentId);
    if (p) p.children.push(o.id);
    if (this.lineage.size > 9000) {
      let removed = 0;
      for (const [id, rec] of this.lineage) {
        if (rec.died !== null) { this.lineage.delete(id); removed++; }
        if (removed > 1200) break;
      }
    }
    return o;
  }

  createSpecies(genome: number[], parent: number, silent?: boolean): number {
    const id = this.nextSpecies++;
    const sp: Species = {
      id, name: speciesName(id, this.seed), rep: genome.slice(), hue: genome[G.hue] * 360, born: this.time, extinct: null,
      count: 0, peak: 0, parent, totalBorn: 0,
    };
    this.species.set(id, sp);
    if (!silent) {
      const pn = parent ? this.species.get(parent)?.name : null;
      this.events.push({
        t: this.time, kind: parent ? 'speciation' : 'founder', hue: sp.hue,
        text: parent ? `Speciation: ${sp.name} diverged from ${pn}` : `New species introduced: ${sp.name}`,
      });
    }
    return id;
  }

  assignSpecies(genome: number[], parentSpecies: number): number {
    const thr = this.globals.speciationThreshold;
    const ps = this.species.get(parentSpecies);
    if (ps && geneticDistance(genome, ps.rep) < thr) return parentSpecies;
    let best = -1;
    let bestD = thr;
    for (const sp of this.species.values()) {
      if (sp.count <= 0) continue;
      const d = geneticDistance(genome, sp.rep);
      if (d < bestD) { bestD = d; best = sp.id; }
    }
    if (best >= 0) return best;
    return this.createSpecies(genome, parentSpecies);
  }

  kill(o: Organism, cause = 'starvation') {
    if (!o.alive) return;
    o.alive = false;
    this.acc.deaths++;
    const sp = this.species.get(o.speciesId);
    if (sp) {
      sp.count--;
      if (sp.count <= 0 && sp.extinct === null) {
        sp.extinct = this.time;
        this.events.push({ t: this.time, kind: 'extinction', text: `Extinction: ${sp.name} (peak ${sp.peak})`, hue: sp.hue });
      }
    }
    const rec = this.lineage.get(o.id);
    if (rec) { rec.died = this.time; rec.cause = cause; }
    if (cause !== 'removed' && cause !== 'eaten') {
      const n = Math.min(4, 1 + Math.floor(o.ph.radius / 10));
      for (let i = 0; i < n; i++) this.addFood(o.x + this.rng.range(-o.ph.radius, o.ph.radius), o.y + this.rng.range(-o.ph.radius, o.ph.radius), 6 + o.ph.radius * 0.2);
    }
  }

  private buildGrids() {
    for (const c of this.grid) c.length = 0;
    for (const c of this.foodGrid) c.length = 0;
    for (let i = 0; i < this.orgs.length; i++) {
      const o = this.orgs[i];
      this.grid[this.cellIdx(o.x, o.y)].push(i);
    }
    for (let i = 0; i < this.food.length; i++) {
      const f = this.food[i];
      this.foodGrid[this.cellIdx(f.x, f.y)].push(i);
    }
  }

  private cellIdx(x: number, y: number) {
    const cx = Math.max(0, Math.min(this.cols - 1, Math.floor(x / CELL)));
    const cy = Math.max(0, Math.min(this.rows - 1, Math.floor(y / CELL)));
    return cy * this.cols + cx;
  }

  near(x: number, y: number, r: number, cb: (o: Organism) => void, food = false) {
    const x0 = Math.max(0, Math.floor((x - r) / CELL));
    const x1 = Math.min(this.cols - 1, Math.floor((x + r) / CELL));
    const y0 = Math.max(0, Math.floor((y - r) / CELL));
    const y1 = Math.min(this.rows - 1, Math.floor((y + r) / CELL));
    const g = food ? this.foodGrid : this.grid;
    for (let cy = y0; cy <= y1; cy++)
      for (let cx = x0; cx <= x1; cx++) {
        const cell = g[cy * this.cols + cx];
        for (let k = 0; k < cell.length; k++) cb((food ? this.food[cell[k]] : this.orgs[cell[k]]) as Organism);
      }
  }

  nearFood(x: number, y: number, r: number, cb: (f: Food) => void) {
    this.near(x, y, r, cb as unknown as (o: Organism) => void, true);
  }

  step(dt: number) {
    this.time += dt;
    const gl = this.globals;
    const W = this.width;
    // --- resources
    for (let z = 0; z < this.zones.length; z++) {
      const h = this.zones[z];
      this.foodAcc[z] += h.resourceRate * gl.resourceMul * 10 * dt;
      let zoneFood = 0;
      // approximate cap
      if (this.food.length > 900) zoneFood = 999;
      while (this.foodAcc[z] >= 1) {
        this.foodAcc[z] -= 1;
        if (zoneFood < 999) {
          // nutrients cluster in drifting plumes
          const px = z * ZONE_W + ZONE_W * (0.5 + 0.38 * Math.sin(this.time * 0.05 + z * 2.1));
          const py = WORLD_H * (0.5 + 0.35 * Math.cos(this.time * 0.037 + z));
          const near = this.rng.chance(0.55);
          const x = near ? px + this.rng.gauss() * 140 : z * ZONE_W + this.rng.range(10, ZONE_W - 10);
          const y = near ? py + this.rng.gauss() * 140 : this.rng.range(10, WORLD_H - 10);
          this.addFood(clamp(x, z * ZONE_W + 5, (z + 1) * ZONE_W - 5), clamp(y, 5, WORLD_H - 5), this.rng.range(7, 13));
        }
      }
    }
    this.buildGrids();
    const bps = gl.tempo / 60;
    const pop = this.orgs.length;

    for (let i = 0; i < this.orgs.length; i++) {
      const o = this.orgs[i];
      if (!o.alive) continue;
      const ph = o.ph;
      o.zone = this.zoneIndex(o.x);
      const h = this.zones[o.zone];
      const light = clamp(h.light + gl.lightOffset);
      const instab = clamp(h.instability + gl.instabilityAdd);
      if (!gl.freezeLife) o.age += dt;
      o.voiceEnv *= Math.exp(-dt * 4);
      o.callCd -= dt; o.respCd -= dt; o.distressCd -= dt; o.memT -= dt;
      o.bondStr *= Math.exp(-dt * 0.05);

      const sense = ph.senseRange * (0.45 + 0.55 * light + ph.lumin * (1 - light) * 0.75);
      let ax = 0, ay = 0;
      // wander
      o.wanderA += (this.rng.next() - 0.5) * ph.turn * dt * 4;
      ax += Math.cos(o.wanderA) * 0.6;
      ay += Math.sin(o.wanderA) * 0.6;

      // food seeking
      const hunger = 1 - o.energy / ph.capacity;
      let foodTarget: Food | null = null;
      let fd = sense * sense;
      let foodNear = 0;
      if (ph.diet < 0.85) {
        this.nearFood(o.x, o.y, sense, (f) => {
          if (!f.alive) return;
          const dx = f.x - o.x, dy = f.y - o.y;
          const d = dx * dx + dy * dy;
          if (d < sense * sense) foodNear++;
          if (d < fd) { fd = d; foodTarget = f; }
        });
      }
      o.state = 'drift';
      if (foodTarget) {
        const f = foodTarget as Food;
        const dx = f.x - o.x, dy = f.y - o.y;
        const d = Math.sqrt(fd) + 0.01;
        const w = (0.6 + hunger * 2.2) * (1 - ph.diet);
        ax += (dx / d) * w; ay += (dy / d) * w;
        o.state = 'forage';
        if (d < ph.radius + 4) {
          f.alive = false;
          o.energy += f.e * (1 - ph.diet * 0.6);
          if (ph.sociality > 0.5 && foodNear > 3 && o.callCd <= 0 && this.rng.chance(0.15 * ph.callRate + 0.05)) this.emit(o, 'food', h);
        }
      }

      // neighbors: flocking, predation, threat
      let cx = 0, cy = 0, cn = 0, alx = 0, aly = 0, sx = 0, sy = 0;
      let prey: Organism | null = null, preyD = 1e9;
      let threat: Organism | null = null, threatD = 1e9;
      let mate: Organism | null = null;
      let otherNear = false;
      const mature = o.age > ph.maturity;
      const ready = !gl.freezeLife && mature && o.energy > ph.capacity * ph.reproFrac;
      this.near(o.x, o.y, sense, (n) => {
        if (n === o || !n.alive) return;
        const dx = n.x - o.x, dy = n.y - o.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > sense * sense) return;
        const d = Math.sqrt(d2) + 0.01;
        const same = n.speciesId === o.speciesId;
        const minD = ph.radius + n.ph.radius + 4;
        if (d < minD * 1.4) { sx -= (dx / d) * (minD * 1.4 - d) / minD; sy -= (dy / d) * (minD * 1.4 - d) / minD; }
        if (same) {
          cx += n.x; cy += n.y; alx += n.vx; aly += n.vy; cn++;
          if (ready && n.age > n.ph.maturity && n.energy > n.ph.capacity * n.ph.reproFrac && d < minD + 6 && !mate) mate = n;
        } else {
          otherNear = true;
          if (ph.diet > 0.4 && n.ph.radius < ph.radius * 1.15 && d < preyD) { prey = n; preyD = d; }
          if (n.ph.diet > 0.4 && n.ph.radius > ph.radius * 0.9 && d < threatD) { threat = n; threatD = d; }
        }
      });
      if (cn > 0) {
        const s = ph.sociality;
        cx = cx / cn - o.x; cy = cy / cn - o.y;
        const cd = Math.hypot(cx, cy) + 0.01;
        ax += (cx / cd) * s * 0.9; ay += (cy / cd) * s * 0.9;
        const ald = Math.hypot(alx, aly) + 0.01;
        ax += (alx / ald) * s * 0.5; ay += (aly / ald) * s * 0.5;
        if (s > 0.5 && cn > 2) o.state = o.state === 'forage' ? 'forage' : 'flock';
      }
      ax += sx * 2.5; ay += sy * 2.5;
      if (prey && hunger > 0.25) {
        const p = prey as Organism;
        const dx = p.x - o.x, dy = p.y - o.y;
        ax += (dx / preyD) * (1 + hunger * 2.5) * ph.diet; ay += (dy / preyD) * (1 + hunger * 2.5) * ph.diet;
        o.state = 'hunt';
        if (preyD < ph.radius + p.ph.radius + 2) {
          const bite = Math.min(p.energy, (16 + ph.radius * 0.8) * dt * (0.5 + ph.aggression));
          p.energy -= bite;
          o.energy += bite * 0.8 * ph.diet;
          if (p.distressCd <= 0) { p.distressCd = 1.4; this.emit(p, 'distress', this.zones[p.zone]); }
          if (p.energy <= 0) this.kill(p, 'eaten');
        }
      }
      if (threat) {
        const t = threat as Organism;
        const dx = t.x - o.x, dy = t.y - o.y;
        const w = 2.2 * (1 - ph.aggression * 0.6);
        ax -= (dx / threatD) * w; ay -= (dy / threatD) * w;
        if (o.state !== 'hunt') o.state = 'flee';
      }
      // acoustic memory (approach/avoid heard locations)
      if (o.memT > 0) {
        const dx = o.memX - o.x, dy = o.memY - o.y;
        const d = Math.hypot(dx, dy) + 0.01;
        if (d > 10) { ax += (dx / d) * o.memW; ay += (dy / d) * o.memW; }
      }
      // mate approach
      if (ready && o.mateTarget) {
        const m = this.findOrg(o.mateTarget);
        if (m && m.alive) {
          const dx = m.x - o.x, dy = m.y - o.y;
          const d = Math.hypot(dx, dy) + 0.01;
          ax += (dx / d) * 2; ay += (dy / d) * 2;
          o.state = 'court';
        } else o.mateTarget = 0;
      }
      // thermal niche: follow temperature gradient toward preference
      const tHere = this.tempAt(o.x);
      const mismatch = Math.abs(tHere - ph.tempPref);
      if (mismatch > 0.08) {
        const tL = Math.abs(this.tempAt(o.x - 60) - ph.tempPref);
        const tR = Math.abs(this.tempAt(o.x + 60) - ph.tempPref);
        ax += (tL - tR) * 4;
      }
      // bonded symbiont attraction
      if (o.bondId && o.bondStr > 0.8) {
        const b = this.findOrg(o.bondId);
        if (b && b.alive) {
          const dx = b.x - o.x, dy = b.y - o.y;
          const d = Math.hypot(dx, dy) + 0.01;
          if (d > 50 && d < 300) { ax += (dx / d) * 0.6; ay += (dy / d) * 0.6; }
          if (d < 90) o.energy += 0.35 * dt * Math.min(2, o.bondStr); // mutualism
        } else { o.bondId = 0; o.bondStr = 0; }
      }

      // integrate
      const am = Math.hypot(ax, ay) + 0.001;
      const accel = ph.maxSpeed * 2.2;
      o.vx += (ax / am) * Math.min(am, 3) / 3 * accel * dt;
      o.vy += (ay / am) * Math.min(am, 3) / 3 * accel * dt;
      const drag = Math.exp(-dt * (0.6 + h.viscosity * 2.4));
      o.vx *= drag; o.vy *= drag;
      const sp = Math.hypot(o.vx, o.vy);
      if (sp > ph.maxSpeed) { o.vx *= ph.maxSpeed / sp; o.vy *= ph.maxSpeed / sp; }
      o.x += o.vx * dt; o.y += o.vy * dt;
      if (o.x < ph.radius) { o.x = ph.radius; o.vx = Math.abs(o.vx); o.wanderA = 0; }
      if (o.x > W - ph.radius) { o.x = W - ph.radius; o.vx = -Math.abs(o.vx); o.wanderA = Math.PI; }
      if (o.y < ph.radius) { o.y = ph.radius; o.vy = Math.abs(o.vy); o.wanderA = Math.PI / 2; }
      if (o.y > WORLD_H - ph.radius) { o.y = WORLD_H - ph.radius; o.vy = -Math.abs(o.vy); o.wanderA = -Math.PI / 2; }
      if (sp > 2) {
        const ta = Math.atan2(o.vy, o.vx);
        let da = ta - o.angle;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        o.angle += da * Math.min(1, dt * 4);
      }
      // trail
      if (o.trail.length === 0 || Math.hypot(o.trail[o.trail.length - 2] - o.x, o.trail[o.trail.length - 1] - o.y) > 6) {
        o.trail.push(o.x, o.y);
        if (o.trail.length > 24) o.trail.splice(0, 2);
      }

      // metabolism
      if (!gl.freezeLife) {
        const speedFrac = sp / 100;
        let cost = ph.metabolism;
        cost += h.pressure * speedFrac * speedFrac * 2.2;
        cost += h.pressure * (1 - o.genome[G.size]) * 0.5;
        cost += mismatch * 1.6;
        o.energy -= cost * dt;
        // photosynthesis for translucent non-predators
        o.energy += light * (1 - ph.opacity) * 0.75 * (1 - ph.diet) * dt;
        // electrical jolts
        if (this.rng.chance(instab * 0.18 * dt)) {
          o.energy -= 7 * (1 - ph.noise * 0.75);
          o.voiceEnv = Math.max(o.voiceEnv, 0.5);
        }
        if (o.energy > ph.capacity) o.energy = ph.capacity;
        o.health = clamp(o.energy / (ph.capacity * 0.3)) * clamp(1 - (o.age - ph.lifespan * 0.8) / (ph.lifespan * 0.2));
        if (o.energy <= 0) { this.kill(o, 'starvation'); continue; }
        if (o.age > ph.lifespan) { this.kill(o, 'senescence'); continue; }
      }

      // rhythm & vocalization (pulse-coupled oscillator)
      o.phase += bps * ph.rhythmDiv * 0.5 * dt;
      if (o.respTimer > 0) {
        o.respTimer -= dt;
        if (o.respTimer <= 0) this.emit(o, 'social', h, true);
      }
      if (o.phase >= 1) {
        o.phase -= 1;
        const energyF = clamp(o.energy / (ph.capacity * 0.4));
        const p = Math.pow(ph.callRate, 1.5) * 0.45 * energyF * gl.callDensity;
        if (o.callCd <= 0 && this.rng.chance(p)) {
          let type: CallType = 'pulse';
          if (ready && ph.sexual > 0.35) type = 'mating';
          else if (ph.aggression > 0.55 && otherNear) type = 'territory';
          else if (ph.sociality > 0.4 && this.rng.chance(ph.sociality)) type = 'social';
          this.emit(o, type, h);
        }
      }

      // reproduction
      if (ready && pop < gl.maxPop) {
        if (mate && (mate as Organism).alive) {
          this.reproduce(o, mate as Organism, h);
        } else {
          o.mateWait += dt;
          const patience = 6 + ph.sexual * 40;
          if (o.mateWait > patience) this.reproduce(o, null, h);
        }
      }
    }

    // cleanup
    if (this.orgs.some((o) => !o.alive)) this.orgs = this.orgs.filter((o) => o.alive);
    if (this.food.some((f) => !f.alive)) {
      const keep: Food[] = [];
      for (const f of this.food) (f.alive ? keep : this.foodPool).push(f);
      this.food = keep;
    }
    for (const s of this.signals) { s.age += dt; s.r = s.maxR * Math.min(1, s.age / 0.9); }
    this.signals = this.signals.filter((s) => s.age < 1.2);
    this.orgIndex = null;

    this.statTimer += dt;
    if (this.statTimer >= 1) { this.statTimer = 0; this.sample(); }
    this.kfTimer += dt;
    if (this.kfTimer >= 12) { this.kfTimer = 0; this.keyframe(); }
  }

  private orgIndex: Map<number, Organism> | null = null;
  findOrg(id: number): Organism | undefined {
    if (!this.orgIndex) {
      this.orgIndex = new Map();
      for (const o of this.orgs) this.orgIndex.set(o.id, o);
    }
    return this.orgIndex.get(id);
  }

  reproduce(o: Organism, mate: Organism | null, h: HabitatParams) {
    const gl = this.globals;
    const ph = o.ph;
    const brood = ph.brood;
    const invest = o.energy * 0.55 + (mate ? mate.energy * 0.3 : 0);
    o.energy *= 0.45;
    if (mate) { mate.energy *= 0.7; mate.mateWait = 0; mate.mateTarget = 0; mate.children++; }
    o.mateWait = 0; o.mateTarget = 0;
    const rate = gl.mutationRate * h.mutationMul * (mate ? 1 : 1.4);
    for (let i = 0; i < brood; i++) {
      if (this.orgs.length >= gl.maxPop) break;
      const base = mate ? crossover(o.genome, mate.genome, this.rng) : o.genome;
      const m = mutate(base, rate, gl.mutationStrength, this.rng);
      this.totalMutations += m.count;
      this.acc.mutations += m.count;
      this.acc.births++;
      const speciesId = this.assignSpecies(m.genome, o.speciesId);
      // cultural inheritance of the parent's current song, slightly altered by mutation
      const motif = o.motif.slice();
      if (m.count > 2 && motif.length) motif[this.rng.int(0, motif.length - 1)] += this.rng.int(-2, 2);
      const a = this.rng.range(0, Math.PI * 2);
      const child = this.spawn(o.x + Math.cos(a) * ph.radius * 1.5, o.y + Math.sin(a) * ph.radius * 1.5, m.genome, {
        speciesId, parentId: o.id, parent2Id: mate ? mate.id : 0, generation: Math.max(o.generation, mate?.generation ?? 0) + 1,
        motif, energy: invest / brood, mutations: m.count,
      });
      child.vx = Math.cos(a) * 20; child.vy = Math.sin(a) * 20;
    }
    o.children += brood;
  }

  emit(o: Organism, type: CallType, h: HabitatParams, isResponse = false) {
    const ph = o.ph;
    const range = callRange(ph, h) * (type === 'distress' ? 1.3 : type === 'pulse' ? 0.7 : 1);
    o.energy -= 0.55 * h.callCost * (0.5 + ph.loudness) * (type === 'pulse' ? 0.5 : 1);
    o.callCd = type === 'pulse' ? 0.15 : 0.6;
    o.voiceEnv = 1;
    o.lastCallType = type;
    o.callsMade++;
    this.acc.calls++;
    this.acc.callMix[type]++;
    if (this.signals.length < 260) this.signals.push({ x: o.x, y: o.y, r: 0, maxR: range, type, age: 0, src: o.id });
    if (this.audioEvents.length < 300) {
      this.audioEvents.push({
        id: o.id, type, x: o.x, y: o.y, intensity: clamp(o.energy / ph.capacity + 0.3), notes: o.motif.slice(), ph,
        muted: o.muted, time: this.time,
      });
    }
    // propagate to listeners
    const gl = this.globals;
    this.near(o.x, o.y, range, (n) => {
      if (n === o || !n.alive) return;
      const d = Math.hypot(n.x - o.x, n.y - o.y);
      if (d > range) return;
      const perceived = (1 - d / range) * n.ph.hearing;
      if (perceived < 0.08) return;
      const same = n.speciesId === o.speciesId;
      const bonded = n.bondId === o.id;
      switch (type) {
        case 'mating':
          if (same && n.age > n.ph.maturity && n.energy > n.ph.capacity * n.ph.reproFrac) n.mateTarget = o.id;
          break;
        case 'social':
        case 'pulse': {
          const coupling = gl.syncStrength * n.ph.syncTend * perceived * (same ? 0.35 : 0.12);
          n.phase = Math.min(0.9999, n.phase + coupling * n.phase); // firefly-style pulse coupling
          if (type === 'social' && (same || bonded || n.ph.sociality > 0.75)) {
            if (n.bondId === o.id) n.bondStr += perceived * 0.25;
            else if (n.bondStr < 0.3) { n.bondId = o.id; n.bondStr = perceived * 0.25; }
            if (same && this.rng.chance(n.ph.mimicry * perceived * 0.35) && o.motif.length) {
              const k = this.rng.int(0, Math.min(n.motif.length, o.motif.length) - 1);
              if (k >= 0) n.motif[k] = o.motif[k];
              if (this.rng.chance(0.08)) n.motif = o.motif.slice();
            }
            if (!isResponse || this.rng.chance(0.4)) {
              if (n.respCd <= 0 && n.respTimer <= 0 && this.rng.chance(n.ph.sociality * perceived * 0.6)) {
                n.respTimer = 0.25 + 0.6 / Math.max(0.25, n.ph.rhythmDiv);
                n.respCd = 2.5;
              }
            }
          }
          break;
        }
        case 'food':
          if (n.ph.diet < 0.6 && n.energy < n.ph.capacity * 0.8) { n.memX = o.x; n.memY = o.y; n.memW = 1.4 * perceived + 0.4; n.memT = 4; }
          break;
        case 'distress':
          if (n.ph.diet > 0.5 && !same) { n.memX = o.x; n.memY = o.y; n.memW = 1.2; n.memT = 3; }
          else { n.memX = o.x; n.memY = o.y; n.memW = -1.8 * perceived; n.memT = 3; }
          break;
        case 'territory':
          if (same) { n.memX = o.x; n.memY = o.y; n.memW = -0.6; n.memT = 2; }
          else if (n.ph.aggression < o.ph.aggression) { n.memX = o.x; n.memY = o.y; n.memW = -1.6 * perceived; n.memT = 3; }
          else { n.memX = o.x; n.memY = o.y; n.memW = 0.7; n.memT = 2; }
          break;
      }
    });
  }

  sample() {
    const species: Record<number, number> = {};
    let f = 0, s = 0, e = 0, nz = 0, hm = 0, gen = 0;
    for (const o of this.orgs) {
      species[o.speciesId] = (species[o.speciesId] || 0) + 1;
      f += Math.log2(o.ph.freq); s += o.genome[G.size]; e += o.energy / o.ph.capacity; nz += o.ph.noise; hm += o.ph.harmonicity;
      gen += o.generation;
    }
    const n = Math.max(1, this.orgs.length);
    let H = 0;
    for (const k in species) { const p = species[k] / n; H -= p * Math.log(p); }
    this.stats.push({
      t: this.time, pop: this.orgs.length, food: this.food.length, species, meanFreq: Math.pow(2, f / n), meanSize: s / n,
      meanEnergy: e / n, births: this.acc.births, deaths: this.acc.deaths, mutations: this.acc.mutations, calls: this.acc.calls,
      meanNoise: nz / n, meanHarm: hm / n, meanGen: gen / n, diversity: H, callMix: { ...this.acc.callMix },
    });
    this.acc.births = 0; this.acc.deaths = 0; this.acc.mutations = 0; this.acc.calls = 0;
    this.resetCallMix();
    if (this.stats.length > 1200) this.stats = this.stats.filter((_, i) => i % 2 === 0);
  }

  serialOrg(o: Organism): SerialOrg {
    return {
      id: o.id, genome: o.genome.slice(), speciesId: o.speciesId, parentId: o.parentId, parent2Id: o.parent2Id,
      generation: o.generation, x: o.x, y: o.y, vx: o.vx, vy: o.vy, angle: o.angle, energy: o.energy, age: o.age,
      phase: o.phase, motif: o.motif.slice(), muted: o.muted, children: o.children, born: o.born, mutations: o.mutations,
    };
  }

  keyframe() {
    this.keyframes.push({
      t: this.time, orgs: this.orgs.map((o) => this.serialOrg(o)), pop: this.orgs.length,
      species: new Set(this.orgs.map((o) => o.speciesId)).size,
    });
    if (this.keyframes.length > 160) this.keyframes = this.keyframes.filter((_, i) => i % 2 === 0 || i > 150);
  }

  hydrateOrg(s: SerialOrg): Organism {
    const ph = express(s.genome);
    return {
      ...s, genome: s.genome.slice(), motif: s.motif.slice(), ph, health: 1, alive: true, voiceEnv: 0, lastCallType: null, callCd: 0,
      respTimer: 0, respCd: 0, mateTarget: 0, mateWait: 0, memX: 0, memY: 0, memW: 0, memT: 0, bondId: 0, bondStr: 0,
      distressCd: 0, state: 'drift', trail: [], zone: this.zoneIndex(s.x), wanderA: s.angle, callsMade: 0,
    };
  }

  restoreKeyframe(kf: KeyFrame) {
    for (const o of this.orgs) {
      const sp = this.species.get(o.speciesId);
      if (sp) sp.count--;
    }
    this.orgs = kf.orgs.map((s) => this.hydrateOrg(s));
    for (const sp of this.species.values()) sp.count = 0;
    for (const o of this.orgs) {
      const sp = this.species.get(o.speciesId);
      if (sp) { sp.count++; if (sp.extinct !== null) sp.extinct = null; }
    }
    this.orgIndex = null;
    this.keyframes = this.keyframes.filter((k) => k.t <= kf.t);
    this.events.push({ t: this.time, kind: 'info', text: `Timeline rewound to population at t=${kf.t.toFixed(0)}s` });
  }

  serialize() {
    return {
      v: 1, seed: this.seed, time: this.time, nextId: this.nextId, nextSpecies: this.nextSpecies, rng: this.rng.s,
      zones: this.zones.map(cloneHabitat), orgs: this.orgs.map((o) => this.serialOrg(o)),
      food: this.food.map((f) => [Math.round(f.x), Math.round(f.y), +f.e.toFixed(1)]),
      species: [...this.species.values()], lineage: [...this.lineage.values()].slice(-3000),
      stats: this.stats.slice(-400), events: this.events.slice(-300), globals: { ...this.globals },
      totalMutations: this.totalMutations,
    };
  }

  static deserialize(d: ReturnType<World['serialize']>): World {
    const w = new World(d.seed, true);
    w.time = d.time; w.nextId = d.nextId; w.nextSpecies = d.nextSpecies; w.rng.s = d.rng;
    w.zones = d.zones.map(cloneHabitat);
    w.foodAcc = w.zones.map(() => 0);
    for (const sp of d.species) w.species.set(sp.id, { ...sp });
    for (const l of d.lineage) w.lineage.set(l.id, { ...l, children: [...l.children] });
    w.orgs = d.orgs.map((s) => w.hydrateOrg(s));
    for (const f of d.food) w.addFood(f[0], f[1], f[2]);
    w.stats = d.stats; w.events = d.events; w.globals = { ...w.globals, ...d.globals };
    w.totalMutations = d.totalMutations;
    return w;
  }

  ancestors(id: number, max = 12): LineageRec[] {
    const out: LineageRec[] = [];
    let rec = this.lineage.get(id);
    while (rec && out.length < max) {
      const p = this.lineage.get(rec.parentId);
      if (!p) break;
      out.push(p);
      rec = p;
    }
    return out;
  }

  descendants(id: number, max = 60): LineageRec[] {
    const out: LineageRec[] = [];
    const q = [id];
    while (q.length && out.length < max) {
      const r = this.lineage.get(q.shift()!);
      if (!r) continue;
      for (const c of r.children) {
        const cr = this.lineage.get(c);
        if (cr) { out.push(cr); q.push(c); }
      }
    }
    return out;
  }

  dominantMotif(speciesId: number): { motif: string; share: number } {
    const counts = new Map<string, number>();
    let n = 0;
    for (const o of this.orgs) if (o.speciesId === speciesId) { const k = o.motif.join(','); counts.set(k, (counts.get(k) || 0) + 1); n++; }
    let best = '', bc = 0;
    for (const [k, c] of counts) if (c > bc) { bc = c; best = k; }
    return { motif: best, share: n ? bc / n : 0 };
  }
}
