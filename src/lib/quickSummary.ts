/**
 * Resumo rápido gravado em users/{uid}/resumo/atual, para o Atalho do iPhone
 * (Tocar nas costas) mostrar o saldo e escolher categorias sem abrir o app.
 *
 * Mesmas regras do app (App.tsx): o saldo soma receitas e subtrai despesas sem
 * cartão (despesa de cartão só pesa quando a fatura é paga); os totais do mês
 * seguem a data de Brasília.
 *
 * Sem imports e só com sintaxe que o Node entende ao apagar tipos: o script
 * scripts/sync-pluggy.mjs importa este arquivo direto.
 */
export interface SummaryTransaction {
  description: string;
  amount: number;
  type: 'income' | 'expense' | 'investment';
  date?: string;
  time?: string;
  cardId?: string;
}

export interface SummaryCategory {
  name: string;
  type: 'income' | 'expense' | 'investment';
}

export interface QuickSummary {
  /** Instante da geração (ISO), para mostrar "atualizado às ..." */
  atualizadoEm: string;
  saldo: number;
  entradasMes: number;
  gastosMes: number;
  pendentesTotal: number;
  pendentesQtd: number;
  /** Texto pronto para o alerta do Atalho. */
  texto: string;
  /** Cartão em HTML (fundo escuro, estilo ilha) para o Atalho abrir na Visualização Rápida. */
  html: string;
  /** Uma categoria por linha: o Atalho separa por linha e mostra a lista. */
  categoriasDespesa: string;
  categoriasReceita: string;
}

const RECENT_LIMIT = 3;
const DESCRIPTION_MAX = 26;
const BRAZIL_TIMEZONE = 'America/Sao_Paulo';

const brl = (value: number): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

/**
 * Descrição curta e legível para a caixa do Atalho: tira o prefixo do banco antes de "|",
 * transforma GRITARIA em Título e corta no tamanho máximo.
 */
function shortDescription(raw: string): string {
  const afterPipe = raw.includes('|') ? raw.slice(raw.lastIndexOf('|') + 1) : raw;
  const text = afterPipe.replace(/\s+/g, ' ').trim() || raw.trim();
  const shouting = text === text.toUpperCase() && text !== text.toLowerCase();
  const normal = shouting
    ? text.toLowerCase().replace(/(^|\s)(\S)/g, (_match, space: string, char: string) => space + char.toUpperCase())
    : text;
  return normal.length > DESCRIPTION_MAX ? `${normal.slice(0, DESCRIPTION_MAX - 1).trimEnd()}…` : normal;
}

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

interface RecentLine {
  income: boolean;
  amount: string;
  description: string;
}

interface CardData {
  saldo: string;
  entradas: string;
  gastos: string;
  pendentes: string | null;
  recent: RecentLine[];
  time: string;
}

/** Página autocontida (sem recursos externos): um cartão escuro, igual ao saldo do app. */
function buildHtml(d: CardData): string {
  const recent = d.recent
    .map(
      (r) =>
        `<li><span class="d">${escapeHtml(r.description)}</span><span class="${r.income ? 'in' : 'out'}">${r.income ? '+' : '−'}${escapeHtml(r.amount)}</span></li>`
    )
    .join('');
  const pending = d.pendentes ? `<div class="pill"><span>⏳ Pendentes</span><b>${escapeHtml(d.pendentes)}</b></div>` : '';
  return [
    '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark">',
    '<style>',
    '*{box-sizing:border-box}body{margin:0;padding:16px;background:#000;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif}',
    '.c{background:#1c1c1e;border-radius:28px;padding:22px}.l{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#8e8e93}',
    '.s{font-size:40px;font-weight:700;letter-spacing:-.02em;margin:4px 0 16px}',
    '.g{display:grid;grid-template-columns:1fr 1fr;gap:10px}.b{background:#2c2c2e;border-radius:18px;padding:12px}',
    '.b small{display:block;font-size:12px;margin-bottom:4px}.b b{font-size:17px}.e small{color:#30d158}.x small{color:#ff453a}',
    '.pill{display:flex;justify-content:space-between;background:#2c2c2e;border-radius:18px;padding:12px;margin-top:10px;font-size:15px}',
    'ul{list-style:none;margin:16px 0 0;padding:0}li{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-top:1px solid #2c2c2e;font-size:15px}',
    '.d{color:#d1d1d6;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.in{color:#30d158;font-weight:600}.out{font-weight:600}',
    '.t{margin-top:14px;font-size:12px;color:#8e8e93;text-align:center}',
    '</style></head><body><div class="c">',
    '<div class="l">Saldo</div>',
    `<div class="s">${escapeHtml(d.saldo)}</div>`,
    `<div class="g"><div class="b e"><small>▲ Entradas do mês</small><b>${escapeHtml(d.entradas)}</b></div>`,
    `<div class="b x"><small>▼ Gastos do mês</small><b>${escapeHtml(d.gastos)}</b></div></div>`,
    pending,
    recent ? `<ul>${recent}</ul>` : '',
    `<div class="t">Atualizado às ${escapeHtml(d.time)}</div>`,
    '</div></body></html>',
  ].join('');
}

/** Chave de ordenação "AAAA-MM-DD HH:MM" (sem hora, o lançamento fica no começo do dia). */
const sortKey = (t: { date?: string; time?: string }): string => `${t.date || ''} ${t.time || '00:00'}`;

/** Parte AAAA-MM-DD e HH:MM do instante, no fuso de Brasília. */
function brazilNow(now: Date): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BRAZIL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '00';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
}

export function buildQuickSummary(
  transactions: readonly SummaryTransaction[],
  categories: readonly SummaryCategory[],
  pendingAmounts: readonly number[],
  now: Date = new Date()
): QuickSummary {
  const { date: today, time } = brazilNow(now);
  const month = today.slice(0, 7);

  const saldo = transactions.reduce((acc, t) => {
    if (!t.date || t.date.slice(0, 7) > month) return acc;
    if (t.type === 'income') return acc + t.amount;
    if (t.type === 'expense' && !t.cardId) return acc - t.amount;
    return acc;
  }, 0);

  const inMonth = transactions.filter((t) => t.date && t.date.startsWith(month));
  const entradasMes = inMonth.filter((t) => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const gastosMes = inMonth.filter((t) => t.type === 'expense' && !t.cardId).reduce((acc, t) => acc + t.amount, 0);

  const pendentesTotal = pendingAmounts.reduce((acc, amount) => acc + amount, 0);
  const pendentesQtd = pendingAmounts.length;

  const recent = [...transactions]
    .filter((t) => t.type !== 'investment' && (t.date || '') <= today)
    .sort((a, b) => sortKey(b).localeCompare(sortKey(a)))
    .slice(0, RECENT_LIMIT);

  const recentLines: RecentLine[] = recent.map((t) => ({
    income: t.type === 'income',
    amount: brl(t.amount),
    description: shortDescription(t.description),
  }));
  const pendentes = pendentesQtd > 0 ? `${pendentesQtd} · ${brl(pendentesTotal)}` : null;

  const lines = [`💰 Saldo  ${brl(saldo)}`, `📈 Entradas  ${brl(entradasMes)}`, `📉 Gastos  ${brl(gastosMes)}`];
  if (pendentes) lines.push(`⏳ Pendentes  ${pendentes}`);
  if (recentLines.length > 0) {
    lines.push('', 'Últimos');
    recentLines.forEach((r) => lines.push(`${r.income ? '🟢 +' : '🔴 −'}${r.amount}  ${r.description}`));
  }
  lines.push('', `🕓 Atualizado às ${time}`);

  const namesOf = (type: SummaryCategory['type']): string =>
    categories.filter((c) => c.type === type).map((c) => c.name).join('\n');

  return {
    atualizadoEm: now.toISOString(),
    saldo,
    entradasMes,
    gastosMes,
    pendentesTotal,
    pendentesQtd,
    texto: lines.join('\n'),
    html: buildHtml({
      saldo: brl(saldo),
      entradas: brl(entradasMes),
      gastos: brl(gastosMes),
      pendentes,
      recent: recentLines,
      time,
    }),
    categoriasDespesa: namesOf('expense'),
    categoriasReceita: namesOf('income'),
  };
}
