import { useEffect, useRef } from 'react';
import type { World, Species } from '../sim/world';
import { CALL_COLORS, CALL_TYPES } from '../sim/world';
import { GENES } from '../sim/genome';
import type { StatsResult } from '../sim/stats.worker';
import { Panel, LineChart, Stat, Bars, Btn } from './ui';
import { SectionTitle } from './Inspector';

interface Props {
  world: World;
  tick: number;
  stats: StatsResult | null;
  playback: number;
  setPlayback: (i: number) => void;
  onRestore: () => void;
  onSelectSpecies: (id: number) => void;
  onClose: () => void;
}

export function Observatory({ world, stats, playback, setPlayback, onRestore, onSelectSpecies, onClose }: Props) {
  const s = world.stats;
  const last = s[s.length - 1];
  const living = [...world.species.values()].filter((x) => x.count > 0).sort((a, b) => b.count - a.count);
  const extinct = [...world.species.values()].filter((x) => x.extinct !== null).length;
  const energies = new Array(16).fill(0);
  for (const o of world.orgs) energies[Math.min(15, Math.floor((o.energy / o.ph.capacity) * 16))]++;
  const callTotals: Record<string, number> = {};
  for (const t of CALL_TYPES) callTotals[t] = s.slice(-60).reduce((a, b) => a + (b.callMix?.[t] ?? 0), 0);
  const callSum = Math.max(1, Object.values(callTotals).reduce((a, b) => a + b, 0));
  const kf = world.keyframes;

  return (
    <Panel title="Evolutionary Observatory" onClose={onClose} className="w-[min(1100px,calc(100vw-40px))] max-h-[calc(100vh-140px)] overflow-y-auto sg-scroll">
      <div className="p-4 text-[11px]">
        <div className="grid grid-cols-5 md:grid-cols-10 gap-3">
          <Stat label="Population" value={world.orgs.length} />
          <Stat label="Living species" value={living.length} color="#a0ffc8" />
          <Stat label="Species ever" value={world.species.size} />
          <Stat label="Extinctions" value={extinct} color="#ff8f8f" />
          <Stat label="Mean gen" value={last ? last.meanGen.toFixed(1) : '–'} />
          <Stat label="Shannon H" value={last ? last.diversity.toFixed(2) : '–'} color="#7fd8ff" />
          <Stat label="Genetic var." value={stats ? stats.meanPairwise.toFixed(3) : '…'} color="#c78bff" />
          <Stat label="Sonic BDI" value={stats ? stats.sonicIndex.toFixed(2) : '…'} color="#ffe27a" />
          <Stat label="Mutations" value={world.totalMutations} />
          <Stat label="Sim time" value={`${Math.floor(world.time)}s`} />
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <SectionTitle>Population · nutrients</SectionTitle>
            <LineChart series={[{ data: s.map((x) => x.pop), color: '#7fd8ff', fill: true }, { data: s.map((x) => x.food / 3), color: '#a0ffc855' }]} />
          </div>
          <div>
            <SectionTitle>Species composition</SectionTitle>
            <SpeciesArea world={world} />
          </div>
          <div>
            <SectionTitle>Diversity (Shannon) · births / deaths</SectionTitle>
            <LineChart series={[{ data: s.map((x) => x.diversity), color: '#c78bff', fill: true }]} height={34} />
            <LineChart series={[{ data: s.map((x) => x.births), color: '#7fffd0' }, { data: s.map((x) => x.deaths), color: '#ff7a8a' }]} height={34} />
          </div>
          <div>
            <SectionTitle>Acoustic drift · mean fundamental (Hz)</SectionTitle>
            <LineChart series={[{ data: s.map((x) => x.meanFreq), color: '#ffe27a', fill: true }]} />
            <div className="text-[9px] text-cyan-100/40">now {last?.meanFreq.toFixed(0)} Hz</div>
          </div>
          <div>
            <SectionTitle>Timbre · noise (red) vs harmonicity (cyan)</SectionTitle>
            <LineChart series={[{ data: s.map((x) => x.meanNoise), color: '#ff6a5c' }, { data: s.map((x) => x.meanHarm), color: '#7fd8ff' }]} max={1} />
          </div>
          <div>
            <SectionTitle>Communication mix (last 60s)</SectionTitle>
            <div className="flex h-4 w-full overflow-hidden rounded">
              {CALL_TYPES.map((t) => (
                <div key={t} style={{ width: `${(callTotals[t] / callSum) * 100}%`, background: CALL_COLORS[t] }} title={`${t}: ${callTotals[t]}`} />
              ))}
            </div>
            <div className="mt-1 flex flex-wrap gap-2 text-[9px] uppercase">
              {CALL_TYPES.map((t) => <span key={t} style={{ color: CALL_COLORS[t] }}>{t} {Math.round((callTotals[t] / callSum) * 100)}%</span>)}
            </div>
            <SectionTitle>Calls / s</SectionTitle>
            <LineChart series={[{ data: s.map((x) => x.calls), color: '#a0ffc8', fill: true }]} height={30} />
          </div>
          <div>
            <SectionTitle>Energy distribution</SectionTitle>
            <Bars data={energies} color="#7fffd0" labels={['starving', 'replete']} />
          </div>
          <div>
            <SectionTitle>Spectral occupancy (worker)</SectionTitle>
            {stats ? <Bars data={stats.spectralHist} color="#ffe27a" labels={['38 Hz', '2.8 kHz']} /> : <div className="text-cyan-100/30">computing…</div>}
          </div>
          <div>
            <SectionTitle>Per-gene variation σ</SectionTitle>
            {stats ? (
              <div className="flex items-end gap-[1px] h-[50px]">
                {stats.geneStd.map((v, i) => (
                  <div key={i} title={`${GENES[i].label}: σ=${v.toFixed(3)}`} className="flex-1 bg-violet-300/70" style={{ height: `${Math.min(1, v / 0.35) * 100}%`, minHeight: 1 }} />
                ))}
              </div>
            ) : <div className="text-cyan-100/30">computing…</div>}
          </div>
        </div>

        <SectionTitle>Phylogeny — species lineage tree</SectionTitle>
        <Phylogeny world={world} onSelect={onSelectSpecies} />

        <SectionTitle>Evolutionary history</SectionTitle>
        <HistoryStrip world={world} />
        <div className="mt-2 max-h-28 overflow-y-auto sg-scroll space-y-0.5 font-mono text-[10px]">
          {world.events.slice(-40).reverse().map((e, i) => (
            <div key={i} className="flex gap-2">
              <span className="text-cyan-100/30 w-12 text-right">{e.t.toFixed(0)}s</span>
              <span style={{ color: e.hue !== undefined ? `hsl(${e.hue},80%,72%)` : e.kind === 'habitat' ? '#ffe27a' : '#9fc' }}>{e.text}</span>
            </div>
          ))}
        </div>

        <SectionTitle>Generational playback</SectionTitle>
        <div className="flex items-center gap-3">
          <input type="range" className="sg-range flex-1" min={-1} max={kf.length - 1} step={1} value={playback} onChange={(e) => setPlayback(parseInt(e.target.value))} />
          <span className="w-44 text-cyan-100/70">
            {playback < 0 ? 'LIVE' : `t=${kf[playback]?.t.toFixed(0)}s · ${kf[playback]?.pop} orgs · ${kf[playback]?.species} spp`}
          </span>
          <Btn onClick={() => setPlayback(-1)} active={playback < 0}>Live</Btn>
          <Btn tone="amber" disabled={playback < 0} onClick={onRestore}>Rewind world here</Btn>
        </div>
        <div className="text-[9px] text-cyan-100/35 mt-1">Keyframes captured every 12s of simulated time. Scrubbing freezes the view on a past population; rewinding resumes evolution from that moment.</div>

        <SectionTitle>Living species · emergent song conventions</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
          {living.slice(0, 24).map((sp) => {
            const dm = world.dominantMotif(sp.id);
            return (
              <button key={sp.id} onClick={() => onSelectSpecies(sp.id)} className="flex items-center gap-2 rounded px-2 py-1 text-left hover:bg-white/5">
                <span className="h-2 w-2 rounded-full" style={{ background: `hsl(${sp.hue},80%,60%)`, boxShadow: `0 0 6px hsl(${sp.hue},80%,60%)` }} />
                <span className="italic flex-1 truncate" style={{ color: `hsl(${sp.hue},70%,78%)` }}>{sp.name}</span>
                <span className="font-mono text-cyan-100/50">[{dm.motif}] {(dm.share * 100).toFixed(0)}%</span>
                <span className="w-8 text-right tabular-nums">{sp.count}</span>
              </button>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}

function SpeciesArea({ world }: { world: World }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const w = (c.width = c.clientWidth * 2), h = (c.height = 140);
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, w, h);
    const s = world.stats;
    if (s.length < 2) return;
    const totals = new Map<number, number>();
    for (const x of s) for (const k in x.species) totals.set(+k, (totals.get(+k) || 0) + x.species[k]);
    const top = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).map((e) => e[0]);
    const maxPop = Math.max(...s.map((x) => x.pop), 1);
    const base = new Array(s.length).fill(0);
    for (const id of top) {
      const sp = world.species.get(id);
      g.beginPath();
      const ys: number[] = [];
      s.forEach((x, i) => {
        const v = x.species[id] || 0;
        const y0 = base[i];
        ys.push(y0);
        base[i] += v;
        const px = (i / (s.length - 1)) * w;
        const py = h - (base[i] / maxPop) * h;
        if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
      });
      for (let i = s.length - 1; i >= 0; i--) g.lineTo((i / (s.length - 1)) * w, h - (ys[i] / maxPop) * h);
      g.closePath();
      g.fillStyle = `hsla(${sp?.hue ?? 0},75%,55%,0.55)`;
      g.fill();
    }
  });
  return <canvas ref={ref} className="w-full" style={{ height: 70 }} />;
}

function Phylogeny({ world, onSelect }: { world: World; onSelect: (id: number) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const rows = useRef<{ sp: Species; y: number }[]>([]);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const all = [...world.species.values()];
    // prune: keep living species, their ancestors, and recent extinct ones
    const keep = new Set<number>();
    for (const sp of all) if (sp.count > 0) { let cur: Species | undefined = sp; while (cur && !keep.has(cur.id)) { keep.add(cur.id); cur = world.species.get(cur.parent); } }
    for (const sp of all.slice(-30)) keep.add(sp.id);
    const list = all.filter((s) => keep.has(s.id));
    const kids = new Map<number, Species[]>();
    for (const s of list) { const p = keep.has(s.parent) ? s.parent : 0; if (!kids.has(p)) kids.set(p, []); kids.get(p)!.push(s); }
    const order: Species[] = [];
    const dfs = (p: number) => { for (const s of kids.get(p) || []) { order.push(s); dfs(s.id); } };
    dfs(0);
    const rowH = 9;
    const H = Math.max(60, order.length * rowH + 12);
    const W = (c.width = c.clientWidth * 2);
    c.height = H * 2;
    c.style.height = H + 'px';
    const g = c.getContext('2d')!;
    g.scale(2, 2);
    const w = W / 2;
    const T = Math.max(1, world.time);
    const xOf = (t: number) => 8 + (t / T) * (w - 120);
    const yMap = new Map<number, number>();
    order.forEach((s, i) => yMap.set(s.id, 8 + i * rowH));
    rows.current = order.map((s) => ({ sp: s, y: yMap.get(s.id)! }));
    for (const s of order) {
      const y = yMap.get(s.id)!;
      const x0 = xOf(s.born), x1 = xOf(s.extinct ?? world.time);
      const alive = s.count > 0;
      g.strokeStyle = `hsla(${s.hue},80%,62%,${alive ? 0.95 : 0.35})`;
      g.lineWidth = alive ? 2.2 : 1;
      g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke();
      const py = yMap.get(s.parent);
      if (py !== undefined) {
        g.strokeStyle = `hsla(${s.hue},60%,60%,0.3)`;
        g.lineWidth = 1;
        g.beginPath(); g.moveTo(x0, py); g.lineTo(x0, y); g.stroke();
      }
      if (!alive) { g.fillStyle = 'rgba(255,120,140,0.6)'; g.fillRect(x1 - 1, y - 2, 2, 4); }
      g.fillStyle = `hsla(${s.hue},70%,75%,${alive ? 0.9 : 0.35})`;
      g.font = '8px ui-monospace, Menlo, monospace';
      if (alive) g.fillText(`${s.name} (${s.count})`, x1 + 4, y + 3);
    }
  });
  return (
    <canvas
      ref={ref}
      className="w-full cursor-pointer rounded border border-cyan-300/10 bg-black/20"
      onClick={(e) => {
        const r = (e.target as HTMLCanvasElement).getBoundingClientRect();
        const y = e.clientY - r.top;
        const hit = rows.current.find((row) => Math.abs(row.y - y) < 5);
        if (hit && hit.sp.count > 0) onSelect(hit.sp.id);
      }}
    />
  );
}

function HistoryStrip({ world }: { world: World }) {
  const T = Math.max(1, world.time);
  return (
    <div className="relative h-6 rounded border border-cyan-300/10 bg-black/30">
      {world.events.map((e, i) => (
        <div
          key={i}
          title={`${e.t.toFixed(0)}s — ${e.text}`}
          className="absolute top-0 h-full w-[2px]"
          style={{
            left: `${(e.t / T) * 100}%`,
            background: e.kind === 'extinction' ? '#ff6a7a' : e.kind === 'speciation' ? `hsl(${e.hue},80%,65%)` : e.kind === 'habitat' ? '#ffe27a' : '#7fd8ff',
            opacity: 0.8,
          }}
        />
      ))}
      <div className="absolute right-1 top-1 text-[9px] text-cyan-100/40">■ speciation  ■ extinction  ■ habitat</div>
    </div>
  );
}
