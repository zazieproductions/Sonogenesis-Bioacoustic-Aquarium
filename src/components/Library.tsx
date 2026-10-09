import { useState } from 'react';
import type { Specimen, SnapshotRec } from '../db';
import { Panel, Btn } from './ui';
import { SpecimenThumb } from './GenomeEditor';

interface Props {
  specimens: Specimen[];
  snapshots: SnapshotRec[];
  onRelease: (s: Specimen) => void;
  onReleaseLineage: (s: Specimen) => void;
  onToLab: (s: Specimen) => void;
  onDeleteSpec: (id: string) => void;
  onSaveSnapshot: (name: string) => void;
  onLoadSnapshot: (s: SnapshotRec) => void;
  onDeleteSnapshot: (id: string) => void;
  onImport: (file: File) => void;
  onClose: () => void;
}

function download(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function Library(p: Props) {
  const [tab, setTab] = useState<'specimens' | 'snapshots'>('specimens');
  const [name, setName] = useState('');
  return (
    <Panel
      title="Archive"
      onClose={p.onClose}
      className="w-[min(860px,calc(100vw-40px))] max-h-[calc(100vh-140px)] overflow-y-auto sg-scroll"
      right={
        <div className="flex gap-1">
          {(['specimens', 'snapshots'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded ${tab === t ? 'bg-cyan-300/15 text-cyan-50' : 'text-cyan-100/40'}`}>{t}</button>
          ))}
        </div>
      }
    >
      <div className="p-4 text-[11px]">
        {tab === 'specimens' && (
          <>
            {p.specimens.length === 0 && <div className="text-cyan-100/40">No specimens yet. Select an organism and press <b>Save</b> or <b>Save lineage</b>, or save from the Lab.</div>}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {p.specimens.map((s) => (
                <div key={s.id} className="rounded border border-cyan-300/10 bg-black/30 p-2 flex flex-col items-center">
                  <SpecimenThumb genome={s.genome} size={110} />
                  <div className="text-cyan-50 italic truncate max-w-full">{s.name}</div>
                  <div className="text-[9px] text-cyan-100/40 truncate max-w-full">{s.speciesName} · gen {s.generation}{s.lineage ? ` · ${s.lineage.length} ancestors` : ''}</div>
                  {s.lineage && s.lineage.length > 0 && (
                    <div className="flex gap-[2px] my-1">
                      {s.lineage.slice(0, 16).reverse().map((l) => (
                        <span key={l.id} className="h-1.5 w-1.5 rounded-full" style={{ background: `hsl(${l.genome[10] * 360},80%,60%)` }} />
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap justify-center gap-1 mt-1">
                    <Btn tone="amber" onClick={() => p.onRelease(s)} className="text-[9px]">Release</Btn>
                    {s.lineage && s.lineage.length > 0 && <Btn tone="amber" onClick={() => p.onReleaseLineage(s)} className="text-[9px]">Revive line</Btn>}
                    <Btn onClick={() => p.onToLab(s)} className="text-[9px]">Lab</Btn>
                    <Btn onClick={() => download(`${s.name}.specimen.json`, s)} className="text-[9px]">⇩</Btn>
                    <Btn tone="rose" onClick={() => p.onDeleteSpec(s.id)} className="text-[9px]">✕</Btn>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        {tab === 'snapshots' && (
          <>
            <div className="flex items-center gap-2 mb-3">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Snapshot name" className="bg-black/30 border border-cyan-300/15 rounded px-2 py-1 text-cyan-50 outline-none" />
              <Btn tone="lime" onClick={() => { p.onSaveSnapshot(name || `Ecosystem ${new Date().toLocaleTimeString()}`); setName(''); }}>Capture ecosystem</Btn>
              <label className="cursor-pointer rounded border border-cyan-300/15 px-2 py-1 text-[11px] uppercase tracking-wider text-cyan-100/70 hover:border-cyan-300/40">
                Import JSON
                <input type="file" accept=".json" className="hidden" onChange={(e) => e.target.files?.[0] && p.onImport(e.target.files[0])} />
              </label>
            </div>
            {p.snapshots.length === 0 && <div className="text-cyan-100/40">No snapshots. Snapshots persist the entire biosphere — organisms, species, lineages, habitats — in IndexedDB.</div>}
            <div className="space-y-1">
              {p.snapshots.sort((a, b) => b.saved - a.saved).map((s) => (
                <div key={s.id} className="flex items-center gap-3 rounded border border-cyan-300/10 bg-black/20 px-3 py-2">
                  <div className="flex-1">
                    <div className="text-cyan-50">{s.name}</div>
                    <div className="text-[9px] text-cyan-100/40">seed {s.seed} · t={s.time.toFixed(0)}s · {s.pop} organisms · {s.species} species · {new Date(s.saved).toLocaleString()}</div>
                  </div>
                  <Btn tone="amber" onClick={() => p.onLoadSnapshot(s)}>Load</Btn>
                  <Btn onClick={() => download(`${s.name}.ecosystem.json`, s)}>⇩</Btn>
                  <Btn tone="rose" onClick={() => p.onDeleteSnapshot(s.id)}>✕</Btn>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}
