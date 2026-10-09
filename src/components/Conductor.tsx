import { useEffect, useRef, useState } from 'react';
import type { Lane } from '../conductor';
import { sampleLane } from '../conductor';
import { Panel, Btn } from './ui';

interface Props {
  lanes: Lane[];
  playing: boolean;
  length: number;
  loop: boolean;
  getPos: () => number;
  onPlay: () => void;
  onSeek: (t: number) => void;
  setLength: (s: number) => void;
  setLoop: (b: boolean) => void;
  onClose: () => void;
}

export function Conductor(p: Props) {
  const [, force] = useState(0);
  return (
    <Panel
      title="Conductor · ecological automation"
      onClose={p.onClose}
      className="w-full"
      right={
        <div className="flex items-center gap-2">
          <Btn active={p.playing} tone="amber" onClick={p.onPlay}>{p.playing ? '■ Stop' : '▶ Conduct'}</Btn>
          <Btn active={p.loop} onClick={() => p.setLoop(!p.loop)}>Loop</Btn>
          <select value={p.length} onChange={(e) => p.setLength(parseInt(e.target.value))} className="bg-black/40 border border-cyan-300/15 rounded text-[10px] text-cyan-100">
            {[60, 120, 180, 300, 600].map((s) => <option key={s} value={s}>{s}s</option>)}
          </select>
        </div>
      }
    >
      <div className="px-3 pb-2 pt-1 max-h-[34vh] overflow-y-auto sg-scroll">
        <div className="text-[9px] text-cyan-100/35 mb-1">Click to add breakpoints · drag to move · double-click to delete · toggle lanes to hand control to the timeline. Music emerges from the ecology you shape.</div>
        {p.lanes.map((l) => (
          <div key={l.key} className="flex items-center gap-2 py-[2px]">
            <button
              onClick={() => { l.enabled = !l.enabled; force((x) => x + 1); }}
              className="w-32 shrink-0 text-left text-[10px] uppercase tracking-wider"
              style={{ color: l.enabled ? l.color : 'rgba(200,230,255,0.3)' }}
            >
              {l.enabled ? '●' : '○'} {l.label}
            </button>
            <LaneCanvas lane={l} getPos={p.getPos} onSeek={p.onSeek} onChange={() => force((x) => x + 1)} />
            <span className="w-16 shrink-0 text-right text-[10px] tabular-nums" style={{ color: l.enabled ? l.color : 'rgba(200,230,255,0.3)' }}>
              {l.describe(sampleLane(l, p.getPos()))}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function LaneCanvas({ lane, getPos, onSeek, onChange }: { lane: Lane; getPos: () => number; onSeek: (t: number) => void; onChange: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drag = useRef<number>(-1);
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const c = ref.current;
      if (c) {
        const w = c.clientWidth * 2, h = c.clientHeight * 2;
        if (c.width !== w) c.width = w;
        if (c.height !== h) c.height = h;
        const g = c.getContext('2d')!;
        g.clearRect(0, 0, w, h);
        g.fillStyle = 'rgba(255,255,255,0.025)';
        g.fillRect(0, 0, w, h);
        for (let i = 1; i < 8; i++) { g.fillStyle = 'rgba(255,255,255,0.04)'; g.fillRect((w * i) / 8, 0, 1, h); }
        g.globalAlpha = lane.enabled ? 1 : 0.3;
        g.beginPath();
        for (let x = 0; x <= w; x += 4) {
          const v = sampleLane(lane, x / w);
          const y = h - v * (h - 6) - 3;
          if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.strokeStyle = lane.color;
        g.lineWidth = 2;
        g.stroke();
        g.lineTo(w, h); g.lineTo(0, h); g.closePath();
        g.globalAlpha *= 0.1; g.fillStyle = lane.color; g.fill();
        g.globalAlpha = lane.enabled ? 1 : 0.3;
        for (const pt of lane.points) {
          g.beginPath();
          g.arc(pt.t * w, h - pt.v * (h - 6) - 3, 5, 0, Math.PI * 2);
          g.fillStyle = '#05080e';
          g.fill();
          g.stroke();
        }
        g.globalAlpha = 1;
        const px = getPos() * w;
        g.fillStyle = 'rgba(255,255,255,0.8)';
        g.fillRect(px - 1, 0, 2, h);
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [lane, getPos]);

  const toLocal = (e: React.PointerEvent | React.MouseEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { t: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), v: Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height)), r };
  };
  const hit = (t: number, v: number, r: DOMRect) =>
    lane.points.findIndex((p) => Math.abs((p.t - t) * r.width) < 7 && Math.abs((p.v - v) * r.height) < 7);

  return (
    <canvas
      ref={ref}
      className="h-7 flex-1 cursor-crosshair rounded"
      onPointerDown={(e) => {
        const { t, v, r } = toLocal(e);
        if (e.altKey) { onSeek(t); return; }
        let i = hit(t, v, r);
        if (i < 0) {
          lane.points.push({ t, v });
          lane.points.sort((a, b) => a.t - b.t);
          i = lane.points.findIndex((p) => p.t === t && p.v === v);
        }
        drag.current = i;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        onChange();
      }}
      onPointerMove={(e) => {
        if (drag.current < 0) return;
        const { t, v } = toLocal(e);
        const pt = lane.points[drag.current];
        if (!pt) return;
        pt.t = t; pt.v = v;
        lane.points.sort((a, b) => a.t - b.t);
        drag.current = lane.points.indexOf(pt);
      }}
      onPointerUp={() => { drag.current = -1; onChange(); }}
      onDoubleClick={(e) => {
        const { t, v, r } = toLocal(e);
        const i = hit(t, v, r);
        if (i >= 0 && lane.points.length > 1) { lane.points.splice(i, 1); onChange(); }
      }}
    />
  );
}
