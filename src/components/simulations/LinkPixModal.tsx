import { X, Link2, CheckCircle2 } from 'lucide-react';
import type { Transaction } from '../../App';
import type { PendingSimulation } from './PendingSimulationsSidebar';
import { compareNewestFirst, formatDateTime } from '../../lib/transactions';

interface LinkPixModalProps {
  pending: PendingSimulation | null;
  /** Receitas recebidas ainda sem vínculo com nenhum freelance. */
  candidates: Transaction[];
  formatCurrency: (value: number) => string;
  onLink: (transactionId: string) => void;
  onClose: () => void;
}

const SAME_VALUE_TOLERANCE = 0.01;

/**
 * Vincula um Pix recebido (receita já importada do banco) a um pagamento
 * freelance pendente. Não cria lançamento novo — o Pix já conta no saldo —,
 * só marca o Pix como "Freelance" e tira a pendência da lista.
 */
export default function LinkPixModal({ pending, candidates, formatCurrency, onLink, onClose }: LinkPixModalProps) {
  if (!pending) return null;

  const withDiff = candidates
    .map((t) => ({ tx: t, diff: Math.round((t.amount - pending.amount) * 100) / 100 }))
    .sort((a, b) => {
      const aSame = Math.abs(a.diff) < SAME_VALUE_TOLERANCE;
      const bSame = Math.abs(b.diff) < SAME_VALUE_TOLERANCE;
      if (aSame !== bSame) return aSame ? -1 : 1;
      return compareNewestFirst(a.tx, b.tx);
    });

  return (
    <div
      className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="link-pix-title"
        className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 p-5 pb-3">
          <div className="min-w-0">
            <h2 id="link-pix-title" className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Link2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /> Vincular Pix recebido
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {pending.weekLabel || 'Pagamento freelance'} · previsto{' '}
              <strong className="text-slate-900 dark:text-slate-100 tabular-nums">{formatCurrency(pending.amount)}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 flex items-center justify-center shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pb-2 text-xs text-slate-400 dark:text-slate-500">
          Escolha o Pix que pagou essa semana. Ele passa a aparecer como Freelance e a pendência sai da lista, sem somar duas vezes no saldo.
        </div>

        <ul className="overflow-y-auto px-3 pb-5 space-y-2">
          {withDiff.length === 0 && (
            <li className="px-3 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              Nenhuma receita disponível. Sincronize os bancos para o Pix aparecer aqui.
            </li>
          )}
          {withDiff.map(({ tx, diff }) => {
            const same = Math.abs(diff) < SAME_VALUE_TOLERANCE;
            return (
              <li key={tx.id}>
                <button
                  type="button"
                  onClick={() => onLink(tx.id)}
                  className="w-full flex items-center justify-between gap-3 text-left rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500/60 bg-slate-50 dark:bg-slate-950/60 px-4 py-3 min-h-[56px] transition active:scale-[0.99]"
                >
                  <span className="min-w-0">
                    <span className="block font-semibold text-[15px] text-slate-900 dark:text-slate-100 truncate">{tx.description}</span>
                    <span className="block text-xs text-slate-400 dark:text-slate-500 mt-0.5">{formatDateTime(tx.date, tx.time)}</span>
                  </span>
                  <span className="text-right shrink-0">
                    <span className="block font-semibold text-[15px] text-emerald-600 dark:text-emerald-400 tabular-nums">
                      +{formatCurrency(tx.amount)}
                    </span>
                    {same ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" /> Valor igual
                      </span>
                    ) : (
                      <span className="block text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                        {diff > 0 ? '+' : '-'}{formatCurrency(Math.abs(diff))} do previsto
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
