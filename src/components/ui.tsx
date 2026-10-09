import React, { useEffect, useRef } from 'react';
import { cn } from '../utils/cn';

export function Panel({ title, children, className, right, onClose }: { title?: React.ReactNode; children: React.ReactNode; className?: string; right?: React.ReactNode; onClose?: () => void }) {
  return (
    <div className={cn('pointer-events-auto rounded-md border border-cyan-300/15 bg-[#050a12]/80 shadow-[0_0_40px_rgba(0,180,255,0.06)] backdrop-blur-md', className)}>
      {title !== undefined && (
        <div className="flex items-center justify-between gap-2 border-b border-cyan-300/10 px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-cyan-200/80">{title}</div>
          <div className="flex items-center gap-2">
            {right}
            {onClose && (
              <button onClick={onClose} className="text-cyan-200/50 hover:text-cyan-100 text-xs px-1">✕</button>
            )}
          </div>
        </div>
      )}
      {children}
    </div>
  );
}

export function Btn({ children, onClick, active, className, title, disabled, tone = 'cyan' }: { children: React.ReactNode; onClick?: () => void; active?: boolean; className?: string; title?: string; disabled?: boolean; tone?: 'cyan' | 'rose' | 'amber' | 'lime' }) {
  const tones = {
    cyan: active ? 'border-cyan-300/70 bg-cyan-300/15 text-cyan-50 shadow-[0_0_12px_rgba(80,220,255,0.35)]' : 'border-cyan-300/15 text-cyan-100/70 hover:border-cyan-300/40 hover:text-cyan-50',
    rose: active ? 'border-rose-400/80 bg-rose-500/20 text-rose-50 shadow-[0_0_14px_rgba(255,60,100,0.5)]' : 'border-rose-300/20 text-rose-200/80 hover:border-rose-300/50',
    amber: active ? 'border-amber-300/70 bg-amber-300/15 text-amber-50' : 'border-amber-300/20 text-amber-100/80 hover:border-amber-300/50',
    lime: active ? 'border-lime-300/70 bg-lime-300/15 text-lime-50' : 'border-lime-300/20 text-lime-100/80 hover:border-lime-300/50',
  };
  return (
    <button
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn('rounded border px-2 py-1 text-[11px] uppercase tracking-wider transition-all disabled:opacity-30', tones[tone], className)}
    >
      {children}
    </button>
  );
}

export function Slider({ label, value, min = 0, max = 1, step = 0.01, onChange, hint, fmt }: { label: string; value: number; min?: number; max?: number; step?: number; onChange: (v: number) => void; hint?: string; fmt?: (v: number) => string }) {
  return (
    <label className="block py-1" title={hint}>
      <div className="flex justify-between text-[10px] uppercase tracking-wider text-cyan-100/60">
        <span>{label}</span>
        <span className="text-cyan-100/90 tabular-nums">{fmt ? fmt(value) : value.toFixed(2)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="sg-range w-full" />
    </label>
  );
}

export function Stat({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] uppercase tracking-[0.2em] text-cyan-100/40">{label}</span>
      <span className="text-sm tabular-nums" style={{ color: color ?? '#d8f6ff' }}>{value}</span>
    </div>
  );
}

/** Generic canvas-based line chart */
export function LineChart({ series, height = 70, className, max }: { series: { data: number[]; color: string; fill?: boolean }[]; height?: number; className?: string; max?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const w = (c.width = c.clientWidth * 2);
    const h = (c.height = height * 2);
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, w, h);
    g.strokeStyle = 'rgba(120,200,255,0.07)';
    for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(0, (h * i) / 4); g.lineTo(w, (h * i) / 4); g.stroke(); }
    const m = max ?? Math.max(1e-6, ...series.flatMap((s) => s.data));
    for (const s of series) {
      if (s.data.length < 2) continue;
      g.beginPath();
      s.data.forEach((v, i) => {
        const x = (i / (s.data.length - 1)) * w;
        const y = h - (v / m) * (h - 6) - 3;
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      });
      g.strokeStyle = s.color;
      g.lineWidth = 2;
      g.stroke();
      if (s.fill) {
        g.lineTo(w, h); g.lineTo(0, h); g.closePath();
        g.globalAlpha = 0.12; g.fillStyle = s.color; g.fill(); g.globalAlpha = 1;
      }
    }
  });
  return <canvas ref={ref} className={cn('w-full', className)} style={{ height }} />;
}

export function Bars({ data, color = '#7fd8ff', height = 50, labels }: { data: number[]; color?: string; height?: number; labels?: [string, string] }) {
  const m = Math.max(1, ...data);
  return (
    <div>
      <div className="flex items-end gap-[2px]" style={{ height }}>
        {data.map((v, i) => (
          <div key={i} className="flex-1 rounded-t-sm" style={{ height: `${(v / m) * 100}%`, background: color, opacity: 0.35 + 0.65 * (v / m), minHeight: 1 }} />
        ))}
      </div>
      {labels && (
        <div className="mt-1 flex justify-between text-[9px] uppercase tracking-wider text-cyan-100/40"><span>{labels[0]}</span><span>{labels[1]}</span></div>
      )}
    </div>
  );
}
