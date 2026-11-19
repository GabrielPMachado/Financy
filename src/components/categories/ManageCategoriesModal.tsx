import React, { useState } from 'react';
import { Trash2, X, Plus, TrendingDown, TrendingUp, PiggyBank } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CategoryItem } from '../../App';

interface ManageCategoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: (CategoryItem | string)[];
  onDeleteCategory: (categoryIdentifier: string) => void;
  onOpenNewCategory?: (type?: string) => void;
}

export default function ManageCategoriesModal({
  isOpen,
  onClose,
  categories,
  onDeleteCategory,
  onOpenNewCategory,
}: ManageCategoriesModalProps) {
  const [activeTab, setActiveTab] = useState<'expense' | 'income' | 'investment'>('expense');
  const [categoryToDelete, setCategoryToDelete] = useState<CategoryItem | null>(null);

  // Normalize categories to CategoryItem objects
  const normalizedCategories: CategoryItem[] = categories.map((cat, idx) => {
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
      color: catType === 'income' ? '#10B981' : catType === 'investment' ? '#8B5CF6' : '#F43F5E',
    };
  });

  const expenseCats = normalizedCategories.filter((c) => c.type === 'expense');
  const incomeCats = normalizedCategories.filter((c) => c.type === 'income');
  const investmentCats = normalizedCategories.filter((c) => c.type === 'investment');

  const currentTabCategories =
    activeTab === 'expense'
      ? expenseCats
      : activeTab === 'income'
      ? incomeCats
      : investmentCats;

  const getTabTitle = () => {
    if (activeTab === 'income') return 'Receitas';
    if (activeTab === 'investment') return 'Investimentos';
    return 'Despesas';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            transition={{ type: 'tween', duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-7 rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Gerenciar Categorias</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Cada tipo de transação possui suas próprias categorias.
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 p-1.5 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Type Selector Tabs */}
            <div className="grid grid-cols-3 gap-1.5 bg-slate-50 dark:bg-slate-950 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 my-4 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('expense')}
                className={`py-2 px-2 rounded-xl transition flex items-center justify-center gap-1.5 ${
                  activeTab === 'expense'
                    ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <TrendingDown className="w-3.5 h-3.5" />
                <span>Despesas ({expenseCats.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('income')}
                className={`py-2 px-2 rounded-xl transition flex items-center justify-center gap-1.5 ${
                  activeTab === 'income'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Receitas ({incomeCats.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('investment')}
                className={`py-2 px-2 rounded-xl transition flex items-center justify-center gap-1.5 ${
                  activeTab === 'investment'
                    ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <PiggyBank className="w-3.5 h-3.5" />
                <span>Investimentos ({investmentCats.length})</span>
              </button>
            </div>

            {/* Category List */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2 mb-4 min-h-[180px] max-h-[300px]">
              {currentTabCategories.length === 0 ? (
                <div className="text-center py-10 text-slate-400 dark:text-slate-500 space-y-2">
                  <p className="text-xs">Nenhuma categoria cadastrada para {getTabTitle()}.</p>
                </div>
              ) : (
                currentTabCategories.map((cat) => (
                  <div
                    key={cat.id || cat.name}
                    className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-950 transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-3 h-3 rounded-full border border-white/20"
                        style={{ backgroundColor: cat.color || '#10B981' }}
                      />
                      <span className="text-sm text-slate-800 dark:text-slate-200 font-medium">{cat.name}</span>
                    </div>

                    <button
                      onClick={() => setCategoryToDelete(cat)}
                      className="text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 p-1.5 rounded-lg transition"
                      title="Excluir Categoria"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Confirmation Modal for Category Deletion */}
            <AnimatePresence>
              {categoryToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 max-w-xs w-full space-y-4 shadow-2xl"
                  >
                    <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
                      <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                        <Trash2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Excluir Categoria?</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Remover do cadastro.</p>
                      </div>
                    </div>

                    <div className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-2 font-mono">
                      <span
                        className="w-3 h-3 rounded-full border border-white/20 shrink-0"
                        style={{ backgroundColor: categoryToDelete.color || '#10B981' }}
                      />
                      <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">{categoryToDelete.name}</span>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setCategoryToDelete(null)}
                        className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 transition"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteCategory(categoryToDelete.id || categoryToDelete.name);
                          setCategoryToDelete(null);
                        }}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition shadow-md shadow-rose-950/40 active:scale-95"
                      >
                        Confirmar Exclusão
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Footer buttons */}
            <div className="flex justify-between items-center pt-2 gap-3 border-t border-slate-200 dark:border-slate-800">
              {onOpenNewCategory && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenNewCategory(activeTab);
                  }}
                  className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition flex items-center gap-1.5 shadow-md shadow-emerald-950/40"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nova Categoria</span>
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium text-xs sm:text-sm transition ml-auto"
              >
                Fechar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
