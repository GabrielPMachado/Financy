import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Calendar, ArrowRight, ArrowLeft, CheckCircle2, Plus } from 'lucide-react';
import DatePicker, { registerLocale } from 'react-datepicker';
import { ptBR } from 'date-fns/locale/pt-BR';
import { motion, AnimatePresence } from 'motion/react';
import { CategoryItem } from '../../App';
import CurrencyInput from '../common/CurrencyInput';
import 'react-datepicker/dist/react-datepicker.css';

registerLocale('pt-BR', ptBR);

export interface TransactionFormData {
  valor: string;
  descricao: string;
  categoria: string;
  data: string;
  type?: 'income' | 'expense' | 'investment';
  repeatType?: 'single' | 'installment' | 'recurring';
  installmentsCount?: number;
  recurringMonths?: number;
  /** Opcional: cartão ao qual a despesa está vinculada (undefined = sem cartão). */
  cardId?: string;
}

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  handleSave: (e?: React.FormEvent, closeModal?: boolean) => boolean | void;
  activeTab?: string;
  form: TransactionFormData;
  setForm: React.Dispatch<React.SetStateAction<TransactionFormData>>;
  categories: (CategoryItem | string)[];
  isEditing?: boolean;
  initialViewMode?: 'wizard' | 'form';
  onOpenNewCategory?: (type?: string) => void;
  onOpenManageCategories?: () => void;
  /** Cartões cadastrados, pra permitir vincular a despesa a um deles (opcional). */
  cards?: { id: string; name: string; bank: string; lastDigits: string }[];
}

const TOTAL_STEPS = 6;
const STEP_LABELS: Record<number, string> = {
  1: 'Escolha o Tipo',
  2: 'Informe o Valor',
  3: 'Categoria',
  4: 'Data',
  5: 'Descrição',
  6: 'Confirmar',
};

function todayIso() {
  return new Date().toISOString().split('T')[0];
}
function yesterdayIso() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

export default function TransactionModal({
  isOpen,
  onClose,
  handleSave,
  form,
  setForm,
  categories,
  isEditing = false,
  onOpenNewCategory,
  onOpenManageCategories,
  cards = [],
}: TransactionModalProps) {
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [lastSavedSummary, setLastSavedSummary] = useState<{
    type: string;
    valor: string;
    descricao: string;
    categoria: string;
    data: string;
  } | null>(null);

  const valorInputRef = useRef<HTMLInputElement>(null);
  const descInputRef = useRef<HTMLInputElement>(null);

  const currentType = form.type || 'expense';

  const normalizedCategories: CategoryItem[] = useMemo(() => {
    return categories.map((cat, idx) => {
      if (typeof cat === 'object' && cat !== null && 'name' in cat) {
        return cat as CategoryItem;
      }
      const catName = String(cat);
      let catType: 'income' | 'expense' | 'investment' = 'expense';
      const lower = catName.toLowerCase();
      if (['salário', 'freelance', 'vendas', 'rendimentos', 'receita'].some((k) => lower.includes(k))) {
        catType = 'income';
      } else if (
        ['investimento', 'ações', 'fundos', 'renda fixa', 'cripto', 'reserva'].some((k) =>
          lower.includes(k)
        )
      ) {
        catType = 'investment';
      }
      return {
        id: `cat-${idx}-${catName}`,
        name: catName,
        type: catType,
      };
    });
  }, [categories]);

  const typeCategories = useMemo(() => {
    return normalizedCategories.filter((c) => c.type === currentType);
  }, [normalizedCategories, currentType]);

  useEffect(() => {
    if (isOpen && typeCategories.length > 0) {
      const isValid = typeCategories.some((c) => c.name === form.categoria);
      if (!isValid) {
        setForm((prev) => ({ ...prev, categoria: typeCategories[0].name }));
      }
    }
  }, [isOpen, currentType, typeCategories]);

  useEffect(() => {
    if (isOpen) {
      setWizardStep(1);
      setLastSavedSummary(null);
      if (!form.data) {
        setForm((prev) => ({ ...prev, data: todayIso() }));
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (wizardStep === 2) {
      setTimeout(() => valorInputRef.current?.focus(), 150);
    } else if (wizardStep === 5) {
      setTimeout(() => descInputRef.current?.focus(), 150);
    }
  }, [wizardStep]);

  const handleSelectTypeAndAdvance = (type: 'expense' | 'income' | 'investment') => {
    setForm((prev) => ({ ...prev, type }));
    setWizardStep(2);
  };

  const handleConfirmWizardSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const parsedAmount = parseFloat(form.valor);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    const summary = {
      type: form.type || 'expense',
      valor: form.valor,
      descricao: form.descricao.trim() || form.categoria || 'Sem descrição',
      categoria: form.categoria || 'Outros',
      data: form.data || todayIso(),
    };

    const saved = handleSave(e, false);
    if (saved !== false) {
      setLastSavedSummary(summary);
      setWizardStep(7);
    }
  };

  const handleResetForAnother = () => {
    setForm({
      valor: '',
      descricao: '',
      categoria: typeCategories[0]?.name || 'Outros',
      data: todayIso(),
      type: 'expense',
      repeatType: 'single',
      installmentsCount: 2,
      recurringMonths: 6,
      cardId: undefined,
    });
    setLastSavedSummary(null);
    setWizardStep(1);
  };

  const quickSuggestions = useMemo(() => {
    if (currentType === 'expense') {
      return ['Supermercado', 'Restaurante', 'Combustível', 'Uber', 'Farmácia', 'Aluguel', 'Luz / Água', 'Lazer'];
    } else if (currentType === 'income') {
      return ['Salário', 'Freelance', 'PIX Recebido', 'Venda', 'Rendimento', 'Bônus'];
    } else {
      return ['Tesouro Direto', 'Ações', 'Reserva de Emergência', 'FIIs', 'Cripto'];
    }
  }, [currentType]);

  const selectedCard = cards.find((c) => c.id === form.cardId);

  const labelForTipo = (t: string) =>
    t === 'income' ? '💰 Receita' : t === 'investment' ? '📈 Investimento' : '💸 Despesa';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-3 sm:p-6 overflow-y-auto transition-opacity"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 15 }}
            transition={{ type: 'tween', duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            className="bg-white/85 dark:bg-slate-900/90 backdrop-blur-xl border border-emerald-500/40 p-5 sm:p-7 rounded-3xl w-full max-w-md shadow-[0_20px_50px_rgba(0,0,0,0.6)] my-auto max-h-[92vh] flex flex-col overflow-hidden relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute -top-20 -right-20 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="shrink-0 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4 relative z-10">
              {isEditing ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                  Editar Transação
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Pop-up Rápido
                </span>
              )}

              <button
                onClick={onClose}
                className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition border border-slate-300 dark:border-slate-700"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isEditing ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSave(e, true);
                }}
                className="flex-1 flex flex-col min-h-0 relative z-10"
              >
                <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-4">
                  {/* Tipo */}
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                      Tipo
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['expense', 'income', 'investment'] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setForm({ ...form, type: t })}
                          className={`py-2.5 rounded-xl border text-xs font-semibold transition ${
                            currentType === t
                              ? t === 'expense'
                                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500/50 text-rose-700 dark:text-rose-300'
                                : t === 'income'
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500/50 text-emerald-700 dark:text-emerald-300'
                                : 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500/50 text-indigo-700 dark:text-indigo-300'
                              : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          {t === 'expense' ? '💸 Despesa' : t === 'income' ? '💰 Receita' : '📈 Investimento'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Valor */}
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                      Valor (R$)
                    </label>
                    <CurrencyInput
                      required
                      placeholder="0,00"
                      value={form.valor}
                      onChange={(valor) => setForm({ ...form, valor })}
                      className="w-full bg-slate-50 dark:bg-slate-950 text-emerald-600 dark:text-emerald-400 font-bold text-lg px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  {/* Categoria */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Categoria
                      </label>
                      <div className="flex items-center gap-2 text-[11px]">
                        {onOpenNewCategory && (
                          <button
                            type="button"
                            onClick={() => onOpenNewCategory(currentType)}
                            className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:text-emerald-300 font-semibold transition"
                          >
                            + Nova
                          </button>
                        )}
                      </div>
                    </div>
                    <select
                      value={form.categoria}
                      onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:outline-none"
                    >
                      {typeCategories.map((cat) => (
                        <option key={cat.id || cat.name} value={cat.name}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Data */}
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                      Data
                    </label>
                    <DatePicker
                      selected={form.data ? new Date(form.data + 'T00:00:00') : new Date()}
                      onChange={(date: Date | null) => {
                        if (date) {
                          const ano = date.getFullYear();
                          const mes = String(date.getMonth() + 1).padStart(2, '0');
                          const dia = String(date.getDate()).padStart(2, '0');
                          setForm({ ...form, data: `${ano}-${mes}-${dia}` });
                        }
                      }}
                      dateFormat="dd/MM/yyyy"
                      locale="pt-BR"
                      popperPlacement="bottom-start"
                      customInput={
                        <button
                          type="button"
                          className="w-full bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 focus:border-emerald-500 focus:outline-none transition flex items-center justify-between"
                        >
                          <span className="font-mono">
                            {form.data ? form.data.split('-').reverse().join('/') : 'Selecione'}
                          </span>
                          <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        </button>
                      }
                    />
                  </div>

                  {/* Descrição */}
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                      Descrição
                    </label>
                    <input
                      type="text"
                      value={form.descricao}
                      onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                      placeholder="Ex: Supermercado, Aluguel..."
                      className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  {/* Cartão vinculado (só para despesa) */}
                  {currentType === 'expense' && cards.length > 0 && (
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                        Vincular a um cartão (opcional)
                      </label>
                      <select
                        value={form.cardId || ''}
                        onChange={(e) => setForm({ ...form, cardId: e.target.value || undefined })}
                        className="w-full bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:outline-none"
                      >
                        <option value="">Nenhum cartão</option>
                        {cards.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} — {c.bank} •••• {c.lastDigits}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="shrink-0 pt-4 border-t border-slate-200 dark:border-slate-800 mt-4 flex gap-2.5">
                  <button
                    type="button"
                    onClick={onClose}
                    className="py-3 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium text-xs transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={!form.valor || parseFloat(form.valor) <= 0}
                    className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs transition shadow-lg shadow-emerald-950/40"
                  >
                    Salvar Alterações
                  </button>
                </div>
              </form>
            ) : (
            <div className="flex-1 flex flex-col min-h-0 relative z-10">
              {wizardStep <= TOTAL_STEPS && (
                <div className="mb-4">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5 font-medium">
                    <span>Etapa {wizardStep} de {TOTAL_STEPS}</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{STEP_LABELS[wizardStep]}</span>
                  </div>
                  <div className="w-full bg-slate-50 dark:bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-200 dark:border-slate-800">
                    <motion.div
                      className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full"
                      initial={{ width: '0%' }}
                      animate={{ width: `${(wizardStep / TOTAL_STEPS) * 100}%` }}
                      transition={{ duration: 0.25 }}
                    />
                  </div>
                </div>
              )}

              <AnimatePresence mode="wait">
                {wizardStep === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex-1 flex flex-col justify-between"
                  >
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">
                        Qual é o tipo da transação?
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                        Selecione para organizar seu lançamento no orçamento.
                      </p>

                      <div className="space-y-2.5">
                        <button
                          type="button"
                          onClick={() => handleSelectTypeAndAdvance('expense')}
                          className={`w-full p-3.5 rounded-2xl border text-left transition flex items-center justify-between group ${
                            (form.type || 'expense') === 'expense'
                              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500/50 text-slate-900 dark:text-slate-100'
                              : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="icon-tile w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400 text-lg font-bold">
                              💸
                            </div>
                            <div>
                              <div className="font-bold text-sm text-slate-900 dark:text-slate-100">Despesa</div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">Gastos, compras, contas a pagar</div>
                            </div>
                          </div>
                          <ArrowRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-slate-800 dark:group-hover:text-slate-200 group-hover:translate-x-0.5 transition-all" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSelectTypeAndAdvance('income')}
                          className={`w-full p-3.5 rounded-2xl border text-left transition flex items-center justify-between group ${
                            form.type === 'income'
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500/50 text-slate-900 dark:text-slate-100'
                              : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="icon-tile w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-lg font-bold">
                              💰
                            </div>
                            <div>
                              <div className="font-bold text-sm text-slate-900 dark:text-slate-100">Receita</div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">Salário, vendas, entradas de dinheiro</div>
                            </div>
                          </div>
                          <ArrowRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-slate-800 dark:group-hover:text-slate-200 group-hover:translate-x-0.5 transition-all" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSelectTypeAndAdvance('investment')}
                          className={`w-full p-3.5 rounded-2xl border text-left transition flex items-center justify-between group ${
                            form.type === 'investment'
                              ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500/50 text-slate-900 dark:text-slate-100'
                              : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="icon-tile w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-lg font-bold">
                              📈
                            </div>
                            <div>
                              <div className="font-bold text-sm text-slate-900 dark:text-slate-100">Investimento</div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">Aportes, reservas, ações, renda fixa</div>
                            </div>
                          </div>
                          <ArrowRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-slate-800 dark:group-hover:text-slate-200 group-hover:translate-x-0.5 transition-all" />
                        </button>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-200 dark:border-slate-800 mt-4 flex gap-2.5">
                      <button
                        type="button"
                        onClick={onClose}
                        className="w-full py-3 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium text-xs transition"
                      >
                        Abrir App Completo
                      </button>
                    </div>
                  </motion.div>
                )}

                {wizardStep === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex-1 flex flex-col justify-between"
                  >
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (parseFloat(form.valor) > 0) setWizardStep(3);
                      }}
                      className="flex-1 flex flex-col justify-between"
                    >
                      <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">
                          Qual é o valor?
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                          Digite a quantia em reais para o seu lançamento.
                        </p>

                        <div className="bg-white/80 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl mb-3 text-center">
                          <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                            VALOR EM REAIS (R$)
                          </label>
                          <div className="relative inline-flex items-center justify-center w-full">
                            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mr-1.5">R$</span>
                            <CurrencyInput
                              ref={valorInputRef}
                              required
                              placeholder="0,00"
                              value={form.valor}
                              onChange={(valor) => setForm({ ...form, valor })}
                              className="w-48 bg-transparent text-emerald-600 dark:text-emerald-400 font-black text-3xl text-center focus:outline-none placeholder:text-slate-500 dark:placeholder:text-slate-400"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-2">
                          {[10, 50, 100, 200].map((addVal) => (
                            <button
                              key={addVal}
                              type="button"
                              onClick={() => {
                                const current = parseFloat(form.valor) || 0;
                                setForm({ ...form, valor: (current + addVal).toFixed(2) });
                              }}
                              className="py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/40 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:text-emerald-600 dark:hover:text-emerald-400 transition"
                            >
                              +R$ {addVal}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="pt-4 border-t border-slate-200 dark:border-slate-800 mt-4 flex gap-2.5">
                        <button
                          type="button"
                          onClick={() => setWizardStep(1)}
                          className="py-3 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium text-xs transition flex items-center gap-1.5"
                        >
                          <ArrowLeft className="w-4 h-4" /> Voltar
                        </button>
                        <button
                          type="submit"
                          disabled={!form.valor || parseFloat(form.valor) <= 0}
                          className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs transition shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-1.5"
                        >
                          Próximo <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </form>
                  </motion.div>
                )}

                {wizardStep === 3 && (
                  <motion.div
                    key="step3"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex-1 flex flex-col justify-between"
                  >
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        setWizardStep(4);
                      }}
                      className="flex-1 flex flex-col justify-between min-h-0"
                    >
                      <div className="min-h-0 overflow-y-auto pr-1">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">
                          Qual é a categoria?
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                          Selecione para categorizar no seu relatório financeiro.
                        </p>

                        <div className="flex items-center justify-end gap-2 text-[11px] mb-2">
                          {onOpenNewCategory && (
                            <button
                              type="button"
                              onClick={() => onOpenNewCategory(currentType)}
                              className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:text-emerald-300 font-semibold transition"
                            >
                              + Nova
                            </button>
                          )}
                          {onOpenManageCategories && (
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onOpenManageCategories();
                              }}
                              className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium transition"
                            >
                              Gerenciar
                            </button>
                          )}
                        </div>

                        <div className="max-h-52 overflow-y-auto pr-1 space-y-1.5 mb-3">
                          {typeCategories.length > 0 ? (
                            <div className="grid grid-cols-2 gap-2">
                              {typeCategories.map((cat) => (
                                <button
                                  key={cat.id || cat.name}
                                  type="button"
                                  onClick={() => setForm({ ...form, categoria: cat.name })}
                                  className={`p-3 rounded-xl border text-left text-xs font-semibold transition flex items-center justify-between ${
                                    form.categoria === cat.name
                                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-500/60 shadow-md shadow-emerald-950/30'
                                      : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                                  }`}
                                >
                                  <span className="truncate">{cat.name}</span>
                                  {form.categoria === cat.name && (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 ml-1" />
                                  )}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400 dark:text-slate-500 py-4 text-center">
                              Nenhuma categoria encontrada para este tipo.
                            </p>
                          )}
                        </div>

                        {currentType === 'expense' && cards.length > 0 && (
                          <div className="mb-1">
                            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                              Vincular a um cartão (opcional)
                            </label>
                            <select
                              value={form.cardId || ''}
                              onChange={(e) => setForm({ ...form, cardId: e.target.value || undefined })}
                              className="w-full bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:outline-none"
                            >
                              <option value="">Nenhum cartão</option>
                              {cards.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name} — {c.bank} •••• {c.lastDigits}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      <div className="shrink-0 pt-4 border-t border-slate-200 dark:border-slate-800 mt-4 flex gap-2.5">
                        <button
                          type="button"
                          onClick={() => setWizardStep(2)}
                          className="py-3 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium text-xs transition flex items-center gap-1.5"
                        >
                          <ArrowLeft className="w-4 h-4" /> Voltar
                        </button>
                        <button
                          type="submit"
                          className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-1.5"
                        >
                          Próximo <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </form>
                  </motion.div>
                )}

                {wizardStep === 4 && (
                  <motion.div
                    key="step4"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex-1 flex flex-col justify-between"
                  >
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        setWizardStep(5);
                      }}
                      className="flex-1 flex flex-col justify-between"
                    >
                      <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">
                          Qual é a data?
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                          Escolha rapidamente ou selecione outra data.
                        </p>

                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <button
                            type="button"
                            onClick={() => setForm({ ...form, data: todayIso() })}
                            className={`py-3 rounded-xl border text-sm font-semibold transition ${
                              form.data === todayIso()
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-500/60'
                                : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                            }`}
                          >
                            Hoje
                          </button>
                          <button
                            type="button"
                            onClick={() => setForm({ ...form, data: yesterdayIso() })}
                            className={`py-3 rounded-xl border text-sm font-semibold transition ${
                              form.data === yesterdayIso()
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-500/60'
                                : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                            }`}
                          >
                            Ontem
                          </button>
                        </div>

                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                          Ou escolha outra data
                        </label>
                        <DatePicker
                          selected={form.data ? new Date(form.data + 'T00:00:00') : new Date()}
                          onChange={(date: Date | null) => {
                            if (date) {
                              const ano = date.getFullYear();
                              const mes = String(date.getMonth() + 1).padStart(2, '0');
                              const dia = String(date.getDate()).padStart(2, '0');
                              setForm({ ...form, data: `${ano}-${mes}-${dia}` });
                            }
                          }}
                          dateFormat="dd/MM/yyyy"
                          locale="pt-BR"
                          popperPlacement="bottom-start"
                          customInput={
                            <button
                              type="button"
                              className="w-full bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 text-sm px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 focus:border-emerald-500 focus:outline-none transition flex items-center justify-between cursor-pointer group"
                            >
                              <span className="font-mono">
                                {form.data
                                  ? form.data.split('-').reverse().join('/')
                                  : 'Selecione a data'}
                              </span>
                              <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform" />
                            </button>
                          }
                        />
                      </div>

                      <div className="pt-4 border-t border-slate-200 dark:border-slate-800 mt-4 flex gap-2.5">
                        <button
                          type="button"
                          onClick={() => setWizardStep(3)}
                          className="py-3 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium text-xs transition flex items-center gap-1.5"
                        >
                          <ArrowLeft className="w-4 h-4" /> Voltar
                        </button>
                        <button
                          type="submit"
                          className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-1.5"
                        >
                          Próximo <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </form>
                  </motion.div>
                )}

                {wizardStep === 5 && (
                  <motion.div
                    key="step5"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex-1 flex flex-col justify-between"
                  >
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        setWizardStep(6);
                      }}
                      className="flex-1 flex flex-col justify-between"
                    >
                      <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">
                          Qual é a descrição?
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                          Identifique de onde vem ou para onde vai essa transação.
                        </p>

                        <div className="space-y-3">
                          <input
                            ref={descInputRef}
                            type="text"
                            placeholder="Ex: Supermercado Extra, Aluguel, Uber..."
                            value={form.descricao}
                            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-medium text-base px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:outline-none transition"
                          />

                          <div>
                            <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                              SUGESTÕES RÁPIDAS
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {quickSuggestions.map((sug) => (
                                <button
                                  key={sug}
                                  type="button"
                                  onClick={() => setForm({ ...form, descricao: sug })}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
                                    form.descricao === sug
                                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-500/50'
                                      : 'bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-800 dark:hover:text-slate-200'
                                  }`}
                                >
                                  {sug}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-slate-200 dark:border-slate-800 mt-4 flex gap-2.5">
                        <button
                          type="button"
                          onClick={() => setWizardStep(4)}
                          className="py-3 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium text-xs transition flex items-center gap-1.5"
                        >
                          <ArrowLeft className="w-4 h-4" /> Voltar
                        </button>
                        <button
                          type="submit"
                          className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-1.5"
                        >
                          {form.descricao.trim() ? 'Próximo' : 'Pular / Próximo'} <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </form>
                  </motion.div>
                )}

                {wizardStep === 6 && (
                  <motion.div
                    key="step6"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex-1 flex flex-col justify-between min-h-0"
                  >
                    <form onSubmit={handleConfirmWizardSave} className="flex-1 flex flex-col justify-between min-h-0">
                      <div className="min-h-0 overflow-y-auto pr-1">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">
                          Confirmar lançamento
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                          Revise antes de salvar.
                        </p>

                        <div className="bg-white/90 dark:bg-slate-950/60 border border-emerald-500/20 p-4 rounded-2xl mb-4 space-y-2">
                          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                            <span className="text-xs text-slate-500 dark:text-slate-400">Tipo</span>
                            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                              {labelForTipo(currentType)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                            <span className="text-xs text-slate-500 dark:text-slate-400">Valor</span>
                            <span className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                              R$ {parseFloat(form.valor || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                            <span className="text-xs text-slate-500 dark:text-slate-400">Categoria</span>
                            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{form.categoria}</span>
                          </div>
                          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                            <span className="text-xs text-slate-500 dark:text-slate-400">Data</span>
                            <span className="text-xs font-mono font-semibold text-slate-600 dark:text-slate-300">
                              {form.data ? form.data.split('-').reverse().join('/') : '—'}
                            </span>
                          </div>
                          <div className={`flex items-center justify-between ${selectedCard ? 'border-b border-slate-200 dark:border-slate-800 pb-2' : ''}`}>
                            <span className="text-xs text-slate-500 dark:text-slate-400">Descrição</span>
                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[180px]">
                              {form.descricao.trim() || form.categoria || 'Sem descrição'}
                            </span>
                          </div>
                          {selectedCard && (
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-500 dark:text-slate-400">Cartão</span>
                              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                                {selectedCard.name} •••• {selectedCard.lastDigits}
                              </span>
                            </div>
                          )}
                        </div>

                        {!isEditing && (
                          <div className="space-y-2.5 pt-1 border-t border-slate-200 dark:border-slate-800">
                            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mt-2">
                              TIPO DE REPETIÇÃO
                            </label>
                            <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-950 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-medium">
                              <button
                                type="button"
                                onClick={() => setForm({ ...form, repeatType: 'single' })}
                                className={`py-2 rounded-lg transition text-center ${
                                  (form.repeatType || 'single') === 'single'
                                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold border border-slate-300 dark:border-slate-700'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                                }`}
                              >
                                Única
                              </button>
                              <button
                                type="button"
                                onClick={() => setForm({ ...form, repeatType: 'installment', installmentsCount: form.installmentsCount || 2 })}
                                className={`py-2 rounded-lg transition text-center ${
                                  form.repeatType === 'installment'
                                    ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-semibold border border-indigo-200 dark:border-indigo-800/50'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                                }`}
                              >
                                Parcelada
                              </button>
                              <button
                                type="button"
                                onClick={() => setForm({ ...form, repeatType: 'recurring', recurringMonths: form.recurringMonths || 6 })}
                                className={`py-2 rounded-lg transition text-center ${
                                  form.repeatType === 'recurring'
                                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-200 dark:border-emerald-800/50'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                                }`}
                              >
                                Recorrente
                              </button>
                            </div>

                            {form.repeatType === 'installment' && (
                              <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/50 p-3 rounded-xl space-y-2">
                                <div className="flex items-center justify-between">
                                  <label className="text-xs font-medium text-indigo-200">Número de Parcelas</label>
                                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{form.installmentsCount || 2}x</span>
                                </div>
                                <input
                                  type="number"
                                  min={2}
                                  max={72}
                                  value={form.installmentsCount || 2}
                                  onChange={(e) => {
                                    const count = Math.max(2, Math.min(72, parseInt(e.target.value) || 2));
                                    setForm({ ...form, installmentsCount: count });
                                  }}
                                  className="w-full bg-slate-50 dark:bg-slate-950 text-indigo-700 dark:text-indigo-300 text-sm px-3 py-2 rounded-lg border border-indigo-200 dark:border-indigo-800/50 focus:border-indigo-500 focus:outline-none"
                                />
                              </div>
                            )}

                            {form.repeatType === 'recurring' && (
                              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 p-3 rounded-xl space-y-2">
                                <div className="flex items-center justify-between">
                                  <label className="text-xs font-medium text-emerald-200">Repetir por Quantos Meses?</label>
                                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{form.recurringMonths || 6} meses</span>
                                </div>
                                <select
                                  value={form.recurringMonths || 6}
                                  onChange={(e) => setForm({ ...form, recurringMonths: parseInt(e.target.value) || 6 })}
                                  className="w-full bg-slate-50 dark:bg-slate-950 text-emerald-700 dark:text-emerald-300 text-sm px-3 py-2 rounded-lg border border-emerald-200 dark:border-emerald-800/50 focus:border-emerald-500 focus:outline-none"
                                >
                                  <option value={2}>2 meses</option>
                                  <option value={3}>3 meses</option>
                                  <option value={6}>6 meses (Semestre)</option>
                                  <option value={12}>12 meses (1 Ano)</option>
                                  <option value={24}>24 meses (2 Anos)</option>
                                </select>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="shrink-0 pt-4 border-t border-slate-200 dark:border-slate-800 mt-4 flex gap-2.5">
                        <button
                          type="button"
                          onClick={() => setWizardStep(5)}
                          className="py-3 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium text-xs transition flex items-center gap-1.5"
                        >
                          <ArrowLeft className="w-4 h-4" /> Voltar
                        </button>
                        <button
                          type="submit"
                          className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-1.5"
                        >
                          Salvar e Confirmar 🎉
                        </button>
                      </div>
                    </form>
                  </motion.div>
                )}

                {wizardStep === 7 && (
                  <motion.div
                    key="step7"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex-1 flex flex-col items-center justify-center text-center py-2"
                  >
                    <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-3 shadow-lg shadow-emerald-950/50">
                      <CheckCircle2 className="w-10 h-10 animate-pulse" />
                    </div>

                    <h3 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 mb-1">
                      Transação Registrada!
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                      Tudo salvo com sucesso no seu orçamento.
                    </p>

                    {lastSavedSummary && (
                      <div className="w-full bg-white/90 dark:bg-slate-950/60 border border-emerald-500/20 p-4 rounded-2xl mb-5 text-left space-y-2">
                        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                          <span className="text-xs text-slate-500 dark:text-slate-400">Tipo</span>
                          <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                            {labelForTipo(lastSavedSummary.type)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                          <span className="text-xs text-slate-500 dark:text-slate-400">Valor</span>
                          <span className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                            R$ {parseFloat(lastSavedSummary.valor || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                          <span className="text-xs text-slate-500 dark:text-slate-400">Data</span>
                          <span className="text-xs font-mono font-semibold text-slate-600 dark:text-slate-300">
                            {lastSavedSummary.data.split('-').reverse().join('/')}
                          </span>
                        </div>
                        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                          <span className="text-xs text-slate-500 dark:text-slate-400">Descrição</span>
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[180px]">
                            {lastSavedSummary.descricao}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500 dark:text-slate-400">Categoria</span>
                          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                            {lastSavedSummary.categoria}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="w-full space-y-2.5">
                      <button
                        type="button"
                        onClick={handleResetForAnother}
                        className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2"
                      >
                        <Plus className="w-4 h-4" /> Lançar Outra Transação
                      </button>
                      <button
                        type="button"
                        onClick={onClose}
                        className="w-full py-3 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold text-xs transition flex items-center justify-center gap-1.5"
                      >
                        Abrir Aplicativo Completo
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
