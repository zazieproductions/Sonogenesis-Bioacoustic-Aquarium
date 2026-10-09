import { World, Organism, ZONE_W, WORLD_H, CALL_COLORS } from '../sim/world';
import { generateBody, drawBody, Body } from '../sim/morph';

export interface Camera { x: number; y: number; zoom: number }
export interface RenderOpts {
  overlays: boolean; trails: boolean; labels: boolean; selectedId: number; hoverId: number; time: number;
  orgsOverride?: Organism[] | null; soloIds: Set<number>; ghost?: { x: number; y: number } | null;
}

export const MINIMAP = { x: 16, w: 250, h: 0, bottom: 16 };

export function getBody(o: Organism): Body {
  if (!o.body) o.body = generateBody(o.genome, o.ph);
  return o.body as Body;
}

export function renderWorld(ctx: CanvasRenderingContext2D, w: World, cam: Camera, W: number, H: number, opt: RenderOpts) {
  const dpr = ctx.canvas.width / W;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const z = cam.zoom;
  ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (W / 2 - cam.x * z), dpr * (H / 2 - cam.y * z));
  const vx0 = cam.x - W / 2 / z, vx1 = cam.x + W / 2 / z, vy0 = cam.y - H / 2 / z, vy1 = cam.y + H / 2 / z;
  const t = opt.time;
  const orgs = opt.orgsOverride ?? w.orgs;

  // habitat boundaries & labels
  ctx.lineWidth = 1 / z;
  for (let i = 0; i < w.zones.length; i++) {
    const x = i * ZONE_W;
    const [r, g, b] = w.zones[i].color2;
    if (i > 0) {
      ctx.strokeStyle = `rgba(${r * 255},${g * 255},${b * 255},0.18)`;
      ctx.setLineDash([6 / z, 10 / z]);
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD_H); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = `rgba(${r * 255},${g * 255},${b * 255},0.42)`;
    ctx.font = `${Math.max(10, 12 / z)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.fillText(w.zones[i].name.toUpperCase(), x + 14 / z, 22 / z + Math.max(0, vy0));
    if (opt.overlays) {
      const h = w.zones[i];
      ctx.fillStyle = `rgba(${r * 255},${g * 255},${b * 255},0.3)`;
      ctx.font = `${Math.max(8, 10 / z)}px ui-monospace, Menlo, monospace`;
      ctx.fillText(`T ${h.temperature.toFixed(2)}  LUX ${h.light.toFixed(2)}  P ${h.pressure.toFixed(2)}  Σ ${h.resourceRate.toFixed(2)}  ≈ ${h.spectralCenter.toFixed(2)}`, x + 14 / z, 38 / z + Math.max(0, vy0));
    }
  }
  ctx.strokeStyle = 'rgba(140,200,255,0.12)';
  ctx.strokeRect(0, 0, w.width, WORLD_H);

  ctx.globalCompositeOperation = 'lighter';
  // food
  if (!opt.orgsOverride) {
    for (const f of w.food) {
      if (f.x < vx0 - 5 || f.x > vx1 + 5 || f.y < vy0 - 5 || f.y > vy1 + 5) continue;
      const tw = 0.6 + 0.4 * Math.sin(t * 2 + f.x * 0.1);
      ctx.fillStyle = `rgba(190,255,200,${0.35 * tw})`;
      const s = 1.2 + f.e * 0.12;
      ctx.fillRect(f.x - s, f.y - s, s * 2, s * 2);
    }
    // signals
    for (const s of w.signals) {
      if (s.x + s.maxR < vx0 || s.x - s.maxR > vx1 || s.y + s.maxR < vy0 || s.y - s.maxR > vy1) continue;
      const a = Math.max(0, 1 - s.age / 1.2);
      ctx.strokeStyle = CALL_COLORS[s.type];
      ctx.globalAlpha = a * (s.type === 'pulse' ? 0.18 : 0.38);
      ctx.lineWidth = (s.type === 'territory' ? 2.2 : 1.2) / z;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.stroke();
      if (s.type === 'social' || s.type === 'mating') {
        ctx.globalAlpha = a * 0.15;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 0.7, 0, Math.PI * 2); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }
  // trails
  if (opt.trails) {
    for (const o of orgs) {
      const tr = o.trail;
      if (tr.length < 4) continue;
      if (o.x < vx0 - 100 || o.x > vx1 + 100 || o.y < vy0 - 100 || o.y > vy1 + 100) continue;
      ctx.strokeStyle = `hsla(${o.ph.hue},90%,60%,0.13)`;
      ctx.lineWidth = Math.max(0.6, o.ph.radius * 0.25);
      ctx.beginPath();
      ctx.moveTo(tr[0], tr[1]);
      for (let i = 2; i < tr.length; i += 2) ctx.lineTo(tr[i], tr[i + 1]);
      ctx.lineTo(o.x, o.y);
      ctx.stroke();
    }
  }
  // bonds (symbiosis / social links)
  if (opt.overlays && !opt.orgsOverride) {
    ctx.lineWidth = 1 / z;
    for (const o of orgs) {
      if (!o.bondId || o.bondStr < 0.5) continue;
      const b = w.findOrg(o.bondId);
      if (!b) continue;
      const cross = b.speciesId !== o.speciesId;
      ctx.strokeStyle = cross ? 'rgba(255,220,120,0.35)' : 'rgba(160,255,200,0.18)';
      ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
  }
  // organisms
  const solo = opt.soloIds.size > 0;
  for (const o of orgs) {
    const R = o.ph.radius * 4;
    if (o.x + R < vx0 || o.x - R > vx1 || o.y + R < vy0 || o.y - R > vy1) continue;
    const body = getBody(o);
    const dim = (solo && !opt.soloIds.has(o.id)) || o.muted;
    if (dim) ctx.globalAlpha = 0.35;
    drawBody(ctx, body, { x: o.x, y: o.y, angle: o.angle, voiceEnv: o.voiceEnv, energyFrac: o.energy / o.ph.capacity, id: o.id, health: o.health }, t, z);
    ctx.globalAlpha = 1;
  }
  ctx.globalCompositeOperation = 'source-over';

  // scientific overlays
  if (opt.overlays) {
    ctx.font = `${10 / z}px ui-monospace, Menlo, monospace`;
    for (const o of orgs) {
      if (o.x < vx0 || o.x > vx1 || o.y < vy0 || o.y > vy1) continue;
      ctx.strokeStyle = 'rgba(120,200,255,0.07)';
      ctx.lineWidth = 1 / z;
      ctx.beginPath(); ctx.arc(o.x, o.y, o.ph.senseRange, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(o.x + o.vx * 0.5, o.y + o.vy * 0.5); ctx.stroke();
      if (opt.labels && z > 0.6) {
        ctx.fillStyle = `hsla(${o.ph.hue},80%,75%,0.6)`;
        ctx.fillText(`#${o.id} g${o.generation} ${o.state}`, o.x + o.ph.radius + 4, o.y - 4);
        // energy bar
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(o.x + o.ph.radius + 4, o.y, 30 / z, 2 / z);
        ctx.fillStyle = `hsla(${o.ph.hue},90%,65%,0.8)`;
        ctx.fillRect(o.x + o.ph.radius + 4, o.y, (30 / z) * Math.min(1, o.energy / o.ph.capacity), 2 / z);
      }
    }
  }
  // selection reticle
  const sel = orgs.find((o) => o.id === opt.selectedId);
  if (sel) drawReticle(ctx, sel, z, t, 'rgba(160,240,255,0.9)');
  const hov = opt.hoverId !== opt.selectedId ? orgs.find((o) => o.id === opt.hoverId) : null;
  if (hov) drawReticle(ctx, hov, z, t, 'rgba(255,255,255,0.35)');

  // minimap (screen space)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const mw = MINIMAP.w, mh = (mw * WORLD_H) / w.width;
  MINIMAP.h = mh;
  const mx = MINIMAP.x, my = H - mh - MINIMAP.bottom;
  ctx.fillStyle = 'rgba(4,8,14,0.7)';
  ctx.fillRect(mx, my, mw, mh);
  const sx = mw / w.width;
  for (let i = 0; i < w.zones.length; i++) {
    const [r, g, b] = w.zones[i].color2;
    ctx.fillStyle = `rgba(${r * 255},${g * 255},${b * 255},0.08)`;
    ctx.fillRect(mx + i * ZONE_W * sx, my, ZONE_W * sx, mh);
  }
  for (const o of orgs) {
    ctx.fillStyle = `hsla(${o.ph.hue},90%,65%,0.9)`;
    ctx.fillRect(mx + o.x * sx - 1, my + o.y * sx - 1, 2, 2);
  }
  ctx.strokeStyle = 'rgba(160,230,255,0.7)';
  ctx.lineWidth = 1;
  ctx.strokeRect(mx + vx0 * sx, my + vy0 * sx, (vx1 - vx0) * sx, (vy1 - vy0) * sx);
  ctx.strokeStyle = 'rgba(160,230,255,0.2)';
  ctx.strokeRect(mx, my, mw, mh);
}

function drawReticle(ctx: CanvasRenderingContext2D, o: Organism, z: number, t: number, col: string) {
  const r = o.ph.radius * 1.8 + 8 / z;
  ctx.strokeStyle = col;
  ctx.lineWidth = 1.2 / z;
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.rotate(t * 0.5);
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 2);
    ctx.beginPath();
    ctx.arc(0, 0, r, -0.35, 0.35);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(r + 3 / z, 0); ctx.lineTo(r + 9 / z, 0);
    ctx.stroke();
  }
  ctx.restore();
}

export function screenToWorld(cam: Camera, W: number, H: number, sx: number, sy: number) {
  return { x: cam.x + (sx - W / 2) / cam.zoom, y: cam.y + (sy - H / 2) / cam.zoom };
}

export function pickOrganism(orgs: Organism[], x: number, y: number, zoom: number): Organism | null {
  let best: Organism | null = null;
  let bd = 1e9;
  for (const o of orgs) {
    const d = Math.hypot(o.x - x, o.y - y);
    const lim = o.ph.radius * 1.4 + 8 / zoom;
    if (d < lim && d < bd) { bd = d; best = o; }
  }
  return best;
}
