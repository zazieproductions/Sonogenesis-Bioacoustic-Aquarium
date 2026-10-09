import { useMemo } from 'react';
import type { Organism, World, CallType } from '../sim/world';
import { signalEfficiency, CALL_COLORS } from '../sim/world';
import { Panel, Btn } from './ui';
import { GenomeEditor, SpecimenThumb } from './GenomeEditor';
import type { AudioEngine } from '../audio/engine';

const NOTE = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];
export function noteName(f: number) {
  const st = Math.round(12 * Math.log2(f / 55));
  return NOTE[((st % 12) + 12) % 12] + (1 + Math.floor((st + 9) / 12));
}

interface Props {
  world: World;
  org: Organism;
  audio: AudioEngine;
  solo: boolean;
  tracking: boolean;
  onClose: () => void;
  onMute: () => void;
  onSolo: () => void;
  onTrack: () => void;
  onSave: () => void;
  onSaveLineage: () => void;
  onToLab: () => void;
  onClone: () => void;
  onKill: () => void;
  onEdit: (g: number[]) => void;
  onSelect: (id: number) => void;
  onAudition: (t: CallType) => void;
}

export function Inspector(p: Props) {
  const { world, org: o } = p;
  const sp = world.species.get(o.speciesId);
  const zone = world.zones[o.zone];
  const eff = signalEfficiency(o.ph, zone);
  const ancestors = useMemo(() => world.ancestors(o.id, 10), [world, o.id, o.generation]);
  const desc = world.descendants(o.id, 80);
  const livingDesc = desc.filter((d) => d.died === null).length;
  const ph = o.ph;
  const row = (k: string, v: React.ReactNode) => (
    <div className="flex justify-between border-b border-white/[0.04] py-[3px]"><span className="text-cyan-100/45">{k}</span><span className="tabular-nums text-cyan-50/90">{v}</span></div>
  );
  return (
    <Panel
      title={<span>Specimen #{o.id}</span>}
      onClose={p.onClose}
      className="w-[330px] max-h-[calc(100vh-150px)] overflow-y-auto sg-scroll"
    >
      <div className="p-3 text-[11px]">
        <div className="flex gap-3">
          <div className="rounded border border-cyan-300/10 bg-black/40">
            <SpecimenThumb genome={o.genome} size={104} pulse={o.voiceEnv} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm italic" style={{ color: `hsl(${sp?.hue ?? 0},80%,75%)` }}>{sp?.name}</div>
            <div className="text-[10px] uppercase tracking-wider text-cyan-100/40">Gen {o.generation} · {o.state}</div>
            <div className="mt-2 space-y-1">
              <Meter label="Energy" v={o.energy / ph.capacity} color="#7fffd0" />
              <Meter label="Health" v={o.health} color="#7fd8ff" />
              <Meter label="Age" v={o.age / ph.lifespan} color="#ffb27a" />
              <Meter label="Voice" v={o.voiceEnv} color={o.lastCallType ? CALL_COLORS[o.lastCallType] : '#fff'} />
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1">
          <Btn active={o.muted} tone="rose" onClick={p.onMute}>{o.muted ? 'Muted' : 'Mute'}</Btn>
          <Btn active={p.solo} tone="amber" onClick={p.onSolo}>Solo</Btn>
          <Btn active={p.tracking} onClick={p.onTrack}>Track</Btn>
          <Btn onClick={p.onSave} tone="lime">Save</Btn>
          <Btn onClick={p.onSaveLineage} tone="lime">Save lineage</Btn>
          <Btn onClick={p.onToLab}>→ Lab</Btn>
          <Btn onClick={p.onClone}>Clone</Btn>
          <Btn onClick={p.onKill} tone="rose">Cull</Btn>
        </div>

        <SectionTitle>Audition voice</SectionTitle>
        <div className="flex flex-wrap gap-1">
          {(['pulse', 'social', 'mating', 'territory', 'food', 'distress'] as CallType[]).map((t) => (
            <button key={t} onClick={() => p.onAudition(t)} className="rounded border px-1.5 py-0.5 text-[10px] uppercase" style={{ borderColor: CALL_COLORS[t] + '55', color: CALL_COLORS[t] }}>{t}</button>
          ))}
        </div>

        <SectionTitle>Synth voice</SectionTitle>
        <div className="grid grid-cols-2 gap-x-3">
          {row('Waveform', ph.wave)}
          {row('Fundamental', `${ph.freq.toFixed(0)}Hz ${noteName(ph.freq)}`)}
          {row('FM ratio', ph.fmRatio.toFixed(2))}
          {row('FM depth', ph.fmIndex.toFixed(2))}
          {row('Harmonics', ph.harmonics.toFixed(2))}
          {row('Noise', ph.noise.toFixed(2))}
          {row('Attack', `${(ph.attack * 1000).toFixed(0)}ms`)}
          {row('Decay', `${(ph.decay * 1000).toFixed(0)}ms`)}
          {row('Cutoff', ph.cutoff.toFixed(2))}
          {row('Resonance', ph.resonance.toFixed(2))}
          {row('Rhythm', `×${ph.rhythmDiv}`)}
          {row('Drone', ph.drone ? 'yes' : 'no')}
        </div>
        <div className="mt-1">{row('Song motif', <span className="font-mono">[{o.motif.join(' ')}]</span>)}</div>
        {row('Signal carry here', <span style={{ color: eff > 0.7 ? '#7fffd0' : eff > 0.4 ? '#ffe27a' : '#ff6a6a' }}>{(eff * 100).toFixed(0)}%</span>)}
        {row('Calls made', o.callsMade)}

        <SectionTitle>Ecology</SectionTitle>
        <div className="grid grid-cols-2 gap-x-3">
          {row('Habitat', zone.name.replace('The ', ''))}
          {row('Radius', ph.radius.toFixed(1))}
          {row('Speed', ph.maxSpeed.toFixed(0))}
          {row('Metabolism', ph.metabolism.toFixed(2) + '/s')}
          {row('Diet', ph.diet > 0.5 ? 'predator' : ph.diet > 0.15 ? 'omnivore' : 'grazer')}
          {row('Thermal pref', ph.tempPref.toFixed(2))}
          {row('Sociality', ph.sociality.toFixed(2))}
          {row('Aggression', ph.aggression.toFixed(2))}
          {row('Brood', ph.brood)}
          {row('Repro', ph.sexual > 0.35 ? 'sexual' : 'budding')}
          {row('Children', o.children)}
          {row('Mutations', o.mutations)}
        </div>

        <SectionTitle>Genome — drag to engineer</SectionTitle>
        <GenomeEditor genome={o.genome} onChange={p.onEdit} compare={sp?.rep} />

        <SectionTitle>Lineage</SectionTitle>
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {ancestors.slice().reverse().map((a) => {
            const alive = !!world.findOrg(a.id);
            return (
              <button key={a.id} title={`#${a.id} gen ${a.gen}${alive ? ' (alive)' : ''}`} onClick={() => alive && p.onSelect(a.id)}
                className="h-3 w-3 shrink-0 rounded-full border" style={{ background: alive ? `hsl(${a.hue},80%,60%)` : 'transparent', borderColor: `hsl(${a.hue},80%,60%)` }} />
            );
          })}
          <span className="h-4 w-4 shrink-0 rounded-full ring-2 ring-cyan-200" style={{ background: `hsl(${ph.hue},80%,60%)` }} />
          <span className="ml-2 text-cyan-100/50 whitespace-nowrap">{desc.length} desc · {livingDesc} living</span>
        </div>
        <div className="flex flex-wrap gap-1 mt-1">
          {desc.filter((d) => d.died === null).slice(0, 24).map((d) => (
            <button key={d.id} onClick={() => p.onSelect(d.id)} className="rounded px-1 text-[9px]" style={{ color: `hsl(${d.hue},80%,70%)`, border: `1px solid hsla(${d.hue},80%,60%,0.3)` }}>#{d.id}</button>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function Meter({ label, v, color }: { label: string; v: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 text-[9px] uppercase tracking-wider text-cyan-100/40">{label}</span>
      <div className="h-[3px] flex-1 rounded bg-white/5">
        <div className="h-full rounded" style={{ width: `${Math.max(0, Math.min(1, v)) * 100}%`, background: color, boxShadow: `0 0 6px ${color}` }} />
      </div>
    </div>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="mb-1 mt-3 text-[9px] uppercase tracking-[0.25em] text-cyan-300/60">{children}</div>;
}
