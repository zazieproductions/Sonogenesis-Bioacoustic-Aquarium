import { useEffect, useRef, useState } from 'react';
import { GENES, GROUPS } from '../sim/genome';
import { renderThumb } from '../sim/morph';

const GROUP_COLORS: Record<string, string> = {
  Morphology: '#7fd8ff',
  Pigment: '#ff8fd8',
  Behavior: '#a0ffc8',
  Metabolism: '#ffe27a',
  Voice: '#c78bff',
};

/** Visual genome: each gene is a vertical bar. Drag on bars to edit (when onChange is supplied). */
export function GenomeEditor({ genome, onChange, height = 54, compare }: { genome: number[]; onChange?: (g: number[]) => void; height?: number; compare?: number[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const dragging = useRef(false);
  const ref = useRef<HTMLDivElement>(null);

  const setFromEvent = (e: React.PointerEvent) => {
    if (!onChange || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const idx = Math.max(0, Math.min(GENES.length - 1, Math.floor(((e.clientX - rect.left) / rect.width) * GENES.length)));
    const v = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
    const g = genome.slice();
    g[idx] = v;
    onChange(g);
  };

  return (
    <div>
      <div
        ref={ref}
        className={`relative flex items-end gap-[1px] rounded border border-cyan-300/10 bg-black/30 p-[2px] ${onChange ? 'cursor-crosshair' : ''}`}
        style={{ height }}
        onPointerDown={(e) => { dragging.current = true; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); setFromEvent(e); }}
        onPointerMove={(e) => {
          if (ref.current) {
            const rect = ref.current.getBoundingClientRect();
            setHover(Math.max(0, Math.min(GENES.length - 1, Math.floor(((e.clientX - rect.left) / rect.width) * GENES.length))));
          }
          if (dragging.current) setFromEvent(e);
        }}
        onPointerUp={() => (dragging.current = false)}
        onPointerLeave={() => { setHover(null); }}
      >
        {GENES.map((gd, i) => (
          <div key={gd.k} className="relative flex-1 h-full flex items-end">
            {compare && (
              <div className="absolute bottom-0 left-0 right-0 border-t border-white/40" style={{ bottom: `${compare[i] * 100}%` }} />
            )}
            <div
              className="w-full rounded-t-[1px]"
              style={{ height: `${Math.max(2, genome[i] * 100)}%`, background: GROUP_COLORS[gd.g], opacity: hover === i ? 1 : 0.55, boxShadow: hover === i ? `0 0 8px ${GROUP_COLORS[gd.g]}` : undefined }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex h-4 items-center justify-between text-[9px] uppercase tracking-wider text-cyan-100/50">
        {hover !== null ? (
          <span>
            <span style={{ color: GROUP_COLORS[GENES[hover].g] }}>{GENES[hover].g}</span> · {GENES[hover].label} · <span className="text-cyan-50">{genome[hover].toFixed(3)}</span>
          </span>
        ) : (
          <span className="flex gap-2">
            {GROUPS.map((g) => (
              <span key={g} style={{ color: GROUP_COLORS[g] }}>■ {g}</span>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}

export function SpecimenThumb({ genome, size = 96, animate = true, pulse = 0 }: { genome: number[]; size?: number; animate?: boolean; pulse?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const pulseRef = useRef(pulse);
  pulseRef.current = pulse;
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    let raf = 0;
    const start = performance.now();
    const draw = () => {
      renderThumb(c, genome, (performance.now() - start) / 1000, pulseRef.current);
      if (animate) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [genome, animate]);
  return <canvas ref={ref} width={size * 2} height={size * 2} style={{ width: size, height: size }} />;
}
