import { ArrowUp, ArrowDown } from 'lucide-react';

interface CategoryTotal {
  name: string;
  value: number;
}

interface AnalysisViewProps {
  expense: number;
  income: number;
  previousExpense: number | null;
  categories: CategoryTotal[];
  formatCurrency: (value: number) => string;
  onSelectCategory: (name: string) => void;
}

const RING_RADIUS = 18;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

function Ring({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="relative w-11 h-11 shrink-0">
      <svg viewBox="0 0 44 44" className="w-full h-full -rotate-90" aria-hidden="true">
        <circle cx="22" cy="22" r={RING_RADIUS} fill="none" strokeWidth="3" className="stroke-slate-200 dark:stroke-slate-700" />
        <circle
          cx="22"
          cy="22"
          r={RING_RADIUS}
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          className="stroke-emerald-500"
          strokeDasharray={RING_LENGTH}
          strokeDashoffset={RING_LENGTH * (1 - clamped / 100)}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-700 dark:text-slate-200 tabular-nums">
        {Math.round(clamped)}%
      </span>
    </div>
  );
}

export default function AnalysisView({
  expense,
  income,
  previousExpense,
  categories,
  formatCurrency,
  onSelectCategory,
}: AnalysisViewProps) {
  const sorted = [...categories].sort((a, b) => b.value - a.value);
  const diff = previousExpense === null ? null : expense - previousExpense;
  const diffPct =
    previousExpense && previousExpense > 0 ? Math.round(((expense - previousExpense) / previousExpense) * 100) : null;
  const isUp = (diff ?? 0) > 0;
  const incomeShare = income > 0 ? Math.round((expense / income) * 100) : null;

  return (
    <div className="space-y-4">
      {previousExpense !== null && (
        <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Vs. mês anterior
            </span>
            {diffPct !== null && (
              <span
                className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-bold ${
                  isUp
                    ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {isUp ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                {Math.abs(diffPct)}%
              </span>
            )}
          </div>
          <div className="mt-3 flex items-center gap-5">
            <div>
              <p className="text-xs text-slate-400 dark:text-slate-500">Mês anterior</p>
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums">{formatCurrency(previousExpense)}</p>
            </div>
            <div className="w-px self-stretch bg-slate-200 dark:bg-slate-800" />
            <div>
              <p className="text-xs text-slate-400 dark:text-slate-500">Diferença</p>
              <p
                className={`text-lg font-bold tabular-nums ${
                  isUp ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {isUp ? '+' : '-'}{formatCurrency(Math.abs(diff ?? 0))}
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm">
        <div className="flex items-center justify-between px-4 pt-4 pb-1">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Gastos por categoria</h3>
          {incomeShare !== null && (
            <span className="text-xs text-slate-400 dark:text-slate-500">{incomeShare}% do recebido</span>
          )}
        </div>

        {sorted.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Sem despesas neste mês — nada para analisar ainda.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {sorted.map((c) => (
              <li key={c.name}>
                <button
                  type="button"
                  onClick={() => onSelectCategory(c.name)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left min-h-[56px] hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
                >
                  <Ring percent={expense > 0 ? (c.value / expense) * 100 : 0} />
                  <span className="flex-1 min-w-0 truncate font-medium text-[15px] text-slate-900 dark:text-slate-100">{c.name}</span>
                  <span className="font-semibold text-[15px] text-slate-900 dark:text-slate-100 tabular-nums">
                    {formatCurrency(c.value)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
