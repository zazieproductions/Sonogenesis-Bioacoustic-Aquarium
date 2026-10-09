import { useEffect, useState } from 'react';
import type { World } from '../sim/world';
import { HABITAT_PRESETS, HABITAT_SLIDERS, HabitatType, cloneHabitat, sliderMax, HabitatParams } from '../sim/habitats';
import { Panel, Btn, Slider } from './ui';
import type { AudioEngine, ScaleName } from '../audio/engine';
import { dbAll, dbPut, dbDel, PresetRec } from '../db';

interface Props {
  world: World;
  audio: AudioEngine;
  zone: number;
  setZone: (z: number) => void;
  onFocusZone: (z: number) => void;
  tick: number;
  onClose: () => void;
}

export function ControlDeck({ world, audio, zone, setZone, onFocusZone, onClose }: Props) {
  const [tab, setTab] = useState<'habitat' | 'evolution' | 'audio'>('habitat');
  const [, force] = useState(0);
  const [presets, setPresets] = useState<PresetRec[]>([]);
  const refresh = () => force((x) => x + 1);
  const h = world.zones[zone];
  const g = world.globals;

  useEffect(() => {
    dbAll<PresetRec>('presets').then(setPresets).catch(() => {});
  }, []);

  const setParam = (k: keyof HabitatParams, v: number) => {
    (h as unknown as Record<string, number>)[k] = v;
    refresh();
  };
  const applyPreset = (t: HabitatType) => {
    const p = cloneHabitat(HABITAT_PRESETS[t]);
    world.zones[zone] = p;
    world.events.push({ t: world.time, kind: 'habitat', text: `Zone ${zone + 1} terraformed into ${p.name}` });
    refresh();
  };
  const savePreset = async () => {
    const rec: PresetRec = { id: `p${Date.now()}`, name: h.name, params: cloneHabitat(h) };
    await dbPut('presets', rec);
    setPresets(await dbAll('presets'));
  };

  return (
    <Panel
      title="Control Deck"
      onClose={onClose}
      className="w-[300px] max-h-[calc(100vh-150px)] flex flex-col"
      right={
        <div className="flex gap-1">
          {(['habitat', 'evolution', 'audio'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded ${tab === t ? 'bg-cyan-300/15 text-cyan-50' : 'text-cyan-100/40 hover:text-cyan-100/80'}`}>{t}</button>
          ))}
        </div>
      }
    >
      <div className="overflow-y-auto sg-scroll p-3">
        {tab === 'habitat' && (
          <>
            <div className="grid grid-cols-5 gap-1 mb-2">
              {world.zones.map((z, i) => (
                <button
                  key={i}
                  onClick={() => { setZone(i); onFocusZone(i); }}
                  className={`h-8 rounded border text-[9px] uppercase ${i === zone ? 'border-cyan-200/70 text-cyan-50' : 'border-white/10 text-white/40'}`}
                  style={{ background: `linear-gradient(180deg, rgba(${z.color2.map((c) => c * 255).join(',')},0.35), rgba(${z.color.map((c) => c * 255).join(',')},0.9))` }}
                  title={z.name}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <input value={h.name} onChange={(e) => { h.name = e.target.value; refresh(); }} className="w-full bg-transparent border-b border-cyan-300/20 text-sm text-cyan-50 outline-none mb-2" />
            <div className="flex flex-wrap gap-1 mb-2">
              {(Object.keys(HABITAT_PRESETS) as HabitatType[]).map((t) => (
                <Btn key={t} active={h.type === t} onClick={() => applyPreset(t)} className="text-[9px] px-1.5">{HABITAT_PRESETS[t].name.replace('The ', '')}</Btn>
              ))}
            </div>
            {HABITAT_SLIDERS.map((s) => (
              <Slider key={s.k} label={s.label} hint={s.hint} value={h[s.k] as number} max={sliderMax(s.k)} onChange={(v) => setParam(s.k, v)} />
            ))}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="text-[10px] uppercase text-cyan-100/50">Tint
                <input type="color" className="block w-full h-6 bg-transparent" value={rgbToHex(h.color2)} onChange={(e) => { h.color2 = hexToRgb(e.target.value); refresh(); }} />
              </label>
              <label className="text-[10px] uppercase text-cyan-100/50">Depth
                <input type="color" className="block w-full h-6 bg-transparent" value={rgbToHex(h.color)} onChange={(e) => { h.color = hexToRgb(e.target.value); refresh(); }} />
              </label>
            </div>
            <div className="mt-3 flex gap-1">
              <Btn tone="lime" onClick={savePreset}>Save as preset</Btn>
            </div>
            {presets.length > 0 && (
              <div className="mt-2 space-y-1">
                <div className="text-[9px] uppercase tracking-[0.25em] text-cyan-300/60">Custom presets</div>
                {presets.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-[11px] text-cyan-100/80">
                    <button className="hover:text-cyan-50 truncate" onClick={() => { world.zones[zone] = cloneHabitat(p.params as HabitatParams); world.events.push({ t: world.time, kind: 'habitat', text: `Zone ${zone + 1} → preset ${p.name}` }); refresh(); }}>↳ {p.name}</button>
                    <button className="text-rose-300/60 hover:text-rose-300" onClick={async () => { await dbDel('presets', p.id); setPresets(await dbAll('presets')); }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        {tab === 'evolution' && (
          <>
            <Slider label="Mutation rate" value={g.mutationRate} max={0.3} step={0.005} onChange={(v) => { g.mutationRate = v; refresh(); }} fmt={(v) => v.toFixed(3)} hint="Per-gene mutation probability per birth" />
            <Slider label="Mutation strength" value={g.mutationStrength} max={0.3} step={0.005} onChange={(v) => { g.mutationStrength = v; refresh(); }} fmt={(v) => v.toFixed(3)} />
            <Slider label="Speciation threshold" value={g.speciationThreshold} min={0.04} max={0.3} step={0.005} onChange={(v) => { g.speciationThreshold = v; refresh(); }} fmt={(v) => v.toFixed(3)} hint="Genetic distance at which a lineage is classified as a new species" />
            <Slider label="Carrying cap" value={g.maxPop} min={30} max={800} step={10} onChange={(v) => { g.maxPop = v; refresh(); }} fmt={(v) => v.toFixed(0)} hint="Hard population limit (performance control)" />
            <Slider label="Global nutrients" value={g.resourceMul} max={3} onChange={(v) => { g.resourceMul = v; refresh(); }} fmt={(v) => '×' + v.toFixed(2)} />
            <Slider label="Temperature shift" value={g.tempOffset} min={-0.4} max={0.4} onChange={(v) => { g.tempOffset = v; refresh(); }} />
            <Slider label="Light shift" value={g.lightOffset} min={-0.5} max={0.5} onChange={(v) => { g.lightOffset = v; refresh(); }} />
            <Slider label="Static storm" value={g.instabilityAdd} max={1} onChange={(v) => { g.instabilityAdd = v; refresh(); }} />
            <Slider label="Sync coupling" value={g.syncStrength} max={3} onChange={(v) => { g.syncStrength = v; refresh(); }} fmt={(v) => '×' + v.toFixed(2)} hint="Strength of pulse-coupled rhythmic entrainment" />
            <Slider label="Call density" value={g.callDensity} max={2.5} onChange={(v) => { g.callDensity = v; refresh(); }} fmt={(v) => '×' + v.toFixed(2)} />
            <div className="mt-2 text-[10px] leading-relaxed text-cyan-100/40">
              Selection emerges from habitat physics: acoustic windows decide whose mating calls are heard, pressure taxes speed, darkness rewards bioluminescence, static punishes pure tones.
            </div>
          </>
        )}
        {tab === 'audio' && (
          <>
            <Slider label="Master gain" value={audio.volume} onChange={(v) => { audio.setVolume(v); refresh(); }} />
            <Slider label="Reverb bus" value={audio.reverb} onChange={(v) => { audio.setReverb(v); refresh(); }} />
            <Slider label="Delay bus" value={audio.delayAmt} onChange={(v) => { audio.setDelay(v); refresh(); }} />
            <Slider label="Drone layer" value={audio.droneLevel} max={1.5} onChange={(v) => { audio.droneLevel = v; refresh(); }} />
            <Slider label="Voice polyphony" value={audio.maxVoices} min={4} max={64} step={1} onChange={(v) => { audio.maxVoices = v; refresh(); }} fmt={(v) => v.toFixed(0)} />
            <Slider label="Tempo" value={g.tempo} min={40} max={180} step={1} onChange={(v) => { g.tempo = v; audio.setTempo(v); refresh(); }} fmt={(v) => v.toFixed(0) + ' bpm'} hint="Drives every organism's internal rhythm oscillator" />
            <div className="mt-2 text-[10px] uppercase tracking-wider text-cyan-100/60">Harmonic field</div>
            <div className="flex flex-wrap gap-1 mt-1">
              {(['pentatonic', 'just', 'whole', 'chromatic', 'free'] as ScaleName[]).map((s) => (
                <Btn key={s} active={audio.scale === s} onClick={() => { audio.scale = s; refresh(); }} className="text-[9px]">{s}</Btn>
              ))}
            </div>
            <div className="mt-2 flex gap-1">
              <Btn active={audio.quantize} onClick={() => { audio.quantize = !audio.quantize; refresh(); }}>Quantize to tempo</Btn>
            </div>
            <div className="mt-2 text-[10px] leading-relaxed text-cyan-100/40">
              Spatial audio follows the viewport: zoom in to listen closely, pan to move through the stereo field.
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}

function rgbToHex(c: [number, number, number]) {
  return '#' + c.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('');
}
function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
