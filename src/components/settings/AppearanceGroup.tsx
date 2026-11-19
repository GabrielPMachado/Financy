/**
 * Aparência (igual à do Órbita): cores prontas + suas, roda de intensidade num modal
 * ao tocar numa cor, e estilo/cor dos ícones. Com "Mesma aparência do Órbita" ligado,
 * o que mudar aqui vale lá também (e vice-versa).
 */
import { Check, Plus, Wallet, Dumbbell, Bell, Zap, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  addColor,
  ICON_STYLES,
  ICON_TONES,
  PRESETS,
  readableOn,
  removeColor,
  updateLook,
  useLook,
  type IconStyle,
  type IconTone,
} from '../../lib/appearance';
import Knob from './Knob';
import { appIconsAvailable, ICON_COLORS, ICON_LOOKS, iconThumb, nearestIconColor } from '../../lib/appIcon';

const MORE = [
  '#FF3B30', '#FF6B6B', '#F97316', '#FB923C', '#F5A524', '#FACC15',
  '#A3E635', '#22C55E', '#10B981', '#2DD4BF', '#22D3EE', '#38BDF8',
  '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#D946EF', '#EC4899',
  '#F43F5E', '#B45309', '#78716C', '#94A3B8', '#E5E7EB', '#C9A227',
];

function Swatch({ color, active, onClick, onRemove, label }: { color: string; active: boolean; onClick: () => void; onRemove?: () => void; label: string }) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      onPointerDown={() => onRemove && (timer = setTimeout(onRemove, 650))}
      onPointerUp={() => clearTimeout(timer)}
      onPointerLeave={() => clearTimeout(timer)}
      className="shrink-0 w-[50px] h-[50px] rounded-full flex items-center justify-center transition active:scale-90"
      style={{ border: `2.5px solid ${active ? color : 'transparent'}` }}
    >
      <span className="w-[38px] h-[38px] rounded-full flex items-center justify-center" style={{ background: color }}>
        {active && <Check className="w-4 h-4" strokeWidth={3} style={{ color: readableOn(color) }} />}
      </span>
    </button>
  );
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: Record<T, string>; onChange: (v: T) => void }) {
  return (
    <div className="flex p-1 rounded-full bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
      {(Object.keys(options) as T[]).map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onChange(k)}
          className={`flex-1 h-9 rounded-full text-xs font-semibold transition ${
            value === k ? 'glass-strong text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {options[k]}
        </button>
      ))}
    </div>
  );
}

function Overlay({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button type="button" aria-label="Fechar" onClick={onClose} className="absolute inset-0 bg-black/55" />
          <motion.div
            className="relative flex flex-col items-center gap-3"
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 260 }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function AppearanceGroup({ Group }: { Group: (p: { label: string; children: ReactNode }) => ReactNode }) {
  const look = useLook();
  const [knob, setKnob] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('#4C8DFF');
  const [hex, setHex] = useState('');
  const valid = /^#[0-9A-F]{6}$/i.test(draft);
  const all = [...PRESETS.map((p) => ({ label: p.nome, cor: p.cor })), ...look.cores.map((c) => ({ label: c, cor: c }))];
  const pick = (cor: string) => {
    updateLook({ cor });
    setKnob(true);
  };

  return (
    <>
      <Group label="Cor do app">
        <div className="px-4 py-3 space-y-2">
          <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
            {all.map((s) => (
              <Swatch
                key={s.cor}
                label={s.label}
                color={s.cor}
                active={look.cor.toLowerCase() === s.cor.toLowerCase()}
                onClick={() => pick(s.cor)}
                onRemove={look.cores.includes(s.cor) ? () => confirm(`Remover a cor ${s.cor}?`) && removeColor(s.cor) : undefined}
              />
            ))}
            <button
              type="button"
              aria-label="Adicionar cor"
              onClick={() => setAdding(true)}
              className="shrink-0 w-[50px] h-[50px] rounded-full flex items-center justify-center"
            >
              <span className="w-[38px] h-[38px] rounded-full flex items-center justify-center border border-dashed border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-900">
                <Plus className="w-4 h-4 text-slate-500" />
              </span>
            </button>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500">Toque numa cor para ajustar a intensidade na roda. Segure uma cor sua para remover.</p>
        </div>
      </Group>

      <Group label="Ícones">
        <div className="px-4 py-3 space-y-3">
          <div className="flex justify-around py-1">
            {[
              { I: Wallet, c: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
              { I: Dumbbell, c: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20' },
              { I: Bell, c: 'text-sky-600 dark:text-sky-400 bg-sky-500/10 border-sky-500/20' },
              { I: Zap, c: 'text-violet-600 dark:text-violet-400 bg-violet-500/10 border-violet-500/20' },
            ].map(({ I, c }, i) => (
              <div key={i} className={`icon-tile w-11 h-11 rounded-xl border flex items-center justify-center ${c}`}>
                <I className="w-5 h-5" />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(ICON_STYLES) as IconStyle[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => updateLook({ estiloIcones: k })}
                className={`px-3.5 h-9 rounded-full text-xs font-semibold border transition ${
                  look.estiloIcones === k
                    ? 'glass-strong text-slate-900 dark:text-white'
                    : 'border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400'
                }`}
              >
                {ICON_STYLES[k]}
              </button>
            ))}
          </div>
          <Segmented<IconTone> value={look.tomIcones} options={ICON_TONES} onChange={(tomIcones) => updateLook({ tomIcones })} />
        </div>
      </Group>

      {appIconsAvailable() && (
        <Group label="Ícone do app">
          <div className="px-4 py-3 space-y-3">
            <div className="flex justify-between">
              {ICON_LOOKS.map((l) => {
                const on = look.iconeApp === l.key;
                const color = look.iconeSegue ? nearestIconColor(look.cor) : look.corIcone;
                return (
                  <button key={l.key} type="button" aria-pressed={on} onClick={() => updateLook({ iconeApp: l.key })} className="flex flex-col items-center gap-1.5">
                    <span className="p-[3px] rounded-[20px]" style={{ border: `2.5px solid ${on ? look.cor : 'transparent'}` }}>
                      <img src={iconThumb(l.key, color)} alt="" className="w-[54px] h-[54px] rounded-[13px]" />
                    </span>
                    <span className={`text-[11px] font-semibold ${on ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>{l.label}</span>
                  </button>
                );
              })}
            </div>
            <div className={`flex flex-wrap gap-2.5 px-1 transition ${look.iconeSegue ? 'opacity-40 pointer-events-none' : ''}`}>
              {ICON_COLORS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  aria-label={`Cor do ícone ${c.key}`}
                  onClick={() => updateLook({ corIcone: c.key })}
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ border: `2.5px solid ${look.corIcone === c.key ? c.hex : 'transparent'}` }}
                >
                  <span className="w-7 h-7 rounded-full" style={{ background: c.hex }} />
                </button>
              ))}
            </div>
            <button type="button" role="switch" aria-checked={look.iconeSegue} onClick={() => updateLook({ iconeSegue: !look.iconeSegue })} className="w-full flex items-center justify-between gap-3 text-left">
              <span>
                <span className="block text-[15px]">Acompanhar a cor do app</span>
                <span className="block text-xs text-slate-400">O ícone muda junto quando a cor muda (aqui ou no Órbita)</span>
              </span>
              <span className={`shrink-0 w-10 h-6 rounded-full p-0.5 transition ${look.iconeSegue ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
                <span className={`block w-5 h-5 rounded-full bg-white transition ${look.iconeSegue ? 'translate-x-4' : ''}`} />
              </span>
            </button>
          </div>
        </Group>
      )}

      <Overlay open={knob} onClose={() => setKnob(false)}>
        <div className="flex flex-wrap justify-center gap-1 max-w-[340px] rounded-[32px] p-1.5 bg-[#111317]/95">
          {all.map((s) => (
            <Swatch key={s.cor} label={s.label} color={s.cor} active={look.cor.toLowerCase() === s.cor.toLowerCase()} onClick={() => updateLook({ cor: s.cor })} />
          ))}
        </div>
        <Knob value={look.intensidade} onChange={(intensidade) => updateLook({ intensidade })} color={look.cor} size={230} />
        <button type="button" onClick={() => setKnob(false)} className="px-6 py-2 rounded-full bg-white/10 text-white font-semibold">
          Pronto
        </button>
      </Overlay>

      <Overlay open={adding} onClose={() => setAdding(false)}>
        <div className="w-[340px] max-w-[92vw] rounded-3xl p-4 space-y-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">Nova cor</h3>
            <button type="button" aria-label="Fechar" onClick={() => setAdding(false)} className="w-8 h-8 rounded-full glass flex items-center justify-center">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-6 gap-2.5">
            {MORE.map((h) => (
              <button
                key={h}
                type="button"
                aria-label={`Cor ${h}`}
                onClick={() => {
                  setDraft(h);
                  setHex('');
                }}
                className="w-11 h-11 rounded-full"
                style={{ background: h, border: `3px solid ${draft === h ? 'white' : 'transparent'}` }}
              />
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-xl shrink-0" style={{ background: valid ? draft : '#21252c' }} />
            <input
              value={hex}
              onChange={(e) => {
                const v = ('#' + e.target.value.replace(/[^0-9a-f]/gi, '')).slice(0, 7).toUpperCase();
                setHex(v);
                if (v.length === 7) setDraft(v);
              }}
              placeholder={draft}
              maxLength={7}
              className="flex-1 rounded-xl px-3 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-base tracking-wider font-semibold uppercase"
            />
          </div>
          <button
            type="button"
            disabled={!valid}
            onClick={() => {
              addColor(draft);
              setAdding(false);
              setKnob(true);
            }}
            className="w-full py-3 rounded-xl font-semibold disabled:opacity-40"
            style={{ background: valid ? draft : undefined, color: valid ? readableOn(draft) : undefined }}
          >
            Usar esta cor
          </button>
        </div>
      </Overlay>
    </>
  );
}
