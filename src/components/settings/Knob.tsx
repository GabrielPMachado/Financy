/**
 * Roda de intensidade (0–11), o mesmo desenho do Órbita: marcações em volta, estrela no
 * fim, anel e ponto na cor escolhida e o cartão esquentando conforme sobe. No 11 tudo acende.
 * Gire arrastando ou toque numa marcação; setas do teclado também funcionam.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { mix } from '../../lib/appearance';

export const KNOB_MAX = 11;
const STEP = 22;
const angleOf = (v: number) => (v - 5) * STEP;
const BASE = '#2D2A2B';

function polar(cx: number, cy: number, r: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}
function starPath(cx: number, cy: number, R: number) {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const p = polar(cx, cy, i % 2 ? R * 0.45 : R, i * 36);
    d += `${i ? 'L' : 'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`;
  }
  return d + 'Z';
}

/** dois chevrons ( >> ) apontando para fora, perto da borda */
function chevrons(R: number) {
  const w = R * 0.13; // meia largura
  const h = R * 0.085; // altura de cada chevron
  const c = (tipY: number) => `M${R - w},${tipY + h} L${R},${tipY} L${R + w},${tipY + h}`;
  return `${c(R - R * 0.76)} ${c(R - R * 0.6)}`;
}

function vibrate(ms: number) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* sem vibração */
  }
}

export default function Knob({ value, onChange, color, size = 230 }: { value: number; onChange: (v: number) => void; color: string; size?: number }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const v = Math.max(0, Math.min(KNOB_MAX, Math.round(value)));
  const k = v / KNOB_MAX;
  const max = v === KNOB_MAX;
  const W = size;
  const H = size * 0.95;
  const cx = W / 2;
  const cy = H * 0.47;
  const R = size * 0.235;
  const tickIn = R + size * 0.075;
  const tickOut = R + size * 0.125;
  const bg = mix(BASE, mix(color, '#140C0D', 0.58), Math.min(1, k * 1.05));
  const ring = max ? color : mix('#4A3436', color, 0.35 + 0.6 * k);

  // rotação suave do corpo
  const [rot, setRot] = useState(angleOf(v));
  useEffect(() => setRot(angleOf(v)), [v]);

  const ref = useRef<HTMLDivElement>(null);
  const last = useRef(v);
  last.current = v;
  const pick = (clientX: number, clientY: number) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    const x = ((clientX - box.left) / box.width) * W;
    const y = ((clientY - box.top) / box.height) * H;
    const deg = (Math.atan2(x - cx, -(y - cy)) * 180) / Math.PI;
    if (Math.abs(deg) > 160) return; // zona morta embaixo
    const next = Math.max(0, Math.min(KNOB_MAX, Math.round(deg / STEP + 5)));
    if (next !== last.current) {
      last.current = next;
      vibrate(next === KNOB_MAX ? 25 : 6);
      onChange(next);
    }
  };

  const knurl = useMemo(
    () =>
      Array.from({ length: 72 }, (_, i) => {
        const a = polar(R, R, R * 0.97, i * 5);
        const b = polar(R, R, R * 0.86, i * 5);
        return { x1: a.x, y1: a.y, x2: b.x, y2: b.y, i };
      }),
    [R],
  );
  const star = polar(cx, cy, (tickIn + tickOut) / 2, angleOf(KNOB_MAX));

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label="Intensidade da cor"
      aria-valuemin={0}
      aria-valuemax={KNOB_MAX}
      aria-valuenow={v}
      onPointerDown={(e) => {
        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
        pick(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => e.buttons && pick(e.clientX, e.clientY)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onChange(Math.min(KNOB_MAX, v + 1));
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onChange(Math.max(0, v - 1));
      }}
      className="relative select-none touch-none outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      style={{ width: W, height: H, borderRadius: size * 0.09, background: bg, overflow: 'hidden', transition: 'background-color 0.25s' }}
    >
      <svg width={W} height={H} className="absolute inset-0">
        <defs>
          <linearGradient id={`hot${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={mix(mix(color, '#B07A4E', 0.45), '#1A1012', 0.35)} />
            <stop offset="1" stopColor={mix(color, '#1A0A0C', 0.3)} />
          </linearGradient>
          <radialGradient id={`glow${id}`} cx="50%" cy="50%" r="50%">
            <stop offset="0.6" stopColor={color} stopOpacity={max ? 0.55 : 0.18 * k} />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </radialGradient>
        </defs>
        {max && <rect x="0" y="0" width={W} height={H} fill={`url(#hot${id})`} />}
        {Array.from({ length: KNOB_MAX }, (_, i) => {
          const deg = angleOf(i);
          const a = polar(cx, cy, tickIn, deg);
          const b = polar(cx, cy, i === 5 ? tickOut + size * 0.02 : tickOut, deg);
          const lit = (i <= v && v > 0) || i === 0;
          const zeroOnly = v === 0 && i === 0;
          return (
            <g key={i}>
              {max && <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={size * 0.034} strokeLinecap="round" />}
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={zeroOnly ? mix('#FFFFFF', color, 0.45) : '#FFFFFF'}
                strokeOpacity={lit ? (zeroOnly ? 0.85 : 0.95) : 0.22}
                strokeWidth={size * (max ? 0.016 : 0.012)}
                strokeLinecap="round"
              />
            </g>
          );
        })}
        {max && <circle cx={star.x} cy={star.y} r={size * 0.045} fill={color} />}
        <path d={starPath(star.x, star.y, size * 0.032)} fill="#FFFFFF" fillOpacity={max ? 1 : 0.25} />
        <circle cx={cx} cy={cy} r={R + size * 0.05} fill={`url(#glow${id})`} />
        <circle cx={cx} cy={cy} r={R + size * 0.022} fill="none" stroke={ring} strokeWidth={size * 0.016} />
        <circle cx={cx} cy={cy} r={R + size * 0.008} fill="#151516" />
      </svg>

      <svg
        width={R * 2}
        height={R * 2}
        className="absolute pointer-events-none"
        style={{ left: cx - R, top: cy - R, transform: `rotate(${rot}deg)`, transition: 'transform 0.35s cubic-bezier(.3,1.4,.5,1)' }}
      >
        <defs>
          <radialGradient id={`body${id}`} cx="35%" cy="30%" r="80%">
            <stop offset="0" stopColor="#5C5C5E" />
            <stop offset="0.55" stopColor="#333335" />
            <stop offset="1" stopColor="#1B1B1C" />
          </radialGradient>
        </defs>
        <circle cx={R} cy={R} r={R} fill={`url(#body${id})`} />
        {knurl.map((l) => (
          <line key={l.i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={l.i % 2 ? '#0E0E0F' : '#6A6A6C'} strokeOpacity={0.55} strokeWidth={1} />
        ))}
        <circle cx={R} cy={R} r={R * 0.84} fill={`url(#body${id})`} />
        <circle cx={R} cy={R} r={R * 0.84} fill="none" stroke="#000" strokeOpacity={0.35} strokeWidth={1} />
        {/* indicador >> na cor escolhida */}
            <path d={chevrons(R)} fill="none" stroke={color} strokeOpacity={0.3} strokeWidth={R * 0.11} strokeLinecap="round" strokeLinejoin="round" />
            <path d={chevrons(R)} fill="none" stroke={color} strokeWidth={R * 0.055} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
