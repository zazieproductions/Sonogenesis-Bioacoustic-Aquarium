import { RNG, hashGenome } from './rng';
import { G, express, Phenotype } from './genome';

interface Branch { a: number; len: number; kids: Branch[] }

export interface Body {
  R: number;
  n: number;
  lobe: number;
  spike: number;
  crystal: number;
  bell: number;
  pts: number;
  tentacles: { a: number; len: number; segs: number; phase: number; w: number }[];
  branches: Branch[];
  cells: { x: number; y: number; r: number; ph: number }[];
  spores: { a: number; d: number; s: number; sp: number }[];
  hue: number; hue2: number; sat: number; alpha: number; lumin: number;
  breath: number;
  starPts: number;
}

export function generateBody(genome: number[], ph?: Phenotype): Body {
  const p = ph ?? express(genome);
  const r = new RNG(hashGenome(genome) ^ 0x9e3779b9);
  const R = p.radius;
  const n = 1 + Math.floor(genome[G.symmetry] * 8);
  const bell = genome[G.bell];
  const crystal = genome[G.crystal];
  const spike = genome[G.spikes];
  const segs = 3 + Math.floor(genome[G.segments] * 9);
  const tentN = Math.round(Math.pow(genome[G.tentacles], 1.3) * 12);
  const arc = bell > 0.5 ? Math.PI * 0.55 : Math.PI * 2;
  const tentacles = [] as Body['tentacles'];
  for (let i = 0; i < tentN; i++) {
    const a = bell > 0.5 ? Math.PI + (tentN === 1 ? 0 : (i / (tentN - 1) - 0.5) * arc) : (i / tentN) * Math.PI * 2;
    tentacles.push({ a, len: R * (0.8 + genome[G.segments] * 3.2) * r.range(0.7, 1.15), segs, phase: r.range(0, 6.28), w: r.range(0.6, 1.4) });
  }
  const branches: Branch[] = [];
  const bDepth = genome[G.branching] > 0.3 ? 1 + Math.floor((genome[G.branching] - 0.3) * 4.2) : 0;
  const make = (len: number, d: number): Branch[] => {
    if (d <= 0) return [];
    const k = 2;
    const out: Branch[] = [];
    for (let i = 0; i < k; i++) out.push({ a: (i - 0.5) * r.range(0.5, 1.1), len, kids: make(len * r.range(0.55, 0.75), d - 1) });
    return out;
  };
  if (bDepth > 0) {
    const roots = Math.min(n, 6);
    for (let i = 0; i < roots; i++) branches.push({ a: (i / roots) * Math.PI * 2 + 0.3, len: R * 0.9, kids: make(R * 0.6, bDepth - 1) });
  }
  const cells = [] as Body['cells'];
  const cn = Math.floor(Math.pow(genome[G.cells], 1.2) * 16);
  for (let i = 0; i < cn; i++) {
    const ang = i * 2.39996;
    const d = Math.sqrt((i + 0.5) / Math.max(1, cn)) * R * 0.95;
    cells.push({ x: Math.cos(ang) * d, y: Math.sin(ang) * d, r: R * r.range(0.13, 0.26), ph: r.range(0, 6.28) });
  }
  const spores = [] as Body['spores'];
  const sn = Math.floor(Math.pow(genome[G.spores], 1.5) * 18);
  for (let i = 0; i < sn; i++) spores.push({ a: r.range(0, 6.28), d: R * r.range(1.3, 2.3), s: r.range(0.8, 2.2), sp: r.range(-1, 1) });
  return {
    R, n, lobe: (genome[G.symmetry] > 0.12 ? 0.08 + genome[G.segments] * 0.25 : 0.04), spike, crystal, bell,
    pts: crystal > 0.55 ? Math.max(3, n) * 2 : Math.max(18, n * 6), tentacles, branches, cells, spores,
    hue: p.hue, hue2: p.hue2, sat: 60 + genome[G.lumin] * 40, alpha: p.opacity, lumin: p.lumin,
    breath: 0.6 + (1 - genome[G.size]) * 2.5, starPts: Math.max(3, n),
  };
}

// glow sprite cache
const glowCache = new Map<number, HTMLCanvasElement>();
export function glowSprite(hue: number): HTMLCanvasElement {
  const key = Math.round(hue / 10) % 36;
  let c = glowCache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, `hsla(${key * 10},100%,75%,0.9)`);
  grd.addColorStop(0.25, `hsla(${key * 10},100%,60%,0.35)`);
  grd.addColorStop(0.6, `hsla(${key * 10},100%,50%,0.08)`);
  grd.addColorStop(1, `hsla(${key * 10},100%,50%,0)`);
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  glowCache.set(key, c);
  return c;
}

function drawBranch(ctx: CanvasRenderingContext2D, b: Branch, t: number, depth: number, sway: number) {
  ctx.save();
  ctx.rotate(b.a + Math.sin(t * 1.3 + depth * 1.7) * 0.08 * depth * sway);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(b.len, 0);
  ctx.stroke();
  ctx.translate(b.len, 0);
  if (b.kids.length === 0) {
    ctx.beginPath();
    ctx.arc(0, 0, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const k of b.kids) drawBranch(ctx, k, t, depth + 1, sway);
  ctx.restore();
}

export interface DrawState { x: number; y: number; angle: number; voiceEnv: number; energyFrac: number; id: number; health: number }

/** Draw an organism body in world-space. `scale` is screen pixels per world unit (for LOD). */
export function drawBody(ctx: CanvasRenderingContext2D, b: Body, s: DrawState, t: number, scale: number) {
  const R = b.R;
  const pulse = s.voiceEnv;
  const screenR = R * scale;
  const tt = t + s.id * 0.37;
  const vitality = 0.35 + 0.65 * s.health;
  // glow
  const baseA = ctx.globalAlpha;
  const glowA = (0.18 + b.lumin * 0.55 + pulse * 0.5) * vitality;
  const gs = R * (2.6 + b.lumin * 2 + pulse * 2.2);
  ctx.globalAlpha = Math.min(1, glowA) * baseA;
  ctx.drawImage(glowSprite(b.hue), s.x - gs, s.y - gs, gs * 2, gs * 2);
  ctx.globalAlpha = baseA;
  if (screenR < 2.2) return;

  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(s.angle);
  const contract = 1 - pulse * 0.18 * (0.4 + b.bell);
  const breathe = 1 + Math.sin(tt * b.breath) * 0.05;
  const L = 55 + pulse * 25;
  const strokeCol = `hsla(${b.hue},${b.sat}%,${L}%,${0.55 + pulse * 0.45})`;
  const strokeCol2 = `hsla(${b.hue2},${b.sat}%,${L + 5}%,${(0.35 + pulse * 0.4) * vitality})`;

  // spores
  if (b.spores.length && screenR > 3) {
    ctx.fillStyle = strokeCol2;
    for (const sp of b.spores) {
      const a = sp.a + tt * sp.sp * 0.6;
      const d = sp.d * (1 + pulse * 0.4);
      ctx.beginPath();
      ctx.arc(Math.cos(a) * d, Math.sin(a) * d, sp.s, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // tentacles
  if (b.tentacles.length && screenR > 3) {
    ctx.strokeStyle = strokeCol2;
    ctx.lineCap = 'round';
    for (const tn of b.tentacles) {
      ctx.lineWidth = Math.max(0.6, R * 0.05 * tn.w);
      ctx.beginPath();
      const ca = Math.cos(tn.a), sa = Math.sin(tn.a);
      const sx = ca * R * 0.7, sy = sa * R * 0.7 * (b.bell > 0.5 ? 0.9 : 1);
      ctx.moveTo(sx, sy);
      const segL = tn.len / tn.segs;
      for (let k = 1; k <= tn.segs; k++) {
        const along = k * segL * (1 + pulse * 0.15);
        const wob = Math.sin(tt * 2.6 - k * 0.7 + tn.phase) * k * segL * 0.18;
        ctx.lineTo(sx + ca * along - sa * wob, sy + sa * along + ca * wob);
      }
      ctx.stroke();
    }
  }
  // dendritic branches
  if (b.branches.length && screenR > 4) {
    ctx.strokeStyle = strokeCol2;
    ctx.fillStyle = strokeCol;
    ctx.lineWidth = Math.max(0.6, R * 0.04);
    for (const br of b.branches) drawBranch(ctx, br, tt, 1, 1 + pulse * 3);
  }
  // core membrane
  ctx.beginPath();
  const pts = b.pts;
  for (let i = 0; i <= pts; i++) {
    const th = (i / pts) * Math.PI * 2;
    let rr = R * (1 + b.lobe * Math.cos(b.n * th + tt * 0.8) * (1 + pulse * 0.6));
    if (b.crystal > 0.55) rr *= i % 2 === 0 ? 1 : 0.55 + (1 - b.spike) * 0.35;
    else if (b.spike > 0.6) rr *= 1 + (b.spike - 0.6) * 1.5 * Math.max(0, Math.cos(b.starPts * th));
    if (b.bell > 0.5) {
      // medusoid dome: flatten trailing side
      const c = Math.cos(th);
      rr *= c < 0 ? 0.55 + 0.45 * (1 + c) : 1;
    }
    const px = Math.cos(th) * rr * contract * breathe;
    const py = Math.sin(th) * rr * breathe * (b.bell > 0.5 ? 1 / contract : 1);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = `hsla(${b.hue},${b.sat}%,${30 + pulse * 25}%,${b.alpha * 0.5 * vitality})`;
  ctx.fill();
  ctx.lineWidth = Math.max(0.7, R * 0.06);
  ctx.strokeStyle = strokeCol;
  ctx.stroke();
  // crystal facets
  if (b.crystal > 0.4 && screenR > 4) {
    ctx.beginPath();
    for (let i = 0; i < b.pts; i += 2) {
      const th = (i / b.pts) * Math.PI * 2;
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(th) * R * contract, Math.sin(th) * R);
    }
    ctx.lineWidth = Math.max(0.4, R * 0.025);
    ctx.strokeStyle = strokeCol2;
    ctx.stroke();
  }
  // colony cells
  if (b.cells.length && screenR > 4) {
    ctx.lineWidth = Math.max(0.4, R * 0.03);
    ctx.strokeStyle = strokeCol2;
    ctx.fillStyle = `hsla(${b.hue2},${b.sat}%,50%,${0.12 + pulse * 0.2})`;
    for (const c of b.cells) {
      const cr = c.r * (1 + Math.sin(tt * 2 + c.ph) * 0.12 + pulse * 0.3);
      ctx.beginPath();
      ctx.arc(c.x * contract, c.y, cr, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  // nucleus
  ctx.fillStyle = `hsla(${b.hue},100%,${75 + pulse * 20}%,${0.6 + pulse * 0.4})`;
  ctx.beginPath();
  ctx.arc(R * 0.12, 0, Math.max(1, R * (0.12 + pulse * 0.08) * (0.5 + s.energyFrac * 0.5)), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Render a genome into a standalone canvas (thumbnails, lab previews). */
export function renderThumb(canvas: HTMLCanvasElement, genome: number[], t = 0, pulse = 0) {
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const body = generateBody(genome);
  const extent = Math.max(body.R * 2.2, ...body.tentacles.map((x) => x.len + body.R), ...body.spores.map((s) => s.d + 3), body.R * 1.5);
  const sc = (Math.min(w, h) * 0.46) / extent;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.translate(w / 2, h / 2);
  ctx.scale(sc, sc);
  drawBody(ctx, body, { x: 0, y: 0, angle: -Math.PI / 2, voiceEnv: pulse, energyFrac: 0.8, id: 1, health: 1 }, t, sc * 2);
  ctx.restore();
}
