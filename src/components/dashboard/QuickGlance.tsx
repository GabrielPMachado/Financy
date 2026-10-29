import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowDownRight, ArrowUpRight, Plus, X } from 'lucide-react';
import type { Transaction } from '../../App';
import { compareNewestFirst } from '../../lib/transactions';

interface QuickGlanceProps {
  open: boolean;
  onClose: () => void;
  onQuickAdd: () => void;
  balance: number;
  income: number;
  expense: number;
  pendingTotal: number;
  pendingCount: number;
  transactions: Transaction[];
  formatCurrency: (value: number) => string;
}

const RECENT_LIMIT = 3;
const AUTO_CLOSE_MS = 12_000;
const ISLAND_SPRING = { type: 'spring', stiffness: 380, damping: 32 } as const;

/**
 * "Ilha" de resumo rápido, no estilo da Dynamic Island: nasce como uma pílula
 * no topo e se expande com o saldo, o mês e os últimos lançamentos. Abre pelo
 * endereço `?action=resumo`, que o Atalho do iPhone (Tocar nas costas) usa.
 * A ilha é sempre preta, então usa cores fixas, igual ao cartão de saldo.
 */
export default function QuickGlance({
  open,
  onClose,
  onQuickAdd,
  balance,
  income,
  expense,
  pendingTotal,
  pendingCount,
  transactions,
  formatCurrency,
}: QuickGlanceProps) {
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(onClose, AUTO_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [open, onClose]);

  const recent = [...transactions].sort(compareNewestFirst).slice(0, RECENT_LIMIT);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-900/60 px-4 pt-[max(0.75rem,env(safe-area-inset-top))]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Resumo rápido"
        >
          <motion.div
            className="w-full max-w-md overflow-hidden bg-[#000] text-white shadow-2xl"
            initial={{ width: 126, height: 36, borderRadius: 999 }}
            animate={{ width: '100%', height: 'auto', borderRadius: 36 }}
            exit={{ width: 126, height: 36, borderRadius: 999, opacity: 0 }}
            transition={ISLAND_SPRING}
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              className="p-5 space-y-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.12 }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">Saldo</p>
                  <p className="text-3xl font-bold tracking-tight">{formatCurrency(balance)}</p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Fechar resumo"
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white/10 p-3">
                  <p className="flex items-center gap-1 text-[11px] text-emerald-300"><ArrowUpRight className="w-3.5 h-3.5" /> Entradas do mês</p>
                  <p className="mt-1 text-base font-semibold">{formatCurrency(income)}</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-3">
                  <p className="flex items-center gap-1 text-[11px] text-rose-300"><ArrowDownRight className="w-3.5 h-3.5" /> Gastos do mês</p>
                  <p className="mt-1 text-base font-semibold">{formatCurrency(expense)}</p>
                </div>
              </div>

              {pendingCount > 0 && (
                <div className="rounded-2xl bg-white/10 px-3 py-2.5 flex items-center justify-between text-sm">
                  <span className="text-white/70">{pendingCount} pagamento(s) pendente(s)</span>
                  <span className="font-semibold">{formatCurrency(pendingTotal)}</span>
                </div>
              )}

              {recent.length > 0 && (
                <ul className="space-y-2" aria-label="Últimos lançamentos">
                  {recent.map((tx) => (
                    <li key={tx.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate text-white/80">{tx.description}</span>
                      <span className={`shrink-0 font-semibold ${tx.type === 'income' ? 'text-emerald-300' : 'text-white'}`}>
                        {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <button
                type="button"
                onClick={onQuickAdd}
                className="w-full min-h-[44px] rounded-full bg-white text-black text-sm font-semibold flex items-center justify-center gap-2 active:scale-95 transition"
              >
                <Plus className="w-4 h-4" /> Lançamento rápido
              </button>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
