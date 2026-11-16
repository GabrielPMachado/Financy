import React, { memo } from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import { ptBR } from 'date-fns/locale/pt-BR';
import { RefreshCw, Calendar, ChevronLeft, ChevronRight, ChevronDown, History, Plus, LogOut, Orbit } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import 'react-datepicker/dist/react-datepicker.css';

registerLocale('pt-BR', ptBR);

export interface HeaderColors {
  accent?: string;
  textPrimary?: string;
  textSecondary?: string;
  border?: string;
}

export type SaveStatusType = 'saving' | 'error' | 'local' | 'db' | 'saved';

export interface HeaderProps {
  colors?: HeaderColors;
  convertedFilterDate?: Date | null;
  monthFilter?: string;
  setMonthFilter?: (month: string) => void;
  balance?: number;
  previousMonthBalance?: number | null;
  /** Total de receitas / despesas do mês filtrado — só pra exibição no
   *  cartão do topo (Entradas/Saídas), já calculados no App. */
  income?: number;
  expense?: number;
  userName?: string;
  userEmail?: string;
  onLogout?: () => void;
  /** Abre o Órbita (só no iPhone). */
  onOpenOrbita?: () => void;
  onOpenNewTransaction?: () => void;
  saveStatus?: SaveStatusType;
  saveErrorMessage?: string | null;
  onRetrySave?: () => void;
  /** Qual número o cartão do topo destaca — cada aba mostra o que faz
   *  sentido pra ela, em vez do mesmo Saldo repetido em todo lugar:
   *  'saldo' (Home), 'gasto' (Análise), 'pendente' (Contas), 'none' (Config,
   *  sem cartão). Default 'saldo'. */
  cardMode?: 'saldo' | 'gasto' | 'pendente' | 'none';
  /** Total de simulações pendentes de recebimento — só usado quando cardMode='pendente'. */
  pendingTotal?: number;
  pendingCount?: number;
  /** Sobrescrevem a saudação ("Bom dia" / nome) nas outras abas (ex: "Análise" / "Metas"). */
  eyebrow?: string;
  title?: string;
  /** Pílula "Ver detalhes" na base do cartão preto. */
  onSeeDetails?: () => void;
  /** Botão "Sincronizar agora" (dispara o workflow de bancos) e o estado dele. */
  onSyncNow?: () => void;
  syncStatus?: 'idle' | 'starting' | 'running' | 'done' | 'error';
  syncMessage?: string;
}

const defaultColors: Required<HeaderColors> = {
  accent: '#10b981',
  textPrimary: '#f8fafc',
  textSecondary: '#94a3b8',
  border: 'rgba(255, 255, 255, 0.1)',
};

const CustomYearHeader = ({
  date,
  decreaseYear,
  increaseYear,
}: {
  date: Date;
  decreaseYear: () => void;
  increaseYear: () => void;
}) => {
  const currentYear = date.getFullYear();
  const prevYearRef = React.useRef(currentYear);
  const direction = currentYear >= prevYearRef.current ? 1 : -1;

  React.useEffect(() => {
    prevYearRef.current = currentYear;
  }, [currentYear]);

  return (
    <div className="flex items-center justify-between px-3 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 font-semibold rounded-t-xl">
      <button
        type="button"
        className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition flex items-center gap-0.5 active:scale-95"
        onClick={decreaseYear}
        title="Ano anterior"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        <span className="text-[11px] text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">{currentYear - 1}</span>
      </button>
      <div className="relative overflow-hidden w-16 h-6 flex items-center justify-center">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.span
            key={currentYear}
            custom={direction}
            initial={{ opacity: 0, x: direction >= 0 ? 18 : -18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction >= 0 ? -18 : 18 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="absolute text-emerald-600 dark:text-emerald-400 font-bold text-sm tracking-wide"
          >
            {currentYear}
          </motion.span>
        </AnimatePresence>
      </div>
      <button
        type="button"
        className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition flex items-center gap-0.5 active:scale-95"
        onClick={increaseYear}
        title="Próximo ano"
      >
        <span className="text-[11px] text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">{currentYear + 1}</span>
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

const MONTH_LABELS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const Header = ({
  colors = defaultColors,
  convertedFilterDate,
  monthFilter = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
  setMonthFilter = () => {},
  balance = 0,
  previousMonthBalance = null,
  income = 0,
  expense = 0,
  userName,
  userEmail,
  onLogout,
  onOpenOrbita,
  onOpenNewTransaction,
  saveStatus = 'saved',
  saveErrorMessage = null,
  onRetrySave,
  cardMode = 'saldo',
  pendingTotal = 0,
  pendingCount = 0,
  eyebrow,
  title,
  onSeeDetails,
  onSyncNow,
  syncStatus = 'idle',
  syncMessage = '',
}: HeaderProps) => {
  const isSyncing = syncStatus === 'starting' || syncStatus === 'running';
  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  })();

  const shortMonthLabel = monthFilter === 'all'
    ? 'TODOS'
    : (MONTH_LABELS[Number(monthFilter.split('-')[1]) - 1] || '').toUpperCase();

  // Barra fininha só como referência visual da proporção gasto/entrada do
  // mês — não é um "orçamento" configurável, é só derivada dos totais que já
  // existem (income/expense), sem nenhum cálculo novo de negócio.
  const spentRatio = income > 0 ? Math.min(100, Math.round((expense / income) * 100)) : (expense > 0 ? 100 : 0);

  // Cada aba destaca um número diferente no cartão do topo, em vez do mesmo
  // Saldo repetido em toda tela — ver comentário de cardMode em HeaderProps.
  const cardCopy = {
    saldo: { label: 'Saldo', value: balance },
    gasto: { label: 'Gasto do mês', value: expense },
    pendente: { label: 'Total pendente', value: pendingTotal },
    none: { label: '', value: 0 },
  }[cardMode];


  const handleIndicatorClick = () => {
    if (saveStatus === 'error') {
      const msg = saveErrorMessage || 'Ocorreu uma falha ao tentar salvar as alterações automaticamente.';
      alert(`⚠️ Falha no salvamento:\n${msg}\n\nClique para tentar salvar novamente.`);
      if (onRetrySave) {
        onRetrySave();
      }
    }
  };

  const parsedFilterDate =
    convertedFilterDate ||
    (() => {
      const [year, month] = monthFilter.split('-').map(Number);
      return new Date(year || new Date().getFullYear(), (month || 1) - 1, 1);
    })();

  return (
    <header className="mb-8 space-y-4">
      {/* Saudação + ações rápidas */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-slate-400 dark:text-slate-500 text-xs font-semibold">{eyebrow ?? greeting}</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-tight">
            {title ?? (userName || 'Financy')}
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Mês (pill compacta) */}
          <div className="flex items-center glass rounded-full">
            <button
              type="button"
              onClick={() => {
                if (monthFilter === 'all') {
                  const now = new Date();
                  setMonthFilter(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
                  return;
                }
                const [y, m] = monthFilter.split('-').map(Number);
                const date = new Date(y, m - 2, 1);
                setMonthFilter(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
              }}
              className="p-1.5 pl-2.5 rounded-l-full text-slate-400 dark:text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95"
              title="Mês Anterior"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <DatePicker
              selected={monthFilter === 'all' ? null : parsedFilterDate}
              onChange={(date: Date | null) => {
                if (date) {
                  setMonthFilter(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
                }
              }}
              dateFormat="MM/yyyy"
              showMonthYearPicker
              locale="pt-BR"
              popperPlacement="bottom-end"
              renderCustomHeader={(headerProps) => <CustomYearHeader {...headerProps} />}
              customInput={
                <button
                  type="button"
                  className="px-1 py-1.5 text-slate-800 dark:text-slate-200 text-xs font-bold hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-1 transition cursor-pointer group active:scale-95 justify-center"
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={monthFilter}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 6 }}
                      transition={{ duration: 0.15 }}
                    >
                      {shortMonthLabel}
                    </motion.span>
                  </AnimatePresence>
                  <ChevronDown className="w-3 h-3 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors shrink-0" />
                </button>
              }
            />

            <button
              type="button"
              onClick={() => {
                if (monthFilter === 'all') {
                  const now = new Date();
                  setMonthFilter(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
                  return;
                }
                const [y, m] = monthFilter.split('-').map(Number);
                const date = new Date(y, m, 1);
                setMonthFilter(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
              }}
              className="p-1.5 pr-2.5 rounded-r-full text-slate-400 dark:text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95"
              title="Próximo Mês"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {onOpenOrbita && (
            <button
              type="button"
              onClick={onOpenOrbita}
              className="w-9 h-9 rounded-full glass text-[#F2415A] flex items-center justify-center transition active:scale-95 shrink-0"
              aria-label="Abrir o Órbita"
              title="Abrir o Órbita"
            >
              <Orbit className="w-4 h-4" />
            </button>
          )}

          {onSyncNow && (
            <button
              type="button"
              onClick={() => onSyncNow()}
              disabled={isSyncing}
              className="w-9 h-9 rounded-full glass text-slate-700 dark:text-slate-200 flex items-center justify-center transition active:scale-95 shrink-0 disabled:opacity-70"
              aria-label="Sincronizar bancos agora"
              title="Sincronizar bancos agora"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            </button>
          )}

          {/* Nova transação */}
          {onOpenNewTransaction && (
            <button
              type="button"
              onClick={onOpenNewTransaction}
              className="w-9 h-9 rounded-full glass text-slate-900 dark:text-white flex items-center justify-center transition active:scale-95 shrink-0"
              title="Nova transação"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}

        </div>
      </div>

      {/* Barra de status (salvamento / permissão do overlay) — some quando tudo ok e não há nada a avisar */}
      <div className="flex items-center flex-wrap gap-1.5">
          {saveStatus === 'saving' && (
            <span
              className="inline-flex items-center gap-1.5 px-2 py-1 sm:px-2.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 transition-all cursor-wait shadow-sm"
              title="Gravando alterações..."
            >
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
              </span>
              <span className="hidden sm:inline">Salvando...</span>
            </span>
          )}

          {saveStatus === 'error' && (
            <button
              type="button"
              onClick={handleIndicatorClick}
              className="inline-flex items-center gap-1.5 px-2 py-1 sm:px-2.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 active:scale-95 transition-all cursor-pointer shadow-sm"
              title="Clique para ver o erro e tentar novamente"
            >
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
              </span>
              <span className="hidden sm:inline">Erro ao salvar</span>
            </button>
          )}

          {saveStatus === 'local' && (
            <span
              className="inline-flex items-center gap-1.5 px-2 py-1 sm:px-2.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25 transition-all shadow-sm"
              title="Salvo no armazenamento local deste dispositivo (sem conexão à internet)"
            >
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
              <span className="hidden sm:inline">Salvo localmente (sem conexão)</span>
            </span>
          )}

          {syncStatus !== 'idle' && syncMessage && (
            <span
              role="status"
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-2xl max-w-full text-left text-[11px] leading-snug font-semibold border ${
                syncStatus === 'error'
                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                  : syncStatus === 'done'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                  : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
              }`}
            >
              {syncMessage}
            </span>
          )}

          {/* Alterna pra visão "Todos os meses" (mesma função de sempre, só reposicionada) */}
          <button
            type="button"
            onClick={() => {
              if (monthFilter === 'all') {
                const now = new Date();
                setMonthFilter(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
              } else {
                setMonthFilter('all');
              }
            }}
            className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition shrink-0 ${
              monthFilter === 'all'
                ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent'
            }`}
            title={monthFilter === 'all' ? 'Voltar para o mês atual' : 'Ver todos os meses'}
          >
            {monthFilter === 'all' ? 'Mês atual' : 'Todos'}
          </button>
      </div>

      {/* Cartão do topo — número em destaque muda por aba (ver cardMode) */}
      {cardMode !== 'none' && (
        <div className="relative bg-[#1c1c1e] text-white rounded-[28px] p-5 pb-7 sm:p-6 sm:pb-8 shadow-xl shadow-black/10">
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-bold uppercase tracking-wider">
            <span>{cardCopy.label}</span>
            <span>{cardMode === 'pendente' ? `${pendingCount} pendente${pendingCount === 1 ? '' : 's'}` : shortMonthLabel}</span>
          </div>

          <div className="mt-1.5">
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight tabular-nums">
              R$ {Number(cardCopy.value || 0).toFixed(2).replace('.', ',')}
            </h2>
            {cardMode === 'saldo' && previousMonthBalance !== null && previousMonthBalance !== undefined && (
              <span
                className="inline-flex items-center gap-1 w-fit mt-1"
                title="Saldo acumulado até o fim do mês anterior"
              >
                <History className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                <span className="text-[11px] font-mono text-slate-400 tracking-tight">
                  mês anterior: R$ {previousMonthBalance.toFixed(2).replace('.', ',')}
                </span>
              </span>
            )}
          </div>

          {(cardMode === 'saldo' || cardMode === 'gasto') && (
            <>
              <div className="mt-3.5 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-400 transition-all"
                  style={{ width: `${spentRatio}%` }}
                />
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Entradas</p>
                  <p className="font-semibold text-sm text-white tabular-nums">
                    R$ {income.toFixed(2).replace('.', ',')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Saídas</p>
                  <p className="font-semibold text-sm text-white tabular-nums">
                    R$ {expense.toFixed(2).replace('.', ',')}
                  </p>
                </div>
              </div>
            </>
          )}

          {onSeeDetails && (
            <button
              type="button"
              onClick={onSeeDetails}
              className="absolute left-1/2 -bottom-3 -translate-x-1/2 px-4 py-1.5 rounded-full glass text-slate-600 dark:text-slate-300 text-[11px] font-semibold active:scale-95 transition"
            >
              Ver detalhes
            </button>
          )}
        </div>
      )}
    </header>
  );
};

export default memo(Header);
