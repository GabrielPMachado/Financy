/**
 * Feriados nacionais do Brasil — na calculadora freelancer eles pagam a hora
 * cheia no valor de domingo/noturno (R$ 18/h), como o domingo.
 *
 * Fixos + Sexta-feira Santa (móvel, calculada pela Páscoa). Carnaval e Corpus
 * Christi são "ponto facultativo" e ficam de fora; para incluir feriados
 * estaduais ou municipais, acrescente em EXTRA_HOLIDAYS no formato 'MM-DD'.
 */
const FIXED_HOLIDAYS: Record<string, string> = {
  '01-01': 'Confraternização Universal',
  '04-21': 'Tiradentes',
  '05-01': 'Dia do Trabalho',
  '09-07': 'Independência do Brasil',
  '10-12': 'Nossa Senhora Aparecida',
  '11-02': 'Finados',
  '11-15': 'Proclamação da República',
  '11-20': 'Consciência Negra',
  '12-25': 'Natal',
};

/** Feriados estaduais/municipais: { 'MM-DD': 'Nome' }. */
export const EXTRA_HOLIDAYS: Record<string, string> = {};

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** Nome do feriado em uma data 'AAAA-MM-DD', ou null se não for feriado. */
export function getHolidayName(dateISO?: string): string | null {
  if (!dateISO) return null;
  const [y, m, d] = dateISO.split('-').map(Number);
  if (!y || !m || !d) return null;

  const monthDay = `${pad(m)}-${pad(d)}`;
  const fixed = FIXED_HOLIDAYS[monthDay] ?? EXTRA_HOLIDAYS[monthDay];
  if (fixed) return fixed;

  const easter = easterSunday(y);
  const goodFriday = new Date(easter.getFullYear(), easter.getMonth(), easter.getDate() - 2);
  if (goodFriday.getMonth() === m - 1 && goodFriday.getDate() === d) return 'Sexta-feira Santa';
  return null;
}

export const isBrazilHoliday = (dateISO?: string): boolean => getHolidayName(dateISO) !== null;
