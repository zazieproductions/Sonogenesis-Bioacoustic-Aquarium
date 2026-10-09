import { useMemo, useRef, useState } from 'react';
import { RNG } from '../sim/rng';
import { crossover, mutate, randomGenome, express, geneticDistance } from '../sim/genome';
import type { CallType } from '../sim/world';
import { CALL_COLORS } from '../sim/world';
import type { AudioEngine } from '../audio/engine';
import type { Specimen } from '../db';
import { Panel, Btn, Slider } from './ui';
import { GenomeEditor, SpecimenThumb } from './GenomeEditor';
import { SectionTitle, noteName } from './Inspector';

export interface LabSlot { genome: number[]; motif: number[]; name: string }

interface Props {
  initial: LabSlot | null;
  audio: AudioEngine;
  specimens: Specimen[];
  onRelease: (genome: number[], motif: number[], count: number) => void;
  onSave: (slot: LabSlot) => void;
  onClose: () => void;
  ensureAudio: () => void;
}

export function Lab({ initial, audio, specimens, onRelease, onSave, onClose, ensureAudio }: Props) {
  const rng = useRef(new RNG((Date.now() & 0xffffffff) >>> 0));
  const [a, setA] = useState<LabSlot>(initial ?? { genome: randomGenome(rng.current), motif: [0, 2, 4], name: 'Synthetic α' });
  const [b, setB] = useState<LabSlot | null>(null);
  const [work, setWork] = useState<LabSlot>(a);
  const [kids, setKids] = useState<number[][]>([]);
  const [rate, setRate] = useState(0.12);
  const [strength, setStrength] = useState(0.1);
  const [target, setTarget] = useState({ pitch: 0.5, noise: 0.2, harm: 0.8, rhythm: 0.5 });
  const [releaseN, setReleaseN] = useState(6);
  const [log, setLog] = useState('');

  const breed = () => {
    const out: number[][] = [];
    for (let i = 0; i < 8; i++) {
      const base = b ? crossover(a.genome, b.genome, rng.current) : a.genome;
      out.push(mutate(base, rate, strength, rng.current).genome);
    }
    setKids(out);
  };

  const fitness = (g: number[]) => {
    const p = express(g);
    return -(
      Math.abs(p.spectral - target.pitch) * 1.5 +
      Math.abs(p.noise - target.noise) +
      Math.abs(p.harmonicity - target.harm) +
      Math.abs(Math.log2(p.rhythmDiv) / 4 + 0.5 - target.rhythm) * 0.6
    );
  };

  const selectiveBreed = (gens: number) => {
    let pa = a.genome, pb = b?.genome ?? mutate(a.genome, 0.3, 0.15, rng.current).genome;
    const start = fitness(pa);
    for (let gi = 0; gi < gens; gi++) {
      const pop: number[][] = [];
      for (let i = 0; i < 30; i++) pop.push(mutate(crossover(pa, pb, rng.current), rate, strength, rng.current).genome);
      pop.sort((x, y) => fitness(y) - fitness(x));
      pa = pop[0]; pb = pop[1];
    }
    const na = { genome: pa, motif: a.motif, name: a.name + ` ·F${gens}` };
    setA(na);
    setB({ genome: pb, motif: a.motif, name: 'Sibling' });
    setWork(na);
    setLog(`Artificial selection: ${gens} generations · fitness ${start.toFixed(2)} → ${fitness(pa).toFixed(2)} · genetic shift ${geneticDistance(a.genome, pa).toFixed(3)}`);
  };

  const audition = (g: number[], motif: number[], t: CallType = 'social') => {
    ensureAudio();
    setTimeout(() => audio.audition(express(g), t, motif), 30);
  };

  const wp = useMemo(() => express(work.genome), [work.genome]);

  return (
    <Panel title="Mutation Laboratory · Breeding Chamber" onClose={onClose} className="w-[min(1000px,calc(100vw-40px))] max-h-[calc(100vh-140px)] overflow-y-auto sg-scroll">
      <div className="p-4 text-[11px]">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr_1fr] gap-4">
          <ParentSlot label="Parent α" slot={a} onPick={(s) => { setA(s); setWork(s); }} specimens={specimens} onAudition={() => audition(a.genome, a.motif)} onRandom={() => setA({ genome: randomGenome(rng.current), motif: [0, 3, 5], name: 'Random α' })} />
          <div className="flex flex-col gap-2">
            <SectionTitle>Breeding parameters</SectionTitle>
            <Slider label="Mutation rate" value={rate} max={0.5} onChange={setRate} />
            <Slider label="Mutation strength" value={strength} max={0.4} onChange={setStrength} />
            <div className="flex gap-1">
              <Btn tone="lime" onClick={breed}>{b ? 'Cross α × β' : 'Bud α (asexual)'}</Btn>
              <Btn onClick={() => setB(null)} disabled={!b}>Clear β</Btn>
            </div>
            <SectionTitle>Acoustic selection target</SectionTitle>
            <Slider label="Pitch (low → high)" value={target.pitch} onChange={(v) => setTarget({ ...target, pitch: v })} />
            <Slider label="Noise / grain" value={target.noise} onChange={(v) => setTarget({ ...target, noise: v })} />
            <Slider label="Harmonicity" value={target.harm} onChange={(v) => setTarget({ ...target, harm: v })} />
            <Slider label="Rhythmic rate" value={target.rhythm} onChange={(v) => setTarget({ ...target, rhythm: v })} />
            <div className="flex gap-1">
              <Btn tone="amber" onClick={() => selectiveBreed(5)}>Select ×5 gen</Btn>
              <Btn tone="amber" onClick={() => selectiveBreed(25)}>Select ×25 gen</Btn>
            </div>
            {log && <div className="text-[10px] text-amber-100/70">{log}</div>}
          </div>
          <ParentSlot label="Parent β" slot={b} onPick={setB} specimens={specimens} onAudition={() => b && audition(b.genome, b.motif)} onRandom={() => setB({ genome: randomGenome(rng.current), motif: [0, 2, 5], name: 'Random β' })} />
        </div>

        {kids.length > 0 && (
          <>
            <SectionTitle>Offspring — audition, then promote</SectionTitle>
            <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
              {kids.map((k, i) => (
                <div key={i} className="rounded border border-cyan-300/10 bg-black/30 p-1 flex flex-col items-center">
                  <button onClick={() => audition(k, a.motif)} title="Audition"><SpecimenThumb genome={k} size={84} /></button>
                  <div className="text-[9px] text-cyan-100/50">{express(k).freq.toFixed(0)}Hz · {express(k).wave.slice(0, 3)}</div>
                  <div className="flex gap-1 mt-1">
                    <button className="text-[9px] text-cyan-200 hover:text-white" onClick={() => { const s = { genome: k, motif: a.motif, name: `${a.name}′${i + 1}` }; setA(s); setWork(s); }}>α</button>
                    <button className="text-[9px] text-cyan-200 hover:text-white" onClick={() => setB({ genome: k, motif: a.motif, name: `Offspring ${i + 1}` })}>β</button>
                    <button className="text-[9px] text-lime-200 hover:text-white" onClick={() => setWork({ genome: k, motif: a.motif, name: `Offspring ${i + 1}` })}>edit</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <SectionTitle>Genome workbench — {work.name}</SectionTitle>
        <div className="flex gap-4 items-start">
          <div className="rounded border border-cyan-300/10 bg-black/40"><SpecimenThumb genome={work.genome} size={140} /></div>
          <div className="flex-1">
            <GenomeEditor genome={work.genome} height={90} onChange={(g) => setWork({ ...work, genome: g })} compare={a.genome} />
            <div className="mt-2 grid grid-cols-3 md:grid-cols-6 gap-2 text-[10px] text-cyan-100/60">
              <span>{wp.wave} · {wp.freq.toFixed(0)}Hz {noteName(wp.freq)}</span>
              <span>FM {wp.fmRatio.toFixed(2)}:{wp.fmIndex.toFixed(1)}</span>
              <span>noise {wp.noise.toFixed(2)}</span>
              <span>harm {wp.harmonicity.toFixed(2)}</span>
              <span>rhythm ×{wp.rhythmDiv}</span>
              <span>{wp.diet > 0.5 ? 'predator' : 'grazer'} · r{wp.radius.toFixed(0)}</span>
            </div>
            <div className="mt-2 flex items-center gap-1">
              <span className="text-[10px] uppercase text-cyan-100/50 mr-1">Motif</span>
              <input
                className="w-40 bg-black/30 border border-cyan-300/15 rounded px-1 font-mono text-cyan-50"
                value={work.motif.join(' ')}
                onChange={(e) => setWork({ ...work, motif: e.target.value.split(/[ ,]+/).filter(Boolean).map((x) => parseInt(x) || 0).slice(0, 8) })}
              />
              {(['pulse', 'social', 'mating', 'territory', 'food', 'distress'] as CallType[]).map((t) => (
                <button key={t} onClick={() => audition(work.genome, work.motif, t)} className="rounded border px-1 text-[9px] uppercase" style={{ borderColor: CALL_COLORS[t] + '55', color: CALL_COLORS[t] }}>{t}</button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input value={work.name} onChange={(e) => setWork({ ...work, name: e.target.value })} className="bg-transparent border-b border-cyan-300/20 text-cyan-50 outline-none w-40" />
              <Btn tone="lime" onClick={() => onSave(work)}>Save to library</Btn>
              <span className="ml-2 text-cyan-100/50">Release</span>
              <input type="number" min={1} max={30} value={releaseN} onChange={(e) => setReleaseN(Math.max(1, Math.min(30, parseInt(e.target.value) || 1)))} className="w-12 bg-black/30 border border-cyan-300/15 rounded px-1 text-cyan-50" />
              <Btn tone="amber" onClick={() => onRelease(work.genome, work.motif, releaseN)}>Introduce into world</Btn>
              <Btn onClick={() => { setA(work); }}>Set as α</Btn>
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function ParentSlot({ label, slot, onPick, specimens, onAudition, onRandom }: { label: string; slot: LabSlot | null; onPick: (s: LabSlot) => void; specimens: Specimen[]; onAudition: () => void; onRandom: () => void }) {
  return (
    <div className="flex flex-col items-center rounded border border-cyan-300/10 bg-black/20 p-2">
      <div className="text-[9px] uppercase tracking-[0.25em] text-cyan-300/60 self-start">{label}</div>
      {slot ? (
        <>
          <button onClick={onAudition} title="Audition"><SpecimenThumb genome={slot.genome} size={120} /></button>
          <div className="text-cyan-50/80 italic truncate max-w-full">{slot.name}</div>
        </>
      ) : (
        <div className="h-[120px] flex items-center text-cyan-100/30">empty</div>
      )}
      <div className="flex gap-1 mt-1">
        <Btn onClick={onRandom} className="text-[9px]">Random</Btn>
        <select
          className="bg-black/40 border border-cyan-300/15 rounded text-[10px] text-cyan-100 max-w-[120px]"
          value=""
          onChange={(e) => {
            const s = specimens.find((x) => x.id === e.target.value);
            if (s) onPick({ genome: s.genome.slice(), motif: s.motif.slice(), name: s.name });
          }}
        >
          <option value="">From library…</option>
          {specimens.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
    </div>
  );
}
