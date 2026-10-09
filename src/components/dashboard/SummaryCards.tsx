import React, { memo } from 'react';
import { DollarSign, TrendingUp, TrendingDown, PiggyBank } from 'lucide-react';
import { motion } from 'motion/react';

export interface SummaryData {
  income: number;
  expense: number;
  balance?: number;
  investments?: number;
}

interface SummaryCardsProps {
  summary: SummaryData;
  colors?: {
    green?: string;
    accent?: string;
    red?: string;
    textSecondary?: string;
  };
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
  filterType?: 'all' | 'income' | 'expense' | 'investment';
  onSelectFilter?: (filter: 'all' | 'income' | 'expense' | 'investment') => void;
}

function SummaryCards({
  summary,
  colors = {
    green: '#34d399',
    accent: '#818cf8',
    red: '#f87171',
    textSecondary: '#94a3b8',
  },
  activeTab,
  setActiveTab,
  filterType,
  onSelectFilter,
}: SummaryCardsProps) {
  const cardsData = [
    {
      label: 'RECEITA TOTAL',
      val: summary.income || 0,
      color: colors.green || '#34d399',
      valueClass: 'text-emerald-600 dark:text-emerald-400',
      targetTab: 'Receita',
      icon: TrendingUp,
      filter: 'income' as const,
    },
    {
      label: 'INVESTIMENTOS',
      val: summary.investments || 0,
      color: colors.accent || '#818cf8',
      valueClass: 'text-indigo-600 dark:text-indigo-400',
      targetTab: 'Investimento',
      icon: PiggyBank,
      filter: 'investment' as const,
    },
    {
      label: 'DESPESAS',
      val: summary.expense || 0,
      color: colors.red || '#f87171',
      valueClass: 'text-rose-600 dark:text-rose-400',
      targetTab: 'Despesa variável',
      icon: TrendingDown,
      filter: 'expense' as const,
    },
  ];

  const handleCardClick = (targetTab: string, filter: 'all' | 'income' | 'expense' | 'investment') => {
    if (setActiveTab) {
      setActiveTab(targetTab);
    }
    if (onSelectFilter) {
      onSelectFilter(filter);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6">
      {cardsData.map((item) => {
        const isExpenseTab = activeTab === 'Despesa fixa' || activeTab === 'Despesa variável';
        const isActive =
          (activeTab && item.targetTab === activeTab) ||
          (activeTab && item.label === 'DESPESAS' && isExpenseTab) ||
          (filterType && filterType === item.filter);

        const IconComponent = item.icon;

        return (
          <motion.div
            key={item.label}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            onClick={() => handleCardClick(item.targetTab, item.filter)}
            className={`bg-white dark:bg-slate-900 rounded-2xl border p-5 shadow-sm transition cursor-pointer flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 ${
              isActive
                ? 'border-emerald-500/80 bg-white/90 dark:bg-slate-900/90 shadow-lg shadow-slate-950/10 dark:shadow-slate-950/50'
                : 'border-slate-200 dark:border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold tracking-wider">
              <span>{item.label}</span>
              <motion.div
                whileHover={{ rotate: 10 }}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800"
                style={{ backgroundColor: `${item.color}15`, color: item.color }}
              >
                <IconComponent className="w-4 h-4" />
              </motion.div>
            </div>
            <div className="mt-4">
              <span className={`text-2xl sm:text-3xl font-bold font-mono tracking-tight ${item.valueClass}`}>
                {formatCurrency(item.val)}
              </span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

export default memo(SummaryCards);
