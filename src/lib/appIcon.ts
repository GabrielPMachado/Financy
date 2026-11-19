/**
 * Ícone do Financy na tela inicial: estilo × cor (mesmos estilos do Órbita).
 * Só no app nativo do iPhone (@capacitor-community/app-icon); no site nada acontece.
 */
import { Capacitor } from '@capacitor/core';
import { AppIcon } from '@capacitor-community/app-icon';

export type IconLook = 'grafite' | 'cor' | 'claro' | 'contorno' | 'mono';
export const ICON_LOOKS: { key: IconLook; label: string }[] = [
  { key: 'grafite', label: 'Grafite' },
  { key: 'cor', label: 'Cor' },
  { key: 'claro', label: 'Claro' },
  { key: 'contorno', label: 'Contorno' },
  { key: 'mono', label: 'Mono' },
];
export const ICON_COLORS = [
  { key: 'Verde', hex: '#10B981' },
  { key: 'Carmim', hex: '#F2415A' },
  { key: 'Ambar', hex: '#F5A524' },
  { key: 'Azul', hex: '#4C8DFF' },
  { key: 'Menta', hex: '#3DD6B0' },
  { key: 'Lima', hex: '#A3E635' },
  { key: 'Ciano', hex: '#06B6D4' },
  { key: 'Indigo', hex: '#6366F1' },
  { key: 'Roxo', hex: '#8B5CF6' },
  { key: 'Rosa', hex: '#EC4899' },
  { key: 'Laranja', hex: '#F97316' },
] as const;
export type IconColor = (typeof ICON_COLORS)[number]['key'];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const iconName = (look: IconLook, color: IconColor) => (look === 'mono' ? 'Mono' : `${cap(look)}${color}`);
export const iconThumb = (look: IconLook, color: IconColor) => `/app-icons/${iconName(look, color)}.png`;

export const appIconsAvailable = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';

/** Cor pronta mais próxima pelo matiz (para o ícone seguir a cor do app). */
export function nearestIconColor(hex: string): IconColor {
  const hsl = (h: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    const l = (max + min) / 2;
    let hue = 0;
    if (d) hue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return { h: (hue * 60 + 360) % 360, l };
  };
  const t = hsl(/^#[0-9a-f]{6}$/i.test(hex) ? hex : '#10B981');
  let best: IconColor = 'Verde';
  let dist = Infinity;
  for (const c of ICON_COLORS) {
    const o = hsl(c.hex);
    const dh = Math.min(Math.abs(t.h - o.h), 360 - Math.abs(t.h - o.h));
    const d = dh * dh + (t.l - o.l) * (t.l - o.l) * 400;
    if (d < dist) {
      dist = d;
      best = c.key;
    }
  }
  return best;
}

let last: string | undefined;
export async function setAppIcon(look: IconLook, color: IconColor) {
  if (!appIconsAvailable()) return;
  const name = iconName(look, color);
  if (last === undefined) last = (await AppIcon.getName().catch(() => ({ value: null }))).value ?? 'GrafiteVerde';
  if (name === last) return;
  // o principal é grafite + verde; o resto são ícones alternativos
  if (name === 'GrafiteVerde') await AppIcon.reset({ suppressNotification: true });
  else await AppIcon.change({ name, suppressNotification: true });
  last = name; // só depois de dar certo: se falhar, tenta de novo na próxima vez
}

/** Com "seguir a cor" ligado, aplica o ícone que combina com a cor atual (ao abrir e ao voltar para o app). */
export function syncFollowIcon(look: IconLook, cor: string) {
  if (!appIconsAvailable()) return;
  setAppIcon(look, nearestIconColor(cor)).catch(() => {});
}
