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
  /** Uma categoria por linha: o Atalho separa por linha e mostra a lista. */
  categoriasDespesa: string;
  categoriasReceita: string;
}

const RECENT_LIMIT = 3;
const BRAZIL_TIMEZONE = 'America/Sao_Paulo';

const brl = (value: number): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

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

  const lines = [
    `Saldo: ${brl(saldo)}`,
    `Entradas do mês: ${brl(entradasMes)}`,
    `Gastos do mês: ${brl(gastosMes)}`,
  ];
  if (pendentesQtd > 0) lines.push(`Pendentes: ${pendentesQtd} (${brl(pendentesTotal)})`);
  if (recent.length > 0) {
    lines.push('', 'Últimos:');
    recent.forEach((t) => lines.push(`${t.type === 'income' ? '+' : '-'}${brl(t.amount)}  ${t.description}`));
  }
  lines.push('', `Atualizado às ${time}`);

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
    categoriasDespesa: namesOf('expense'),
    categoriasReceita: namesOf('income'),
  };
}
