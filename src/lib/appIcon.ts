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
] as const;
export type IconColor = (typeof ICON_COLORS)[number]['key'];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const iconName = (look: IconLook, color: IconColor) => (look === 'mono' ? 'Mono' : `${cap(look)}${color}`);
export const iconThumb = (look: IconLook, color: IconColor) => `/app-icons/${iconName(look, color)}.png`;

export const appIconsAvailable = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';

export function nearestIconColor(hex: string): IconColor {
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r, g, b] = rgb(hex);
  let best: IconColor = 'Verde';
  let dist = Infinity;
  for (const c of ICON_COLORS) {
    const [R, G, B] = rgb(c.hex);
    const d = (r - R) ** 2 * 2 + (g - G) ** 2 * 4 + (b - B) ** 2 * 3;
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
  if (name === last) return;
  last = name;
  // o principal é grafite + verde; o resto são ícones alternativos
  if (name === 'GrafiteVerde') await AppIcon.reset({ suppressNotification: true });
  else await AppIcon.change({ name, suppressNotification: true });
}
