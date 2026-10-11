import { Plus, Tag } from 'lucide-react';
import type { Transaction } from '../../App';
import { compareNewestFirst } from '../../lib/transactions';

interface RecentTransactionsProps {
  transactions: Transaction[];
  formatCurrency: (value: number) => string;
  onEdit: (transaction: Transaction) => void;
  onSeeAll: () => void;
  onNew: () => void;
  limit?: number;
}

const toShortDate = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
};

export default function RecentTransactions({
  transactions,
  formatCurrency,
  onEdit,
  onSeeAll,
  onNew,
  limit = 5,
}: RecentTransactionsProps) {
  const recent = [...transactions]
    .sort(compareNewestFirst)
    .slice(0, limit);

  return (
    <section aria-labelledby="recent-title" className="space-y-3">
      <div className="flex items-baseline justify-between px-1">
        <h2 id="recent-title" className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Últimas transações
        </h2>
        <button
          type="button"
          onClick={onSeeAll}
          className="text-sm font-medium text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition"
        >
          Ver todas
        </button>
      </div>

      {recent.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm p-6 text-center space-y-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Nenhuma transação neste mês — registre o primeiro gasto ou receita.
          </p>
          <button
            type="button"
            onClick={onNew}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#1c1c1e] dark:bg-white text-white dark:text-slate-900 text-sm font-semibold active:scale-95 transition"
          >
            <Plus className="w-4 h-4" /> Nova transação
          </button>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {recent.map((t) => {
            const isIncome = t.type === 'income';
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => onEdit(t)}
                  className="w-full flex items-center justify-between gap-3 text-left bg-white dark:bg-slate-900 rounded-2xl shadow-sm px-4 py-3.5 min-h-[56px] active:scale-[0.99] transition"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-[15px] text-slate-900 dark:text-slate-100 truncate">{t.description}</p>
                    <p className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                      <Tag className="w-3 h-3 shrink-0" />
                      <span className="truncate">
                        {t.linkedFreelance ? `Freelance${t.linkedFreelance.weekLabel ? ` · ${t.linkedFreelance.weekLabel}` : ''}` : t.category}
                      </span>
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p
                      className={`font-semibold text-[15px] tabular-nums ${
                        isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      {isIncome ? '+' : '-'}{formatCurrency(t.amount)}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{toShortDate(t.date)}{t.time ? ` · ${t.time}` : ''}</p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
