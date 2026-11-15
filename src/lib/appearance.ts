/**
 * Aparência compartilhada com o Órbita: cor, roda de intensidade (0–11) e estilo dos
 * ícones. Fica no aparelho (localStorage) e, logado, em users/{uid}/aparencia/compartilhada;
 * quem mudou por último (Financy ou Órbita) vale para os dois apps.
 *
 * A cor troca a escala "emerald" do Tailwind (usada no app todo) por uma gerada dela; a
 * intensidade controla o brilho de fundo; o estilo dos ícones vale para os quadradinhos
 * marcados com a classe .icon-tile (ver index.css).
 */
import { doc, onSnapshot, setDoc, type Unsubscribe } from 'firebase/firestore';
import { useSyncExternalStore } from 'react';
import { db } from './firebase';

export type IconStyle = 'suave' | 'solido' | 'contorno' | 'simples';
export type IconTone = 'colorido' | 'destaque' | 'neutro';

export interface Look {
  cor: string;
  intensidade: number;
  estiloIcones: IconStyle;
  tomIcones: IconTone;
  /** cores adicionadas por você */
  cores: string[];
  /** seguir o que vier do Órbita */
  sincronizar: boolean;
  atualizadoEm: string;
}

export const DEFAULT_COLOR = '#10B981';
/** as mesmas cores prontas do Órbita, mais o verde do Financy */
export const PRESETS: Array<{ nome: string; cor: string }> = [
  { nome: 'Verde', cor: '#10B981' },
  { nome: 'Carmim', cor: '#F2415A' },
  { nome: 'Âmbar', cor: '#F5A524' },
  { nome: 'Azul', cor: '#4C8DFF' },
  { nome: 'Menta', cor: '#3DD6B0' },
  { nome: 'Lima', cor: '#A3E635' },
];
export const ICON_STYLES: Record<IconStyle, string> = { suave: 'Suave', solido: 'Sólido', contorno: 'Contorno', simples: 'Só ícone' };
export const ICON_TONES: Record<IconTone, string> = { colorido: 'Coloridos', destaque: 'Destaque', neutro: 'Neutros' };

const KEY = 'financy.aparencia';
const DEFAULT: Look = {
  cor: DEFAULT_COLOR,
  intensidade: 4,
  estiloIcones: 'suave',
  tomIcones: 'colorido',
  cores: [],
  sincronizar: true,
  atualizadoEm: new Date(0).toISOString(),
};

let look: Look = (() => {
  try {
    return { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return DEFAULT;
  }
})();
const listeners = new Set<() => void>();
let uidForSync: string | null = null;

/* ---------- cor ---------- */
const rgb = (h: string) => {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export const mix = (a: string, b: string, t: number) =>
  '#' +
  rgb(a)
    .map((v, i) => Math.round(v + (rgb(b)[i] - v) * t).toString(16).padStart(2, '0'))
    .join('');
export function readableOn(hex: string) {
  const [r, g, b] = rgb(hex).map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#08090B' : '#FFFFFF';
}

const SHADES: Array<[number, number, string]> = [
  [50, 0.92, '#ffffff'], [100, 0.84, '#ffffff'], [200, 0.68, '#ffffff'], [300, 0.5, '#ffffff'], [400, 0.25, '#ffffff'],
  [500, 0, '#ffffff'], [600, 0.15, '#000000'], [700, 0.3, '#000000'], [800, 0.45, '#000000'], [900, 0.58, '#000000'], [950, 0.72, '#000000'],
];

function paint(l: Look) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const st = root.style;
  const isDefault = l.cor.toLowerCase() === DEFAULT_COLOR.toLowerCase();
  for (const [shade, t, to] of SHADES) {
    if (isDefault) {
      st.removeProperty(`--color-emerald-${shade}`);
      st.removeProperty(`--color-teal-${shade}`);
    } else {
      const c = mix(l.cor, to, t);
      st.setProperty(`--color-emerald-${shade}`, c);
      st.setProperty(`--color-teal-${shade}`, mix(c, '#14b8a6', 0.25));
    }
  }
  const k = Math.max(0, Math.min(11, l.intensidade)) / 11;
  st.setProperty('--look-rgb', rgb(l.cor).join(' '));
  st.setProperty('--look-k', String(0.25 + 1.35 * k));
  st.setProperty('--look-wash', String(0.22 * k * k));
  root.dataset.iconStyle = l.estiloIcones;
  root.dataset.iconTone = l.tomIcones;
}

function commit(next: Look, fromRemote = false) {
  look = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(look));
  } catch {
    /* sem storage */
  }
  paint(look);
  listeners.forEach((f) => f());
  if (!fromRemote && uidForSync) {
    const { sincronizar: _s, ...shared } = look;
    setDoc(doc(db, 'users', uidForSync, 'aparencia', 'compartilhada'), { ...shared, origem: 'financy' }, { merge: true }).catch((err) =>
      console.error('Erro ao salvar a aparência:', err),
    );
  }
}

/** Aplica o que está salvo no aparelho (chamar antes do primeiro render). */
export function initAppearance() {
  paint(look);
}

export function updateLook(patch: Partial<Omit<Look, 'atualizadoEm'>>) {
  commit({ ...look, ...patch, atualizadoEm: new Date().toISOString() });
}

export function addColor(hex: string) {
  const h = hex.toUpperCase();
  updateLook({ cores: [...look.cores.filter((c) => c !== h), h].slice(-12), cor: h });
}
export function removeColor(hex: string) {
  updateLook({ cores: look.cores.filter((c) => c !== hex), cor: look.cor === hex ? DEFAULT_COLOR : look.cor });
}

export function useLook(): Look {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f);
      return () => listeners.delete(f);
    },
    () => look,
  );
}

/** Logado: segue a aparência compartilhada e grava as mudanças feitas aqui. */
export function subscribeSharedLook(uid: string): Unsubscribe {
  uidForSync = uid;
  const unsub = onSnapshot(
    doc(db, 'users', uid, 'aparencia', 'compartilhada'),
    (snap) => {
      if (!snap.exists()) return;
      const r = snap.data() as Partial<Look> & { origem?: string };
      if (r.origem === 'financy' || !look.sincronizar) return;
      if (!r.atualizadoEm || r.atualizadoEm <= look.atualizadoEm) return;
      commit(
        {
          ...look,
          cor: typeof r.cor === 'string' && /^#[0-9a-f]{6}$/i.test(r.cor) ? r.cor.toUpperCase() : look.cor,
          intensidade: typeof r.intensidade === 'number' ? r.intensidade : Number(r.intensidade ?? look.intensidade),
          estiloIcones: (r.estiloIcones as IconStyle) ?? look.estiloIcones,
          tomIcones: (r.tomIcones as IconTone) ?? look.tomIcones,
          cores: Array.isArray(r.cores) ? [...new Set([...look.cores, ...r.cores])].slice(-12) : look.cores,
          atualizadoEm: r.atualizadoEm,
        },
        true,
      );
    },
    () => {
      /* sem permissão/doc: fica o que está no aparelho */
    },
  );
  return () => {
    uidForSync = null;
    unsub();
  };
}
