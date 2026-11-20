import { useState, useMemo } from 'react';
import { Search, Filter, ArrowUpRight, ArrowDownRight, Tag, Calendar, Trash2, Edit2, PlusCircle, X, PiggyBank, FolderPlus, List, CalendarRange } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { CategoryItem, Transaction } from '../../App';
import { compareNewestFirst, formatDateTime } from '../../lib/transactions';
import { isInternalTransfer } from '../../lib/quickSummary';

// um tipo só para o app inteiro (antes havia uma cópia reduzida aqui, que divergia da de App.tsx)
export type { Transaction } from '../../App';

export type FilterType = 'all' | 'income' | 'expense' | 'investment';

interface TransactionHistoryProps {
  transactions: Transaction[];
  categories?: (CategoryItem | string)[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filterType: FilterType;
  setFilterType: (filter: FilterType) => void;
  onDeleteTransaction: (id: string) => void;
  onEditTransaction?: (transaction: Transaction) => void;
  onOpenNewTransaction?: () => void;
  onOpenManageCategories?: () => void;
  formatCurrency?: (val: number) => string;
}

export default function TransactionHistory({
  transactions,
  categories = [],
  searchTerm,
  setSearchTerm,
  filterType,
  setFilterType,
  onDeleteTransaction,
  onEditTransaction,
  onOpenNewTransaction,
  onOpenManageCategories,
  formatCurrency = (val) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val),
}: TransactionHistoryProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<'all' | 'this_month' | 'last_30'>('all');
  const [viewMode, setViewMode] = useState<'list' | 'weekly'>('list');
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);


  // Normalize categories for grouped select
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

  // Grouped category options
  const expenseCats = normalizedCategories.filter((c) => c.type === 'expense');
  const incomeCats = normalizedCategories.filter((c) => c.type === 'income');
  const investmentCats = normalizedCategories.filter((c) => c.type === 'investment');

  // Filter transactions
  const filtered = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    return transactions.filter((t) => {
      // Type filter
      if (filterType === 'income' && t.type !== 'income') return false;
      if (filterType === 'expense' && t.type !== 'expense') return false;
      if (
        filterType === 'investment' &&
        !(t.type === 'investment' || t.category.toLowerCase().includes('invest'))
      ) {
        return false;
      }

      // Category filter
      if (selectedCategory !== 'all' && t.category !== selectedCategory) return false;

      // Period filter
      if (periodFilter === 'this_month') {
        const tDate = new Date(t.date);
        if (tDate.getFullYear() !== currentYear || tDate.getMonth() !== currentMonth) {
          return false;
        }
      } else if (periodFilter === 'last_30') {
        const tDate = new Date(t.date);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(now.getDate() - 30);
        if (tDate < thirtyDaysAgo) return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matchesDesc = t.description.toLowerCase().includes(term);
        const matchesCat = t.category.toLowerCase().includes(term);
        if (!matchesDesc && !matchesCat) return false;
      }

      return true;
    })
      // Ordem cronológica: dia mais recente no topo da lista, dia mais antigo
      // lá embaixo (datas em formato YYYY-MM-DD comparam certo como string).
      .sort(compareNewestFirst);
  }, [transactions, filterType, selectedCategory, periodFilter, searchTerm]);

  // Agrupamento semanal das transações filtradas
  const weeklyGroups = useMemo(() => {
    if (viewMode !== 'weekly') return [];

    const map = new Map<string, Transaction[]>();

    filtered.forEach(t => {
      if (!t.date) return;
      const parts = t.date.split('-');
      if (parts.length !== 3) return;
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      const dateObj = new Date(y, m - 1, d);
      if (isNaN(dateObj.getTime())) return;

      const day = dateObj.getDay();
      const diffToMon = dateObj.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(dateObj.setDate(diffToMon));
      const mondayKey = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;

      if (!map.has(mondayKey)) {
        map.set(mondayKey, []);
      }
      map.get(mondayKey)!.push(t);
    });

    const groups: {
      weekKey: string;
      label: string;
      transactions: Transaction[];
      totalIncome: number;
      totalExpense: number;
      totalInvestment: number;
      balance: number;
    }[] = [];

    map.forEach((txs, mondayKey) => {
      const parts = mondayKey.split('-');
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      const monday = new Date(y, m - 1, d);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      const label = `Semana: ${monday.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} a ${sunday.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;

      let totalIncome = 0;
      let totalExpense = 0;
      let totalInvestment = 0;

      txs.forEach(t => {
        if (isInternalTransfer(t)) return; // transferência entre contas próprias
        if (t.type === 'income') totalIncome += t.amount;
        else if (t.type === 'expense') totalExpense += t.amount;
        else if (t.type === 'investment' || t.category.toLowerCase().includes('invest')) totalInvestment += t.amount;
      });

      groups.push({
        weekKey: mondayKey,
        label,
        // Mesma ordem cronológica de cima: dia mais recente da semana no
        // topo, mais antigo embaixo.
        transactions: [...txs].sort(compareNewestFirst),
        totalIncome,
        totalExpense,
        totalInvestment,
        balance: totalIncome - totalExpense
      });
    });

    return groups.sort((a, b) => b.weekKey.localeCompare(a.weekKey));
  }, [filtered, viewMode]);

  // Agrupamento por mês pra visão "Lista" — sem isso, ao ver "Todos os Meses"
  // as transações de meses diferentes ficavam todas grudadas numa lista só,
  // sem nenhuma separação visual (mesmo já ordenadas por data, ficava
  // confuso). Só usado quando há mais de um mês nos resultados filtrados —
  // pra um único mês selecionado, o cabeçalho seria redundante.
  const monthlyGroups = useMemo(() => {
    const map = new Map<string, Transaction[]>();

    filtered.forEach((t) => {
      const monthKey = t.date && t.date.length >= 7 ? t.date.slice(0, 7) : 'sem-data';
      if (!map.has(monthKey)) map.set(monthKey, []);
      map.get(monthKey)!.push(t);
    });

    const monthLabel = (monthKey: string) => {
      if (monthKey === 'sem-data') return 'Sem data';
      const [y, m] = monthKey.split('-').map(Number);
      const label = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      return label.charAt(0).toUpperCase() + label.slice(1);
    };

    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([monthKey, txs]) => ({ monthKey, label: monthLabel(monthKey), transactions: txs }));
  }, [filtered]);

  const activeFiltersCount = (filterType !== 'all' ? 1 : 0) + (selectedCategory !== 'all' ? 1 : 0) + (periodFilter !== 'all' ? 1 : 0);

  const resetFilters = () => {
    setFilterType('all');
    setSelectedCategory('all');
    setPeriodFilter('all');
    setSearchTerm('');
  };

  const renderTransactionItem = (item: Transaction) => {
    const isInvestment =
      item.type === 'investment' || item.category.toLowerCase().includes('invest');
    const isIncome = item.type === 'income' && !isInvestment;

    let iconBoxClass = 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/50 text-rose-600 dark:text-rose-400';
    let amountTextClass = 'text-rose-600 dark:text-rose-400';
    let sign = '- ';
    let IconComponent = ArrowDownRight;

    if (isInvestment) {
      iconBoxClass = 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/50 text-indigo-600 dark:text-indigo-400';
      amountTextClass = 'text-indigo-600 dark:text-indigo-400';
      sign = '• ';
      IconComponent = PiggyBank;
    } else if (isIncome) {
      iconBoxClass = 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/50 text-emerald-600 dark:text-emerald-400';
      amountTextClass = 'text-emerald-600 dark:text-emerald-400';
      sign = '+ ';
      IconComponent = ArrowUpRight;
    }

    return (
      <motion.div
        key={item.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-950 p-3 sm:p-3.5 rounded-2xl flex items-center justify-between transition group"
      >
        <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0 pr-2">
          <div className={`icon-tile w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBoxClass}`}>
            <IconComponent className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate">
              {item.description}
            </p>
            <span className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
              <Tag className="w-3 h-3 shrink-0" />
              <span className="truncate">
                {item.linkedFreelance ? `Freelance${item.linkedFreelance.weekLabel ? ` · ${item.linkedFreelance.weekLabel}` : ''}` : item.category}
              </span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <div className="text-right">
            <p className={`font-semibold text-xs sm:text-sm font-mono ${amountTextClass}`}>
              {sign}
              {formatCurrency(item.amount)}
            </p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{formatDateTime(item.date, item.time)}</p>
          </div>
          {onEditTransaction && (
            <button
              onClick={() => onEditTransaction(item)}
              className="text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 p-1.5 rounded-lg opacity-100 sm:opacity-0 group-hover:opacity-100 transition hover:bg-emerald-50 dark:hover:bg-emerald-950/40 active:scale-95"
              title="Editar transação"
            >
              <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          )}
          <button
            onClick={() => setTransactionToDelete(item)}
            className="text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 p-1.5 rounded-lg opacity-100 sm:opacity-0 group-hover:opacity-100 transition hover:bg-rose-50 dark:hover:bg-rose-950/40 active:scale-95"
            title="Remover transação"
          >
            <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 sm:p-5 shadow-sm space-y-3.5 flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3.5">
        <div className="flex items-center justify-between sm:justify-start gap-2 flex-wrap">
          <h2 className="font-semibold text-slate-800 dark:text-slate-200 text-sm sm:text-base">Histórico de Transações</h2>
          <div className="flex items-center space-x-1.5">
            {onOpenNewTransaction && (
              <button
                onClick={onOpenNewTransaction}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-1.5 px-3 rounded-xl transition text-xs flex items-center space-x-1 shadow-md shadow-emerald-950/40 active:scale-95"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Nova Transação</span>
              </button>
            )}
            {onOpenManageCategories && (
              <button
                onClick={onOpenManageCategories}
                className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 font-medium py-1.5 px-2.5 rounded-xl transition text-xs flex items-center space-x-1 shadow-sm active:scale-95"
                title="Gerenciar Categorias"
              >
                <FolderPlus className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                <span className="hidden xs:inline">Categorias</span>
              </button>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between sm:justify-end gap-2 flex-wrap">
          {/* Alternador de Modos de Exibição (Lista vs Semana) */}
          <div className="flex bg-slate-50 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-2.5 py-1 rounded-lg font-medium transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Lista</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('weekly')}
              className={`px-2.5 py-1 rounded-lg font-medium transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'weekly'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <CalendarRange className="w-3.5 h-3.5" />
              <span>Por Semana</span>
            </button>
          </div>

          {/* Filter Toggle Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center space-x-1.5 transition ${
              showFilters || activeFiltersCount > 0
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-700/60 text-emerald-600 dark:text-emerald-400'
                : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filtros</span>
            {activeFiltersCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-emerald-500 text-slate-950 font-bold text-[10px] flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </button>

          {/* Quick Type Filter Tabs */}
          <div className="flex bg-slate-50 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs overflow-x-auto max-w-full">
            <button
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition whitespace-nowrap ${
                filterType === 'all'
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setFilterType('income')}
              className={`px-2.5 py-1 rounded-lg font-medium transition whitespace-nowrap ${
                filterType === 'income'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Receitas
            </button>
            <button
              onClick={() => setFilterType('expense')}
              className={`px-2.5 py-1 rounded-lg font-medium transition whitespace-nowrap ${
                filterType === 'expense'
                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Despesas
            </button>
            <button
              onClick={() => setFilterType('investment')}
              className={`px-2.5 py-1 rounded-lg font-medium transition whitespace-nowrap ${
                filterType === 'investment'
                  ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Investimentos
            </button>
          </div>
        </div>
      </div>

      {/* Expandable Filter Panel */}
      {showFilters && (
        <div className="bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl space-y-3 animate-in fade-in duration-150">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span>Filtros Avançados</span>
            {activeFiltersCount > 0 && (
              <button
                onClick={resetFilters}
                className="text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:text-rose-300 transition text-[11px] flex items-center space-x-1"
              >
                <X className="w-3 h-3" />
                <span>Limpar Filtros</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Category Filter */}
            <div>
              <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                Categoria
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:outline-none"
              >
                <option value="all">Todas as categorias</option>
                {expenseCats.length > 0 && (
                  <optgroup label="Despesas">
                    {expenseCats.map((cat) => (
                      <option key={cat.id || cat.name} value={cat.name}>
                        {cat.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                {incomeCats.length > 0 && (
                  <optgroup label="Receitas">
                    {incomeCats.map((cat) => (
                      <option key={cat.id || cat.name} value={cat.name}>
                        {cat.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                {investmentCats.length > 0 && (
                  <optgroup label="Investimentos">
                    {investmentCats.map((cat) => (
                      <option key={cat.id || cat.name} value={cat.name}>
                        {cat.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            {/* Period Filter */}
            <div>
              <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                Período
              </label>
              <select
                value={periodFilter}
                onChange={(e) => setPeriodFilter(e.target.value as any)}
                className="w-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:outline-none"
              >
                <option value="all">Todo o período</option>
                <option value="this_month">Mês atual</option>
                <option value="last_30">Últimos 30 dias</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-3" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por descrição ou categoria..."
          className="w-full bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 text-xs pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:outline-none transition"
        />
      </div>

      {/* List of Transactions */}
      <div className="flex-1 overflow-y-auto space-y-3 max-h-[560px] pr-1">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400 dark:text-slate-500 space-y-2">
            <Filter className="w-8 h-8 mx-auto opacity-40" />
            <p className="text-sm">Nenhuma transação encontrada.</p>
            {activeFiltersCount > 0 && (
              <button
                onClick={resetFilters}
                className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline mt-1"
              >
                Limpar todos os filtros
              </button>
            )}
          </div>
        ) : viewMode === 'weekly' ? (
          <div className="space-y-4">
            {weeklyGroups.map((group) => (
              <div
                key={group.weekKey}
                className="bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 space-y-3 shadow-sm"
              >
                {/* Header da Semana */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="icon-tile p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                      <CalendarRange className="w-4 h-4" />
                    </div>
                    <span className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200">
                      {group.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap text-xs font-mono font-semibold">
                    {group.totalIncome > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                        +{formatCurrency(group.totalIncome)}
                      </span>
                    )}
                    {group.totalExpense > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50">
                        -{formatCurrency(group.totalExpense)}
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded-md border ${
                        group.balance >= 0
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50'
                          : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/50'
                      }`}
                    >
                      Saldo: {formatCurrency(group.balance)}
                    </span>
                  </div>
                </div>

                {/* Transações da Semana */}
                <div className="space-y-2">
                  {group.transactions.map(renderTransactionItem)}
                </div>
              </div>
            ))}
          </div>
        ) : monthlyGroups.length > 1 ? (
          <div className="space-y-5">
            {monthlyGroups.map((group) => (
              <div key={group.monthKey}>
                <div className="flex items-center gap-2 mb-2 sticky top-0 bg-white/95 dark:bg-slate-950/95 backdrop-blur py-1.5 z-10">
                  <div className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    <Calendar className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-bold text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {group.label}
                  </span>
                  <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
                </div>
                <AnimatePresence mode="popLayout">
                  <div className="space-y-2">{group.transactions.map(renderTransactionItem)}</div>
                </AnimatePresence>
              </div>
            ))}
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filtered.map(renderTransactionItem)}
          </AnimatePresence>
        )}
      </div>

      {/* Confirmation Modal for Transaction Deletion */}
      <AnimatePresence>
        {transactionToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl"
            >
              <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Excluir Transação?</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Esta ação não poderá ser desfeita.</p>
                </div>
              </div>

              <div className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1 font-mono">
                <div className="text-white font-bold text-sm">
                  {transactionToDelete.description}
                </div>
                <div className="text-emerald-600 dark:text-emerald-400 font-extrabold">
                  {formatCurrency(transactionToDelete.amount)}
                </div>
                <div className="text-[11px] text-slate-400 dark:text-slate-500">
                  {transactionToDelete.category} • {transactionToDelete.date}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTransactionToDelete(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteTransaction(transactionToDelete.id);
                    setTransactionToDelete(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition shadow-md shadow-rose-950/40 active:scale-95"
                >
                  Confirmar Exclusão
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
