/** Utilitários de ordenação e exibição de transações com data (AAAA-MM-DD) e hora opcional (HH:MM). */

interface Dated {
  date?: string;
  time?: string;
}

/** Chave de ordenação "AAAA-MM-DD HH:MM". Sem hora, o lançamento fica no começo do dia (00:00). */
const sortKey = (t: Dated): string => `${t.date || ''} ${t.time || '00:00'}`;

/** Mais recente primeiro; empate na hora mantém a ordem original. */
export const compareNewestFirst = (a: Dated, b: Dated): number => sortKey(b).localeCompare(sortKey(a));

/** Hora atual local no formato HH:MM, para novos lançamentos. */
export const currentTimeHHMM = (): string => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

/** "09/10/2026 · 14:32" (ou só a data quando não há hora). */
export const formatDateTime = (date?: string, time?: string): string => {
  if (!date) return '';
  const [y, m, d] = date.split('-');
  const day = y && m && d ? `${d}/${m}/${y}` : date;
  return time ? `${day} · ${time}` : day;
};
