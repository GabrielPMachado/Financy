/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronRight,
  Compass,
  TrendingDown,
  TrendingUp,
  Plus,
  Trash2,
  Sparkles,
  Loader2,
  Send,
  Info,
} from 'lucide-react';
import { askPlanningAi, isGeminiConfigured } from '../../lib/gemini';
import CurrencyInput from '../common/CurrencyInput';

export interface PlannedDebt {
  id: string;
  description: string;
  amount: number;
  dueDate?: string;
  notes?: string;
}

export interface PlannedInvestment {
  id: string;
  description: string;
  amount: number;
  targetDate?: string;
  notes?: string;
}

export interface PlanningEdgePanelProps {
  /** Saldo real atual, só exibido como referência — nunca alterado por aqui. */
  currentBalance: number;
  plannedDebts: PlannedDebt[];
  setPlannedDebts: React.Dispatch<React.SetStateAction<PlannedDebt[]>>;
  plannedInvestments: PlannedInvestment[];
  setPlannedInvestments: React.Dispatch<React.SetStateAction<PlannedInvestment[]>>;
  formatCurrency: (value: number) => string;
  /** Incremente esse número (ex: Date.now()) pra abrir o painel de fora
   *  (ex: um botão na tela de Configurações), sem duplicar o estado isOpen. */
  externalOpenSignal?: number;
}

type Tab = 'debts' | 'investments' | 'ai';

const emptyDebtForm = { description: '', amount: '', dueDate: '', notes: '' };
const emptyInvestmentForm = { description: '', amount: '', targetDate: '', notes: '' };

export const PlanningEdgePanel: React.FC<PlanningEdgePanelProps> = ({
  currentBalance,
  plannedDebts,
  setPlannedDebts,
  plannedInvestments,
  setPlannedInvestments,
  formatCurrency,
  externalOpenSignal,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('debts');

  useEffect(() => {
    if (externalOpenSignal) setIsOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalOpenSignal]);

  const [debtForm, setDebtForm] = useState(emptyDebtForm);
  const [investmentForm, setInvestmentForm] = useState(emptyInvestmentForm);

  const [aiQuestion, setAiQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const totalPlannedDebts = useMemo(
    () => plannedDebts.reduce((acc, d) => acc + d.amount, 0),
    [plannedDebts]
  );
  const totalPlannedInvestments = useMemo(
    () => plannedInvestments.reduce((acc, i) => acc + i.amount, 0),
    [plannedInvestments]
  );

  const handleAddDebt = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(debtForm.amount.replace(',', '.'));
    if (!debtForm.description.trim() || isNaN(amount) || amount <= 0) return;
    const newDebt: PlannedDebt = {
      id: `planned-debt-${Date.now()}`,
      description: debtForm.description.trim(),
      amount,
      dueDate: debtForm.dueDate || undefined,
      notes: debtForm.notes.trim() || undefined,
    };
    setPlannedDebts((prev) => [newDebt, ...prev]);
    setDebtForm(emptyDebtForm);
  };

  const handleAddInvestment = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(investmentForm.amount.replace(',', '.'));
    if (!investmentForm.description.trim() || isNaN(amount) || amount <= 0) return;
    const newInvestment: PlannedInvestment = {
      id: `planned-investment-${Date.now()}`,
      description: investmentForm.description.trim(),
      amount,
      targetDate: investmentForm.targetDate || undefined,
      notes: investmentForm.notes.trim() || undefined,
    };
    setPlannedInvestments((prev) => [newInvestment, ...prev]);
    setInvestmentForm(emptyInvestmentForm);
  };

  const runAi = async (question?: string) => {
    setAiLoading(true);
    setAiError(null);
    setAiAnswer(null);
    try {
      const answer = await askPlanningAi({
        currentBalance,
        plannedDebts: plannedDebts.map(({ description, amount, dueDate, notes }) => ({
          description,
          amount,
          dueDate,
          notes,
        })),
        plannedInvestments: plannedInvestments.map(({ description, amount, targetDate, notes }) => ({
          description,
          amount,
          targetDate,
          notes,
        })),
        question,
      });
      setAiAnswer(answer);
    } catch (err: any) {
      setAiError(err?.message || 'Falha ao consultar a IA. Tente novamente.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleAskAi = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiQuestion.trim()) return;
    runAi(aiQuestion.trim());
  };

  return (
    <>
      {/* Botão Flutuante da Borda (Edge Handle) — espelhado do painel de
          cartões, mas do lado esquerdo. */}
      <motion.button
        type="button"
        onClick={() => setIsOpen(true)}
        initial={{ x: -20 }}
        animate={{ x: isOpen ? -100 : 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 200 }}
        className="fixed left-0 top-1/2 -translate-y-1/2 z-40 bg-white/90 dark:bg-slate-900/90 hover:bg-slate-100 dark:hover:bg-slate-800 text-emerald-600 dark:text-emerald-400 border-r border-y border-emerald-500/30 pr-2.5 pl-1.5 py-4 rounded-r-2xl shadow-2xl backdrop-blur-md flex items-center gap-1.5 group cursor-pointer transition-colors"
        title="Abrir Área de Planejamento"
      >
        <div className="flex flex-col items-center gap-1">
          <ChevronRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400 group-hover:translate-x-0.5 transition-transform" />
          <Compass className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <span className="text-[9px] font-bold uppercase tracking-wider [writing-mode:vertical-lr] text-slate-600 dark:text-slate-300">
            Planejamento
          </span>
        </div>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50"
            />

            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={{ left: 0.8, right: 0 }}
              onDragEnd={(_, info) => {
                if (info.offset.x < -100 || info.velocity.x < -500) {
                  setIsOpen(false);
                }
              }}
              className="fixed left-0 top-0 bottom-0 z-50 w-full sm:w-[420px] bg-white/95 dark:bg-slate-900/95 border-r border-slate-200 dark:border-slate-800 shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden"
            >
              {/* Cabeçalho */}
              <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white dark:bg-slate-900">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <Compass className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-tight">Planejamento</h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Arraste para a esquerda para fechar</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 transition active:scale-95 text-xs font-bold"
                  title="Fechar"
                >
                  Fechar
                </button>
              </div>

              {/* Aviso: é só simulação */}
              <div className="mx-4 sm:mx-5 mt-4 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-300 text-[11px] leading-relaxed shrink-0">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  Planeje suas dívidas e seus próximos investimentos.
                </span>
              </div>

              {/* Abas */}
              <div className="mx-4 sm:mx-5 mt-3 flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setTab('debts')}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-bold transition ${
                    tab === 'debts' ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <TrendingDown className="w-3.5 h-3.5" />
                  Dívidas
                </button>
                <button
                  type="button"
                  onClick={() => setTab('investments')}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-bold transition ${
                    tab === 'investments' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  Investimentos
                </button>
                <button
                  type="button"
                  onClick={() => setTab('ai')}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-bold transition ${
                    tab === 'ai' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  IA
                </button>
              </div>

              {/* Conteúdo */}
              <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-4">
                {tab === 'debts' && (
                  <>
                    <div className="px-3 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-300 uppercase tracking-wide">Total planejado</span>
                      <span className="font-mono font-bold text-rose-700 dark:text-rose-300 text-sm">{formatCurrency(totalPlannedDebts)}</span>
                    </div>

                    <form onSubmit={handleAddDebt} className="space-y-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                      <input
                        type="text"
                        required
                        value={debtForm.description}
                        onChange={(e) => setDebtForm((f) => ({ ...f, description: e.target.value }))}
                        placeholder="Descrição (ex: Financiamento do carro)"
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg py-2 px-3 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-rose-500/40"
                      />
                      <div className="flex gap-2">
                        <CurrencyInput
                          required
                          value={debtForm.amount}
                          onChange={(amount) => setDebtForm((f) => ({ ...f, amount }))}
                          placeholder="0,00"
                          className="w-1/2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg py-2 px-3 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-rose-500/40"
                        />
                        <input
                          type="date"
                          value={debtForm.dueDate}
                          onChange={(e) => setDebtForm((f) => ({ ...f, dueDate: e.target.value }))}
                          className="w-1/2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg py-2 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500/40"
                        />
                      </div>
                      <input
                        type="text"
                        value={debtForm.notes}
                        onChange={(e) => setDebtForm((f) => ({ ...f, notes: e.target.value }))}
                        placeholder="Notas (opcional)"
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg py-2 px-3 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-rose-500/40"
                      />
                      <button
                        type="submit"
                        className="w-full flex items-center justify-center gap-1.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 border border-rose-500/30 font-semibold text-xs py-2 rounded-lg transition active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Adicionar dívida futura
                      </button>
                    </form>

                    <div className="space-y-2">
                      {plannedDebts.length === 0 && (
                        <p className="text-center text-xs text-slate-400 dark:text-slate-500 py-6">Nenhuma dívida futura cadastrada ainda.</p>
                      )}
                      {plannedDebts.map((d) => (
                        <div key={d.id} className="flex items-center justify-between gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{d.description}</p>
                            <p className="text-[11px] text-slate-400 dark:text-slate-500">
                              {d.dueDate ? `Vence em ${d.dueDate.split('-').reverse().join('/')}` : 'Sem data definida'}
                              {d.notes ? ` · ${d.notes}` : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono text-sm font-bold text-rose-700 dark:text-rose-300">{formatCurrency(d.amount)}</span>
                            <button
                              type="button"
                              onClick={() => setPlannedDebts((prev) => prev.filter((x) => x.id !== d.id))}
                              className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 transition"
                              title="Remover"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {tab === 'investments' && (
                  <>
                    <div className="px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">Total planejado</span>
                      <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300 text-sm">{formatCurrency(totalPlannedInvestments)}</span>
                    </div>

                    <form onSubmit={handleAddInvestment} className="space-y-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                      <input
                        type="text"
                        required
                        value={investmentForm.description}
                        onChange={(e) => setInvestmentForm((f) => ({ ...f, description: e.target.value }))}
                        placeholder="Descrição (ex: Reserva de emergência)"
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg py-2 px-3 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                      />
                      <div className="flex gap-2">
                        <CurrencyInput
                          required
                          value={investmentForm.amount}
                          onChange={(amount) => setInvestmentForm((f) => ({ ...f, amount }))}
                          placeholder="0,00"
                          className="w-1/2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg py-2 px-3 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                        />
                        <input
                          type="date"
                          value={investmentForm.targetDate}
                          onChange={(e) => setInvestmentForm((f) => ({ ...f, targetDate: e.target.value }))}
                          className="w-1/2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg py-2 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                        />
                      </div>
                      <input
                        type="text"
                        value={investmentForm.notes}
                        onChange={(e) => setInvestmentForm((f) => ({ ...f, notes: e.target.value }))}
                        placeholder="Notas (ex: Tesouro Selic, 0,5%/mês)"
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg py-2 px-3 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                      />
                      <button
                        type="submit"
                        className="w-full flex items-center justify-center gap-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-semibold text-xs py-2 rounded-lg transition active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Adicionar investimento futuro
                      </button>
                    </form>

                    <div className="space-y-2">
                      {plannedInvestments.length === 0 && (
                        <p className="text-center text-xs text-slate-400 dark:text-slate-500 py-6">Nenhum investimento futuro cadastrado ainda.</p>
                      )}
                      {plannedInvestments.map((i) => (
                        <div key={i.id} className="flex items-center justify-between gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{i.description}</p>
                            <p className="text-[11px] text-slate-400 dark:text-slate-500">
                              {i.targetDate ? `Meta em ${i.targetDate.split('-').reverse().join('/')}` : 'Sem data definida'}
                              {i.notes ? ` · ${i.notes}` : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono text-sm font-bold text-emerald-700 dark:text-emerald-300">{formatCurrency(i.amount)}</span>
                            <button
                              type="button"
                              onClick={() => setPlannedInvestments((prev) => prev.filter((x) => x.id !== i.id))}
                              className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 transition"
                              title="Remover"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {tab === 'ai' && (
                  <div className="space-y-3">
                    {!isGeminiConfigured() && (
                      <div className="px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-300 text-xs">
                        Nenhuma chave de IA configurada. Adicione uma chave gratuita do Google AI Studio em{' '}
                        <code className="font-mono">GEMINI_API_KEY</code> no seu <code className="font-mono">.env.local</code>.
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => runAi(undefined)}
                      disabled={aiLoading || !isGeminiConfigured()}
                      className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-semibold text-sm py-2.5 rounded-xl transition active:scale-95"
                    >
                      {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      Gerar análise do meu planejamento
                    </button>

                    <form onSubmit={handleAskAi} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={aiQuestion}
                        onChange={(e) => setAiQuestion(e.target.value)}
                        placeholder="Pergunte algo sobre seu planejamento..."
                        disabled={!isGeminiConfigured()}
                        className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 px-3 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-50"
                      />
                      <button
                        type="submit"
                        disabled={aiLoading || !isGeminiConfigured() || !aiQuestion.trim()}
                        className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 disabled:opacity-40 transition active:scale-95"
                        title="Perguntar"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </form>

                    {aiError && (
                      <div className="px-3 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-700 dark:text-rose-300 text-xs">
                        {aiError}
                      </div>
                    )}

                    {aiAnswer && (
                      <div className="px-3.5 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-line">
                        <div className="flex items-center gap-1.5 mb-1.5 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold uppercase tracking-wide">
                          <Sparkles className="w-3 h-3" />
                          Assistente
                        </div>
                        {aiAnswer}
                      </div>
                    )}

                    <p className="text-center text-[10px] text-slate-400 dark:text-slate-500 pt-1">
                      Respostas geradas por IA, podem conter erros — não é recomendação financeira profissional.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default PlanningEdgePanel;
