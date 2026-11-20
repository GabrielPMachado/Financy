import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export interface CategoryData {
  name: string;
  type: string;
  color: string;
}

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (category: CategoryData) => void;
  initialType?: string;
  colors?: {
    textSecondary?: string;
    [key: string]: any;
  };
}

export default function CategoryModal({ isOpen, onClose, onSave, initialType = 'Despesa variável' }: CategoryModalProps) {
  const [categoryName, setCategoryName] = useState('');
  const [categoryType, setCategoryType] = useState('Despesa variável');
  const [selectedColor, setSelectedColor] = useState('#F43F5E');

  React.useEffect(() => {
    if (isOpen && initialType) {
      if (initialType === 'income' || initialType === 'Receita') {
        setCategoryType('Receita');
        setSelectedColor('#10B981');
      } else if (initialType === 'investment' || initialType === 'Investimento') {
        setCategoryType('Investimento');
        setSelectedColor('#8B5CF6');
      } else {
        setCategoryType('Despesa variável');
        setSelectedColor('#F43F5E');
      }
    }
  }, [isOpen, initialType]);

  const colorPalette = [
    // Vermelhos / Rosas
    '#F43F5E', '#E11D48', '#BE185D', '#EC4899', '#DB2777',
    // Laranjas / Amarelos
    '#F97316', '#EA580C', '#D97706', '#F59E0B', '#EAB308',
    // Verdes
    '#84CC16', '#22C55E', '#10B981', '#14B8A6', '#06B6D4',
    // Azuis / Roxo
    '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#D946EF',
  ];

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (categoryName.trim() && categoryType && selectedColor) {
      onSave({
        name: categoryName.trim(),
        type: categoryType,
        color: selectedColor,
      });
      setCategoryName('');
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-[60] p-3 sm:p-6 overflow-y-auto"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            transition={{ type: 'tween', duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-7 rounded-3xl w-full max-w-md shadow-2xl my-auto max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4 shrink-0">Criar Nova Categoria</h2>
            <form onSubmit={handleSave} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto pr-1 space-y-4">
              <div>
                <label
                  className="block text-xs font-semibold uppercase tracking-wider mb-2 text-slate-500 dark:text-slate-400"
                >
                  NOME DA CATEGORIA
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Academia"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 text-sm px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:outline-none transition"
                />
              </div>

              <div>
                <label
                  className="block text-xs font-semibold uppercase tracking-wider mb-2 text-slate-500 dark:text-slate-400"
                >
                  TIPO PRINCIPAL
                </label>
                <select
                  required
                  value={categoryType}
                  onChange={(e) => setCategoryType(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 text-sm px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:outline-none transition"
                >
                  <option value="Receita">Receita</option>
                  <option value="Investimento">Investimento</option>
                  <option value="Despesa fixa">Despesa fixa</option>
                  <option value="Despesa variável">Despesa variável</option>
                </select>
              </div>

              <div>
                <label
                  className="block text-xs font-semibold uppercase tracking-wider mb-2 text-slate-500 dark:text-slate-400"
                >
                  COR
                </label>
                <div className="flex flex-wrap gap-2.5">
                  {colorPalette.map((color) => (
                    <button
                      type="button"
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`w-7 h-7 rounded-full transition-transform ${
                        selectedColor === color
                          ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-white dark:ring-offset-slate-900'
                          : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              </div>

              <div className="shrink-0 pt-4 border-t border-slate-200 dark:border-slate-800 mt-2 flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium text-sm transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition shadow-lg shadow-emerald-950/40"
                >
                  Salvar Categoria
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

