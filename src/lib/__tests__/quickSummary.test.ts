import { describe, expect, it } from 'vitest';
import { TRANSFER_CATEGORY, buildQuickSummary, type SummaryTransaction } from '../quickSummary';

// 20/11/2026 ao meio-dia em Brasília
const AGORA = new Date('2026-11-20T15:00:00Z');

const tx: SummaryTransaction[] = [
  { description: 'Salário', amount: 1000, type: 'income', date: '2026-11-05' },
  { description: 'Mercado', amount: 200, type: 'expense', date: '2026-11-10', category: 'Alimentação' },
  { description: 'Tênis no cartão', amount: 300, type: 'expense', date: '2026-11-12', cardId: 'nubank' },
  { description: 'Para o Mercado Pago', amount: 50, type: 'expense', date: '2026-11-13', category: TRANSFER_CATEGORY },
  { description: 'Do Nubank', amount: 50, type: 'income', date: '2026-11-13', category: TRANSFER_CATEGORY },
  { description: 'Aluguel do mês passado', amount: 400, type: 'expense', date: '2026-10-28' },
  { description: 'Salário de dezembro', amount: 999, type: 'income', date: '2026-12-05' },
];

describe('buildQuickSummary', () => {
  const r = buildQuickSummary(tx, [], [100, 50], AGORA);

  it('saldo: receitas menos despesas fora do cartão, até o mês atual', () => {
    // 1000 − 200 − 400 (out) − 50 + 50 (transferência se anula); cartão e dezembro ficam de fora
    expect(r.saldo).toBe(400);
  });

  it('entradas e gastos do mês ignoram cartão e transferência entre contas', () => {
    expect(r.entradasMes).toBe(1000);
    expect(r.gastosMes).toBe(200);
  });

  it('soma os pendentes', () => {
    expect(r.pendentesTotal).toBe(150);
    expect(r.pendentesQtd).toBe(2);
  });

  it('título usa a data de Brasília', () => {
    expect(r.titulo).toBe('Financy · 20 de nov');
  });

  it('lista as categorias por tipo, uma por linha', () => {
    const s = buildQuickSummary([], [
      { name: 'Mercado', type: 'expense' },
      { name: 'Salário', type: 'income' },
      { name: 'Lazer', type: 'expense' },
    ], [], AGORA);
    expect(s.categoriasDespesa).toBe('Mercado\nLazer');
    expect(s.categoriasReceita).toBe('Salário');
  });
});
