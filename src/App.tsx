import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { World, ZONE_W, WORLD_H, Organism, CALL_COLORS, CALL_TYPES, CallType } from './sim/world';
import { hashString, RNG } from './sim/rng';
import { express, randomGenome, GENE_COUNT } from './sim/genome';
import { AudioEngine, DroneTarget } from './audio/engine';
import { Background } from './render/Background';
import { renderWorld, screenToWorld, pickOrganism, Camera, MINIMAP } from './render/renderer';
import { defaultLanes, applyLanes, Lane } from './conductor';
import { dbAll, dbDel, dbPut, Specimen, SnapshotRec } from './db';
import type { StatsResult, StatsRequest } from './sim/stats.worker';
import StatsWorker from './sim/stats.worker?worker&inline';
import { Inspector } from './components/Inspector';
import { ControlDeck } from './components/ControlDeck';
import { Observatory } from './components/Observatory';
import { Lab, LabSlot } from './components/Lab';
import { Library } from './components/Library';
import { Conductor } from './components/Conductor';
import { Btn } from './components/ui';

const SIM_DT = 1 / 30;
const SPEEDS = [0.5, 1, 2, 4, 8, 16];
type Tool = 'select' | 'spawn' | 'feed' | 'cull';

function seedFrom(text: string) {
  const t = text.trim();
  return /^\d+$/.test(t) ? parseInt(t, 10) >>> 0 : hashString(t || 'sonogenesis');
}

export default function App() {
  const bgRef = useRef<HTMLCanvasElement>(null);
  const fgRef = useRef<HTMLCanvasElement>(null);
  const specRef = useRef<HTMLCanvasElement>(null);
  const [seedText, setSeedText] = useState('2401');
  const worldRef = useRef<World>(new World(seedFrom('2401')));
  const audioRef = useRef<AudioEngine>(new AudioEngine());
  const camRef = useRef<Camera>({ x: ZONE_W * 2.5, y: WORLD_H / 2, zoom: 0.9 });
  const [tick, setTick] = useState(0);
  const [entered, setEntered] = useState(false);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [muted, setMuted] = useState(false);
  const [selectedId, setSelectedId] = useState(0);
  const [tracking, setTracking] = useState(false);
  const [tool, setTool] = useState<Tool>('select');
  const [overlays, setOverlays] = useState(false);
  const [trails, setTrails] = useState(true);
  const [labels, setLabels] = useState(true);
  const [panels, setPanels] = useState({ deck: true, obs: false, lab: false, lib: false, cond: false });
  const [zoneSel, setZoneSel] = useState(2);
  const [recording, setRecording] = useState(false);
  const [stats, setStats] = useState<StatsResult | null>(null);
  const [playback, setPlayback] = useState(-1);
  const [specimens, setSpecimens] = useState<Specimen[]>([]);
  const [snapshots, setSnapshots] = useState<SnapshotRec[]>([]);
  const [labInit, setLabInit] = useState<LabSlot | null>(null);
  const [labKey, setLabKey] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [condPlaying, setCondPlaying] = useState(false);
  const [condLen, setCondLen] = useState(180);
  const [condLoop, setCondLoop] = useState(true);
  const lanesRef = useRef<Lane[]>(defaultLanes());

  const st = useRef({ paused, speed, tool, selectedId, tracking, overlays, trails, labels, playback, condPlaying, condLen, condLoop, condPos: 0, hoverId: 0 });
  st.current = { ...st.current, paused, speed, tool, selectedId, tracking, overlays, trails, labels, playback, condPlaying, condLen, condLoop };

  const flash = useCallback((m: string) => {
    setToast(m);
    window.clearTimeout((flash as unknown as { t?: number }).t);
    (flash as unknown as { t?: number }).t = window.setTimeout(() => setToast(null), 2600);
  }, []);

  const refreshArchive = useCallback(async () => {
    try {
      setSpecimens(await dbAll<Specimen>('specimens'));
      setSnapshots(await dbAll<SnapshotRec>('snapshots'));
    } catch { /* IndexedDB unavailable */ }
  }, []);
  useEffect(() => { refreshArchive(); }, [refreshArchive]);

  const playbackOrgs = useMemo(() => {
    if (playback < 0) return null;
    const kf = worldRef.current.keyframes[playback];
    return kf ? kf.orgs.map((s) => worldRef.current.hydrateOrg(s)) : null;
  }, [playback]);
  const playbackRef = useRef<Organism[] | null>(null);
  playbackRef.current = playbackOrgs;

  // ---------- main loop
  useEffect(() => {
    const bg = new Background(bgRef.current!);
    const fg = fgRef.current!;
    const ctx = fg.getContext('2d')!;
    let W = 0, H = 0;
    const resize = () => {
      W = window.innerWidth; H = window.innerHeight;
      const dpr = Math.min(2, window.devicePixelRatio);
      fg.width = W * dpr; fg.height = H * dpr;
      fg.style.width = W + 'px'; fg.style.height = H + 'px';
      bg.resize(W, H);
    };
    resize();
    camRef.current.zoom = Math.min(1.1, (H / WORLD_H) * 0.95);
    window.addEventListener('resize', resize);
    let last = performance.now();
    let acc = 0, droneT = 0, uiT = 0, statT = 0;
    let raf = 0;
    const worker: Worker = new StatsWorker();
    worker.onmessage = (e: MessageEvent<StatsResult>) => setStats(e.data);
    const spec = new Uint8Array(512);

    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const s = st.current;
      const w = worldRef.current;
      const audio = audioRef.current;
      const cam = camRef.current;
      if (!s.paused && s.playback < 0) {
        acc += dt * s.speed;
        let n = 0;
        while (acc >= SIM_DT && n < 40) { w.step(SIM_DT); acc -= SIM_DT; n++; }
        if (n >= 40) acc = 0;
      }
      // conductor automation
      if (s.condPlaying) {
        s.condPos += dt;
        if (s.condPos > s.condLen) {
          if (s.condLoop) s.condPos = 0;
          else { s.condPos = s.condLen; setCondPlaying(false); }
        }
        applyLanes(lanesRef.current, s.condPos / s.condLen, w, audio);
      }
      // camera tracking
      if (s.tracking && s.selectedId) {
        const o = w.findOrg(s.selectedId);
        if (o) { cam.x += (o.x - cam.x) * Math.min(1, dt * 3); cam.y += (o.y - cam.y) * Math.min(1, dt * 3); }
      }
      const halfW = W / 2 / cam.zoom, halfH = H / 2 / cam.zoom;
      const acam = { x: cam.x, y: cam.y, halfW, halfH, zoom: cam.zoom };
      // audio events -> synthesis
      const evs = w.audioEvents;
      w.audioEvents = [];
      if (audio.started && s.playback < 0) {
        const density = s.speed > 1 ? 1 / Math.sqrt(s.speed) : 1;
        for (const ev of evs) audio.trigger(ev, acam, density);
      }
      droneT += dt;
      if (droneT > 0.15 && audio.started) {
        droneT = 0;
        const cands: { o: Organism; g: number }[] = [];
        for (const o of w.orgs) {
          if (!o.ph.drone || o.muted) continue;
          if (audio.soloIds.size && !audio.soloIds.has(o.id)) continue;
          const nx = (o.x - cam.x) / halfW, ny = (o.y - cam.y) / halfH;
          const norm = Math.sqrt(nx * nx + ny * ny);
          if (norm > 1.6) continue;
          let kin = 0;
          w.near(o.x, o.y, 120, (n) => { if (n.speciesId === o.speciesId) kin++; });
          const g = (1 / (1 + norm * norm * 2)) * o.ph.loudness * Math.min(1, o.energy / (o.ph.capacity * 0.5)) * (1 + Math.min(6, kin) * 0.18);
          cands.push({ o, g });
        }
        cands.sort((a, b) => b.g - a.g);
        const targets: DroneTarget[] = cands.slice(0, 5).map(({ o, g }) => ({
          id: o.id, freq: audio.noteFreq(o.ph, 0) / (o.ph.radius > 24 ? 2 : 1), wave: o.ph.wave, cutoff: o.ph.cutoff,
          pan: Math.max(-1, Math.min(1, (o.x - cam.x) / halfW)) * 0.8, gain: g, detune: o.genome[33] * 12,
        }));
        audio.updateDrones(s.paused ? [] : targets);
        for (const { o, g } of cands.slice(0, 5)) o.voiceEnv = Math.max(o.voiceEnv, 0.15 + g * 0.3 * (0.5 + 0.5 * Math.sin(now / 400 + o.id)));
      }
      // render
      const level = audio.level();
      bg.render(now / 1000, cam.x, cam.y, cam.zoom, w.zones, ZONE_W, WORLD_H, level);
      renderWorld(ctx, w, cam, W, H, {
        overlays: s.overlays, trails: s.trails, labels: s.labels, selectedId: s.selectedId, hoverId: s.hoverId,
        time: now / 1000, orgsOverride: playbackRef.current, soloIds: audio.soloIds,
      });
      // spectrum
      const sc = specRef.current;
      if (sc && audio.started) {
        audio.spectrum(spec);
        const g2 = sc.getContext('2d')!;
        g2.clearRect(0, 0, sc.width, sc.height);
        const bars = 48;
        for (let i = 0; i < bars; i++) {
          const idx = Math.floor(Math.pow(i / bars, 2) * 300) + 1;
          const v = spec[idx] / 255;
          g2.fillStyle = `hsla(${180 + i * 3},90%,65%,${0.3 + v * 0.7})`;
          g2.fillRect(i * (sc.width / bars), sc.height * (1 - v), sc.width / bars - 1, sc.height * v);
        }
      }
      uiT += dt;
      if (uiT > 0.25) { uiT = 0; setTick((t) => t + 1); }
      statT += dt;
      if (statT > 3 && w.orgs.length > 1) {
        statT = 0;
        const req: StatsRequest = {
          genomes: w.orgs.map((o) => o.genome), geneCount: GENE_COUNT,
          voice: w.orgs.map((o) => [o.ph.spectral, o.ph.noise, o.ph.harmonicity, o.ph.rhythmDiv]),
        };
        worker.postMessage(req);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); bg.dispose(); worker.terminate(); };
  }, []);

  // ---------- audio
  const ensureAudio = useCallback(async () => {
    const a = audioRef.current;
    await a.start();
    a.setTempo(worldRef.current.globals.tempo);
  }, []);

  const enter = async () => {
    await ensureAudio();
    setEntered(true);
    flash('Biosphere audio online — zoom in to listen closely');
  };

  const toggleMute = async () => {
    const a = audioRef.current;
    if (!a.started) { await ensureAudio(); a.setMuted(false); setMuted(false); return; }
    a.setMuted(!a.muted);
    setMuted(a.muted);
  };

  const toggleRecord = async () => {
    const a = audioRef.current;
    if (!a.started) await ensureAudio();
    if (!a.recording) { a.startRecording(); setRecording(true); flash('Recording master output…'); return; }
    const blob = a.stopRecording();
    setRecording(false);
    if (blob) {
      const url = URL.createObjectURL(blob);
      const el = document.createElement('a');
      el.href = url;
      el.download = `sonogenesis-${worldRef.current.seed}-t${Math.floor(worldRef.current.time)}.wav`;
      el.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      flash(`WAV exported (${(blob.size / 1024 / 1024).toFixed(1)} MB)`);
    }
  };

  // ---------- world ops
  const newWorld = (text: string) => {
    const seed = seedFrom(text);
    worldRef.current = new World(seed);
    setSelectedId(0); setPlayback(-1); setTracking(false);
    audioRef.current.soloIds.clear();
    camRef.current.x = ZONE_W * 2.5; camRef.current.y = WORLD_H / 2;
    flash(`World generated from seed ${seed}`);
  };

  const focusZone = (z: number) => {
    camRef.current.x = z * ZONE_W + ZONE_W / 2;
    camRef.current.y = WORLD_H / 2;
    setTracking(false);
  };

  const introduce = (x: number, y: number, genome?: number[], motif?: number[], count = 6) => {
    const w = worldRef.current;
    const r = new RNG((Date.now() ^ (x * 1000 + y)) >>> 0);
    const g = genome ?? randomGenome(r, { tempPref: w.tempAt(x) });
    const f = w.spawn(x, y, g.slice(), { newSpecies: true, motif: motif?.slice(), energyFrac: 0.8 });
    for (let i = 1; i < count; i++) {
      w.spawn(x + r.range(-60, 60), y + r.range(-60, 60), g.slice(), { speciesId: f.speciesId, motif: motif?.slice() ?? f.motif.slice(), energyFrac: 0.8 });
    }
    return f;
  };

  const selected = selectedId ? worldRef.current.findOrg(selectedId) : undefined;
  useEffect(() => {
    if (selectedId && !selected && playback < 0) {
      const rec = worldRef.current.lineage.get(selectedId);
      flash(`Specimen #${selectedId} has died${rec?.cause ? ` (${rec.cause})` : ''}`);
      setSelectedId(0);
      setTracking(false);
    }
  }, [tick, selectedId, selected, playback, flash]);

  const saveSpecimen = async (o: Organism, withLineage: boolean) => {
    const w = worldRef.current;
    const sp = w.species.get(o.speciesId);
    const spec: Specimen = {
      id: `s${Date.now()}`, name: `${sp?.name.split(' ')[0] ?? 'Specimen'} #${o.id}`, genome: o.genome.slice(), motif: o.motif.slice(),
      speciesName: sp?.name ?? '', generation: o.generation, saved: Date.now(),
      lineage: withLineage ? w.ancestors(o.id, 24).map((a) => ({ id: a.id, gen: a.gen, genome: a.genome, speciesId: a.speciesId })) : undefined,
    };
    await dbPut('specimens', spec);
    refreshArchive();
    flash(withLineage ? `Lineage of ${spec.name} archived (${spec.lineage?.length} ancestors)` : `${spec.name} saved to library`);
  };

  const saveSnapshot = async (name: string) => {
    const w = worldRef.current;
    const rec: SnapshotRec = {
      id: `w${Date.now()}`, name, saved: Date.now(), pop: w.orgs.length, species: new Set(w.orgs.map((o) => o.speciesId)).size,
      time: w.time, seed: w.seed,
      data: { world: w.serialize(), lanes: lanesRef.current.map((l) => ({ key: l.key, enabled: l.enabled, points: l.points })), cam: { ...camRef.current } },
    };
    await dbPut('snapshots', rec);
    refreshArchive();
    flash(`Ecosystem snapshot "${name}" stored`);
  };

  const loadSnapshot = (rec: SnapshotRec) => {
    try {
      const d = rec.data as { world: ReturnType<World['serialize']>; lanes?: { key: string; enabled: boolean; points: { t: number; v: number }[] }[]; cam?: Camera };
      worldRef.current = World.deserialize(d.world);
      if (d.lanes) for (const l of d.lanes) { const ln = lanesRef.current.find((x) => x.key === l.key); if (ln) { ln.enabled = l.enabled; ln.points = l.points; } }
      if (d.cam) Object.assign(camRef.current, d.cam);
      setSeedText(String(rec.seed));
      setSelectedId(0); setPlayback(-1);
      flash(`Loaded "${rec.name}"`);
    } catch (e) {
      flash('Snapshot could not be loaded');
      console.error(e);
    }
  };

  const importFile = async (file: File) => {
    try {
      const obj = JSON.parse(await file.text());
      if (obj.data && obj.seed !== undefined) { await dbPut('snapshots', { ...obj, id: `w${Date.now()}` }); flash('Snapshot imported'); }
      else if (obj.genome) { await dbPut('specimens', { ...obj, id: `s${Date.now()}` }); flash('Specimen imported'); }
      refreshArchive();
    } catch { flash('Import failed'); }
  };

  // ---------- pointer interaction
  const ptr = useRef<{ mode: 'none' | 'pan' | 'drag' | 'mini' | 'feed'; sx: number; sy: number; cx: number; cy: number; id: number; zone: number; moved: boolean }>({ mode: 'none', sx: 0, sy: 0, cx: 0, cy: 0, id: 0, zone: 0, moved: false });

  const inMinimap = (sx: number, sy: number) => {
    const w = worldRef.current;
    const mh = (MINIMAP.w * WORLD_H) / w.width;
    const my = window.innerHeight - mh - MINIMAP.bottom;
    if (sx >= MINIMAP.x && sx <= MINIMAP.x + MINIMAP.w && sy >= my && sy <= my + mh) {
      return { x: ((sx - MINIMAP.x) / MINIMAP.w) * w.width, y: ((sy - my) / mh) * WORLD_H };
    }
    return null;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const cam = camRef.current;
    const w = worldRef.current;
    const sx = e.clientX, sy = e.clientY;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const mm = inMinimap(sx, sy);
    if (mm) { cam.x = mm.x; cam.y = mm.y; setTracking(false); ptr.current = { ...ptr.current, mode: 'mini' }; return; }
    const wp = screenToWorld(cam, window.innerWidth, window.innerHeight, sx, sy);
    const orgs = playbackRef.current ?? w.orgs;
    const hit = pickOrganism(orgs, wp.x, wp.y, cam.zoom);
    const base = { sx, sy, cx: cam.x, cy: cam.y, id: 0, zone: 0, moved: false };
    if (tool === 'select' || e.button === 1 || playbackRef.current) {
      if (hit) {
        setSelectedId(hit.id);
        ptr.current = { ...base, mode: playbackRef.current ? 'none' : 'drag', id: hit.id, zone: w.zoneIndex(hit.x) };
      } else ptr.current = { ...base, mode: 'pan' };
    } else if (tool === 'spawn') {
      const f = introduce(wp.x, wp.y);
      setSelectedId(f.id);
      flash(`Introduced ${w.species.get(f.speciesId)?.name}`);
    } else if (tool === 'feed') {
      for (let i = 0; i < 14; i++) w.addFood(wp.x + (Math.random() - 0.5) * 80, wp.y + (Math.random() - 0.5) * 80, 10);
      ptr.current = { ...base, mode: 'feed' };
    } else if (tool === 'cull') {
      if (hit) { w.kill(hit, 'removed'); flash(`Culled #${hit.id}`); }
      else ptr.current = { ...base, mode: 'pan' };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const cam = camRef.current;
    const w = worldRef.current;
    const p = ptr.current;
    const wp = screenToWorld(cam, window.innerWidth, window.innerHeight, e.clientX, e.clientY);
    if (p.mode === 'pan') {
      cam.x = p.cx - (e.clientX - p.sx) / cam.zoom;
      cam.y = p.cy - (e.clientY - p.sy) / cam.zoom;
      if (Math.abs(e.clientX - p.sx) + Math.abs(e.clientY - p.sy) > 3) { p.moved = true; setTracking(false); }
    } else if (p.mode === 'drag') {
      const o = w.findOrg(p.id);
      if (o) { o.x = Math.max(5, Math.min(w.width - 5, wp.x)); o.y = Math.max(5, Math.min(WORLD_H - 5, wp.y)); o.vx = 0; o.vy = 0; o.trail = []; p.moved = true; }
    } else if (p.mode === 'mini') {
      const mm = inMinimap(e.clientX, e.clientY);
      if (mm) { cam.x = mm.x; cam.y = mm.y; }
    } else if (p.mode === 'feed') {
      if (Math.random() < 0.5) w.addFood(wp.x + (Math.random() - 0.5) * 50, wp.y + (Math.random() - 0.5) * 50, 10);
    } else {
      const hit = pickOrganism(playbackRef.current ?? w.orgs, wp.x, wp.y, cam.zoom);
      st.current.hoverId = hit ? hit.id : 0;
    }
  };

  const onPointerUp = () => {
    const p = ptr.current;
    const w = worldRef.current;
    if (p.mode === 'pan' && !p.moved && tool === 'select') setSelectedId(0);
    if (p.mode === 'drag') {
      const o = w.findOrg(p.id);
      if (o) {
        const z = w.zoneIndex(o.x);
        if (z !== p.zone) {
          w.events.push({ t: w.time, kind: 'habitat', text: `#${o.id} transplanted into ${w.zones[z].name}` });
          flash(`Transplanted into ${w.zones[z].name}`);
        }
      }
    }
    p.mode = 'none';
  };

  const onWheel = (e: React.WheelEvent) => {
    const cam = camRef.current;
    const before = screenToWorld(cam, window.innerWidth, window.innerHeight, e.clientX, e.clientY);
    cam.zoom = Math.max(0.18, Math.min(5, cam.zoom * Math.exp(-e.deltaY * 0.0015)));
    const after = screenToWorld(cam, window.innerWidth, window.innerHeight, e.clientX, e.clientY);
    cam.x += before.x - after.x;
    cam.y += before.y - after.y;
  };

  // ---------- keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'SELECT') return;
      const w = worldRef.current;
      switch (e.key) {
        case ' ': e.preventDefault(); setPaused((p) => !p); break;
        case 'm': toggleMute(); break;
        case 'f': w.globals.freezeLife = !w.globals.freezeLife; setTick((t) => t + 1); break;
        case 'o': setPanels((p) => ({ ...p, obs: !p.obs })); break;
        case 'l': setPanels((p) => ({ ...p, lab: !p.lab })); break;
        case 'c': setPanels((p) => ({ ...p, cond: !p.cond })); break;
        case 'h': setPanels((p) => ({ ...p, deck: !p.deck })); break;
        case 'g': setOverlays((v) => !v); break;
        case 'Escape': setSelectedId(0); setTracking(false); break;
        case '1': case '2': case '3': case '4': case '5': case '6': setSpeed(SPEEDS[parseInt(e.key) - 1]); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const w = worldRef.current;
  const audio = audioRef.current;
  const lastStat = w.stats[w.stats.length - 1];
  const living = new Set(w.orgs.map((o) => o.speciesId)).size;
  const meanGen = lastStat?.meanGen ?? 0;
  const getCondPos = useCallback(() => st.current.condPos / st.current.condLen, []);

  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-black">
      <canvas ref={bgRef} className="absolute inset-0 h-full w-full" />
      <canvas
        ref={fgRef}
        className={`absolute inset-0 ${tool === 'select' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onWheel={onWheel}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* top bar */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 flex items-start justify-between gap-3 p-3">
        <div className="pointer-events-auto flex items-center gap-4 rounded-md border border-cyan-300/10 bg-black/40 px-3 py-2 backdrop-blur-md">
          <div>
            <div className="sg-title text-lg font-bold tracking-[0.35em]">SONOGENESIS</div>
            <div className="text-[8px] uppercase tracking-[0.3em] text-cyan-100/40">artificial ecology of living sound</div>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[9px] uppercase text-cyan-100/40">seed</span>
            <input value={seedText} onChange={(e) => setSeedText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && newWorld(seedText)} className="w-24 rounded border border-cyan-300/15 bg-black/40 px-1.5 py-0.5 text-[11px] text-cyan-50 outline-none" />
            <Btn onClick={() => newWorld(seedText)} title="Regenerate world from seed">Generate</Btn>
            <Btn onClick={() => { const s = String(Math.floor(Math.random() * 99999)); setSeedText(s); newWorld(s); }} title="Random seed">⚄</Btn>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-1 rounded-md border border-cyan-300/10 bg-black/40 px-2 py-2 backdrop-blur-md">
          <Btn active={paused} onClick={() => setPaused(!paused)} title="Space">{paused ? '▶' : '❚❚'}</Btn>
          {SPEEDS.map((s) => (
            <Btn key={s} active={speed === s} onClick={() => setSpeed(s)} className="px-1.5">{s}×</Btn>
          ))}
          <Btn active={w.globals.freezeLife} tone="amber" onClick={() => { w.globals.freezeLife = !w.globals.freezeLife; setTick(tick + 1); }} title="Freeze births, deaths & aging; movement and sound continue (F)">Freeze life</Btn>
        </div>

        <div className="pointer-events-auto flex items-center gap-2 rounded-md border border-cyan-300/10 bg-black/40 px-2 py-2 backdrop-blur-md">
          <canvas ref={specRef} width={120} height={28} className="h-7 w-[120px] opacity-90" />
          <Btn active={audio.started && !muted} onClick={toggleMute} title="M">{!audio.started ? '♪ Enable audio' : muted ? '♪ Unmute' : '♪ Mute'}</Btn>
          <input type="range" min={0} max={1} step={0.01} value={audio.volume} onChange={(e) => { audio.setVolume(parseFloat(e.target.value)); setTick(tick + 1); }} className="sg-range w-20" title="Master gain" />
          <Btn tone="rose" active={recording} onClick={toggleRecord} title="Record WAV">
            {recording ? <span><span className="sg-rec">●</span> {audio.recordedSeconds().toFixed(0)}s</span> : '● Rec'}
          </Btn>
        </div>
      </div>

      {/* left tool rail */}
      <div className="pointer-events-auto absolute left-3 top-[76px] flex flex-col gap-1 rounded-md border border-cyan-300/10 bg-black/40 p-1.5 backdrop-blur-md">
        {([['select', '◎', 'Select / drag organisms / pan'], ['spawn', '✦', 'Introduce a new species'], ['feed', '∴', 'Seed nutrients'], ['cull', '✕', 'Cull organism']] as [Tool, string, string][]).map(([t, ic, tip]) => (
          <button key={t} title={tip} onClick={() => setTool(t)} className={`h-8 w-8 rounded text-sm ${tool === t ? 'bg-cyan-300/20 text-cyan-50 shadow-[0_0_10px_rgba(80,220,255,0.4)]' : 'text-cyan-100/50 hover:text-cyan-50'}`}>{ic}</button>
        ))}
        <div className="my-1 h-px bg-cyan-300/10" />
        {([['deck', '☰', 'Control deck (H)'], ['obs', '◈', 'Observatory (O)'], ['lab', '⚗', 'Mutation lab (L)'], ['lib', '❖', 'Archive'], ['cond', '≋', 'Conductor (C)']] as [keyof typeof panels, string, string][]).map(([k, ic, tip]) => (
          <button key={k} title={tip} onClick={() => setPanels((p) => ({ ...p, [k]: !p[k] }))} className={`h-8 w-8 rounded text-sm ${panels[k] ? 'bg-violet-300/20 text-violet-50' : 'text-cyan-100/50 hover:text-cyan-50'}`}>{ic}</button>
        ))}
        <div className="my-1 h-px bg-cyan-300/10" />
        <button title="Scientific overlays (G)" onClick={() => setOverlays(!overlays)} className={`h-8 w-8 rounded text-[10px] ${overlays ? 'text-lime-200 bg-lime-300/15' : 'text-cyan-100/40'}`}>SCI</button>
        <button title="Particle trails" onClick={() => setTrails(!trails)} className={`h-8 w-8 rounded text-[10px] ${trails ? 'text-cyan-100 bg-cyan-300/10' : 'text-cyan-100/40'}`}>TRL</button>
        <button title="Labels (with overlays)" onClick={() => setLabels(!labels)} className={`h-8 w-8 rounded text-[10px] ${labels ? 'text-cyan-100 bg-cyan-300/10' : 'text-cyan-100/40'}`}>LBL</button>
      </div>

      {/* control deck */}
      {panels.deck && (
        <div className="absolute left-[60px] top-[76px]">
          <ControlDeck world={w} audio={audio} zone={zoneSel} setZone={setZoneSel} onFocusZone={focusZone} tick={tick} onClose={() => setPanels((p) => ({ ...p, deck: false }))} />
        </div>
      )}

      {/* inspector */}
      {selected && (
        <div className="absolute right-3 top-[76px]">
          <Inspector
            world={w} org={selected} audio={audio} solo={audio.soloIds.has(selected.id)} tracking={tracking}
            onClose={() => { setSelectedId(0); setTracking(false); }}
            onMute={() => { selected.muted = !selected.muted; setTick(tick + 1); }}
            onSolo={() => { const s = audio.soloIds; if (s.has(selected.id)) s.delete(selected.id); else s.add(selected.id); setTick(tick + 1); }}
            onTrack={() => setTracking(!tracking)}
            onSave={() => saveSpecimen(selected, false)}
            onSaveLineage={() => saveSpecimen(selected, true)}
            onToLab={() => { setLabInit({ genome: selected.genome.slice(), motif: selected.motif.slice(), name: `${w.species.get(selected.speciesId)?.name.split(' ')[0]} #${selected.id}` }); setLabKey((k) => k + 1); setPanels((p) => ({ ...p, lab: true })); }}
            onClone={() => { const c = w.spawn(selected.x + 20, selected.y + 20, selected.genome.slice(), { speciesId: selected.speciesId, parentId: selected.id, generation: selected.generation + 1, motif: selected.motif.slice() }); flash(`Cloned → #${c.id}`); }}
            onKill={() => { w.kill(selected, 'removed'); setSelectedId(0); }}
            onEdit={(g) => { selected.genome = g; selected.ph = express(g); selected.body = undefined; const r = w.lineage.get(selected.id); if (r) r.genome = g.slice(); setTick(tick + 1); }}
            onSelect={(id) => setSelectedId(id)}
            onAudition={async (t: CallType) => { await ensureAudio(); audio.audition(selected.ph, t, selected.motif); selected.voiceEnv = 1; }}
          />
        </div>
      )}

      {/* HUD bottom right */}
      <div className="pointer-events-none absolute bottom-3 right-3 flex flex-col items-end gap-2" style={{ marginBottom: panels.cond ? 'calc(34vh + 60px)' : 0 }}>
        <div className="rounded-md border border-cyan-300/10 bg-black/40 px-3 py-2 backdrop-blur-md">
          <div className="grid grid-cols-4 gap-x-4 gap-y-1 text-[10px]">
            <HudStat k="Organisms" v={w.orgs.length} />
            <HudStat k="Species" v={living} />
            <HudStat k="Mean gen" v={meanGen.toFixed(1)} />
            <HudStat k="Sonic BDI" v={stats ? stats.sonicIndex.toFixed(2) : '…'} />
            <HudStat k="Voices" v={audio.voices} />
            <HudStat k="Nutrients" v={w.food.length} />
            <HudStat k="Tempo" v={`${w.globals.tempo}`} />
            <HudStat k="Sim t" v={`${Math.floor(w.time)}s`} />
          </div>
          <div className="mt-1.5 flex gap-2 text-[8px] uppercase tracking-wider">
            {CALL_TYPES.map((t) => <span key={t} style={{ color: CALL_COLORS[t] }}>◯ {t}</span>)}
          </div>
        </div>
      </div>

      {playback >= 0 && (
        <div className="pointer-events-none absolute left-1/2 top-[70px] -translate-x-1/2 rounded border border-amber-300/40 bg-amber-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-amber-100">
          Generational playback · t={w.keyframes[playback]?.t.toFixed(0)}s
        </div>
      )}
      {w.globals.freezeLife && (
        <div className="pointer-events-none absolute left-1/2 top-[70px] -translate-x-1/2 translate-y-8 text-[10px] uppercase tracking-[0.3em] text-amber-200/70">Population frozen — life cycle suspended</div>
      )}

      {/* overlays: observatory, lab, library */}
      {(panels.obs || panels.lab || panels.lib) && (
        <div className="pointer-events-none absolute inset-x-0 top-[70px] flex justify-center">
          <div className="pointer-events-auto">
            {panels.obs && (
              <Observatory
                world={w} tick={tick} stats={stats} playback={playback}
                setPlayback={(i) => setPlayback(i)}
                onRestore={() => { const kf = w.keyframes[playback]; if (kf) { w.restoreKeyframe(kf); setPlayback(-1); setSelectedId(0); flash('World rewound'); } }}
                onSelectSpecies={(id) => { const o = w.orgs.find((x) => x.speciesId === id); if (o) { setSelectedId(o.id); setTracking(true); } }}
                onClose={() => { setPanels((p) => ({ ...p, obs: false })); setPlayback(-1); }}
              />
            )}
            {panels.lab && !panels.obs && (
              <Lab
                key={labKey} initial={labInit} audio={audio} specimens={specimens} ensureAudio={ensureAudio}
                onRelease={(g, m, n) => { const c = camRef.current; const f = introduce(c.x, c.y, g, m, n); setSelectedId(f.id); flash(`Released ${n} × ${w.species.get(f.speciesId)?.name}`); }}
                onSave={async (s) => { await dbPut('specimens', { id: `s${Date.now()}`, name: s.name, genome: s.genome, motif: s.motif, speciesName: 'Laboratory strain', generation: 0, saved: Date.now() }); refreshArchive(); flash(`${s.name} saved`); }}
                onClose={() => setPanels((p) => ({ ...p, lab: false }))}
              />
            )}
            {panels.lib && !panels.obs && !panels.lab && (
              <Library
                specimens={specimens} snapshots={snapshots}
                onRelease={(s) => { const c = camRef.current; const f = introduce(c.x, c.y, s.genome, s.motif, 5); setSelectedId(f.id); flash(`Released ${s.name}`); }}
                onReleaseLineage={(s) => {
                  const c = camRef.current;
                  const f = introduce(c.x, c.y, s.genome, s.motif, 3);
                  (s.lineage ?? []).slice(0, 8).forEach((a, i) => w.spawn(c.x + Math.cos(i) * 90, c.y + Math.sin(i) * 90, a.genome.slice(), { speciesId: w.assignSpecies(a.genome, f.speciesId), motif: s.motif.slice(), energyFrac: 0.8 }));
                  flash(`Lineage of ${s.name} revived`);
                }}
                onToLab={(s) => { setLabInit({ genome: s.genome.slice(), motif: s.motif.slice(), name: s.name }); setLabKey((k) => k + 1); setPanels((p) => ({ ...p, lib: false, lab: true })); }}
                onDeleteSpec={async (id) => { await dbDel('specimens', id); refreshArchive(); }}
                onSaveSnapshot={saveSnapshot}
                onLoadSnapshot={loadSnapshot}
                onDeleteSnapshot={async (id) => { await dbDel('snapshots', id); refreshArchive(); }}
                onImport={importFile}
                onClose={() => setPanels((p) => ({ ...p, lib: false }))}
              />
            )}
          </div>
        </div>
      )}

      {/* conductor */}
      {panels.cond && (
        <div className="absolute bottom-3 left-[280px] right-3">
          <Conductor
            lanes={lanesRef.current} playing={condPlaying} length={condLen} loop={condLoop} getPos={getCondPos}
            onPlay={() => { if (!condPlaying) ensureAudio(); setCondPlaying(!condPlaying); }}
            onSeek={(t) => { st.current.condPos = t * condLen; }}
            setLength={(s) => { st.current.condPos = (st.current.condPos / condLen) * s; setCondLen(s); }}
            setLoop={setCondLoop}
            onClose={() => setPanels((p) => ({ ...p, cond: false }))}
          />
        </div>
      )}

      {toast && (
        <div className="pointer-events-none absolute bottom-24 left-1/2 -translate-x-1/2 rounded border border-cyan-300/30 bg-black/70 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-cyan-50 shadow-[0_0_30px_rgba(80,200,255,0.25)]">{toast}</div>
      )}

      {/* entry splash (audio requires user gesture) */}
      {!entered && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/55 backdrop-blur-[2px]">
          <div className="max-w-xl text-center px-6">
            <div className="sg-title text-5xl font-bold tracking-[0.4em] md:text-6xl">SONOGENESIS</div>
            <div className="sg-breathe mt-3 text-[11px] uppercase text-cyan-100/70">artificial ecology of living sound</div>
            <p className="mt-8 text-[12px] leading-relaxed text-cyan-100/60">
              A microscopic biosphere of evolving synthesizers. Every organism carries a genome that shapes its body, its behaviour and its voice.
              They forage, court, warn, synchronise and speciate — and the habitat's acoustics decide whose songs survive.
              <br /><br />
              <span className="text-cyan-100/80">The ecosystem is the orchestra. Evolution is the composer. You are the ecological conductor.</span>
            </p>
            <div className="mt-8 flex justify-center gap-3">
              <button onClick={enter} className="rounded border border-cyan-200/50 bg-cyan-300/10 px-6 py-3 text-xs uppercase tracking-[0.35em] text-cyan-50 shadow-[0_0_40px_rgba(80,220,255,0.35)] transition hover:bg-cyan-300/20">Enter with sound</button>
              <button onClick={() => setEntered(true)} className="rounded border border-white/15 px-4 py-3 text-xs uppercase tracking-[0.3em] text-white/50 hover:text-white/80">Silent observation</button>
            </div>
            <div className="mt-6 text-[10px] text-cyan-100/35">
              scroll: zoom · drag: pan / move organisms · click: inspect · space: pause · 1–6: time · F: freeze · O: observatory · L: lab · C: conductor · G: overlays
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HudStat({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="text-[8px] uppercase tracking-[0.2em] text-cyan-100/40">{k}</span>
      <span className="tabular-nums text-cyan-50/90">{v}</span>
    </div>
  );
}
