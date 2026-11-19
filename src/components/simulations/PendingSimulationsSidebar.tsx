import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Clock, 
  X, 
  CheckCircle2, 
  DollarSign, 
  Sparkles, 
  TrendingUp,
  AlertCircle,
  Trash2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Check,
  Edit2,
  Copy
} from 'lucide-react';

export interface DailyBreakdownItem {
  id: string;
  dayName: string;
  date: string;
  amount: number;
  horaInicio?: string;
  horaFim?: string;
  adicional?: number;
}

export interface PendingSimulation {
  id: string;
  amount: number;
  date: string;
  weekLabel?: string;
  dailyBreakdown?: DailyBreakdownItem[];
}

interface PendingSimulationsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  simulations: PendingSimulation[];
  onMarkAsReceived: (
    id: string,
    amount: number,
    date?: string,
    receivedDayIds?: string[],
    customDescription?: string
  ) => void;
  onRemoveSimulation?: (id: string) => void;
  onReceiveAll?: () => void;
  onEditSimulation?: (simulation: PendingSimulation) => void;
}

const formatDateISO = (d: Date) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export default function PendingSimulationsSidebar({
  isOpen,
  onClose,
  simulations,
  onMarkAsReceived,
  onRemoveSimulation,
  onReceiveAll,
  onEditSimulation,
}: PendingSimulationsSidebarProps) {
  const totalPendente = simulations.reduce((acc, sim) => acc + sim.amount, 0);
  const [showConfirmReceiveAll, setShowConfirmReceiveAll] = React.useState(false);
  const [simulationToDelete, setSimulationToDelete] = React.useState<PendingSimulation | null>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [nomeWhatsApp, setNomeWhatsApp] = React.useState<string>(() => {
    try { return localStorage.getItem('financas_whatsapp_nome') || ''; } catch { return ''; }
  });

  const handleChangeNome = (valor: string) => {
    setNomeWhatsApp(valor);
    try { localStorage.setItem('financas_whatsapp_nome', valor); } catch { /* ignora */ }
  };

  /** "Nome (12/07)" -> "Nome ( 12/07 )", igual ao padrão enviado. */
  const formatDayNameSpacing = (dayName: string) =>
    dayName.replace(/\((\d{2}\/\d{2})\)/, '( $1 )');

  /** Monta o texto no estilo WhatsApp a partir de uma lista de dias + total. */
  const buildWhatsAppText = (dias: DailyBreakdownItem[], total: number): string => {
    const linhas = dias.map((d) => {
      const valorFormatado = Number.isInteger(d.amount)
        ? `R$${d.amount}`
        : `R$${d.amount.toFixed(2).replace('.', ',')}`;
      const nomeFormatado = formatDayNameSpacing(d.dayName);
      if (d.horaInicio && d.horaFim) {
        const adicionalTxt = d.adicional ? ` + ${d.adicional}` : '';
        return `- ${nomeFormatado} das ${d.horaInicio} as ${d.horaFim}${adicionalTxt} = *${valorFormatado}*`;
      }
      return `- ${nomeFormatado} = *${valorFormatado}*`;
    });

    const totalFormatado = total.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    const header = nomeWhatsApp.trim() ? [nomeWhatsApp.trim(), ''] : [];
    return [...header, ...linhas, '', `Total = R$ ${totalFormatado}`].join('\n');
  };

  const copyToClipboard = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      // Fallback pra navegadores/webviews sem permissão de clipboard moderna
      const textarea = document.createElement('textarea');
      textarea.value = texto;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      try { document.execCommand('copy'); } catch { /* ignora */ }
      document.body.removeChild(textarea);
    }
  };

  const handleCopySimulation = async (sim: PendingSimulation) => {
    const dias = sim.dailyBreakdown && sim.dailyBreakdown.length > 0
      ? sim.dailyBreakdown
      : [{ id: sim.id, dayName: sim.weekLabel || 'Recebimento', date: sim.date, amount: sim.amount }];
    await copyToClipboard(buildWhatsAppText(dias, sim.amount));
    setCopiedId(sim.id);
    setTimeout(() => setCopiedId((curr) => (curr === sim.id ? null : curr)), 2000);
  };

  /** Junta TODAS as simulações pendentes num texto só, ordenado por data, com
   *  um total geral — pro caso comum de somar várias semanas antes de mandar
   *  pro chefe (igual o exemplo: 3 semanas diferentes num total único). */
  const handleCopyAll = async () => {
    const todosDias = simulations
      .flatMap((sim) =>
        sim.dailyBreakdown && sim.dailyBreakdown.length > 0
          ? sim.dailyBreakdown
          : [{ id: sim.id, dayName: sim.weekLabel || 'Recebimento', date: sim.date, amount: sim.amount }]
      )
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    await copyToClipboard(buildWhatsAppText(todosDias, totalPendente));
    setCopiedId('__all__');
    setTimeout(() => setCopiedId((curr) => (curr === '__all__' ? null : curr)), 2000);
  };
  const [simulationToReceive, setSimulationToReceive] = React.useState<PendingSimulation | null>(null);
  const [selectedDayIds, setSelectedDayIds] = React.useState<string[]>([]);
  const [receiveDate, setReceiveDate] = React.useState<string>(() => formatDateISO(new Date()));
  const [calendarViewDate, setCalendarViewDate] = React.useState<Date>(() => new Date());

  const selectedTotalAmount = React.useMemo(() => {
    if (!simulationToReceive) return 0;
    if (!simulationToReceive.dailyBreakdown || simulationToReceive.dailyBreakdown.length === 0) {
      return simulationToReceive.amount;
    }
    return simulationToReceive.dailyBreakdown
      .filter(d => selectedDayIds.includes(d.id))
      .reduce((acc, d) => acc + d.amount, 0);
  }, [simulationToReceive, selectedDayIds]);

  const receiveCalendarGrid = React.useMemo(() => {
    const year = calendarViewDate.getFullYear();
    const month = calendarViewDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    let startDayOfWeek = firstDay.getDay() - 1; // Mon = 0
    if (startDayOfWeek < 0) startDayOfWeek = 6; // Sun = 6

    const grid: { date: Date; currentMonth: boolean }[] = [];

    for (let i = startDayOfWeek; i > 0; i--) {
      grid.push({ date: new Date(year, month, 1 - i), currentMonth: false });
    }
    for (let i = 1; i <= lastDay.getDate(); i++) {
      grid.push({ date: new Date(year, month, i), currentMonth: true });
    }
    const remaining = 7 - (grid.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        grid.push({ date: new Date(year, month + 1, i), currentMonth: false });
      }
    }
    return grid;
  }, [calendarViewDate]);

  const handleOpenReceiveModal = (sim: PendingSimulation) => {
    setSimulationToReceive(sim);
    if (sim.dailyBreakdown && sim.dailyBreakdown.length > 0) {
      setSelectedDayIds(sim.dailyBreakdown.map(d => d.id));
    } else {
      setSelectedDayIds([]);
    }
    const initialDate = sim.date || formatDateISO(new Date());
    setReceiveDate(initialDate);
    const parts = initialDate.split('-').map(Number);
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      setCalendarViewDate(new Date(parts[0], parts[1] - 1, parts[2] || 1));
    } else {
      setCalendarViewDate(new Date());
    }
  };

  const handleConfirmReceive = () => {
    if (!simulationToReceive) return;

    let desc = simulationToReceive.weekLabel
      ? `Freelance - ${simulationToReceive.weekLabel}`
      : 'Receita Freelance';

    if (simulationToReceive.dailyBreakdown && simulationToReceive.dailyBreakdown.length > 0) {
      const selectedDays = simulationToReceive.dailyBreakdown.filter(d => selectedDayIds.includes(d.id));
      if (selectedDays.length > 0) {
        const dayList = selectedDays.map(d => d.dayName).join(', ');
        desc = `Freelance (${dayList})${simulationToReceive.weekLabel ? ` - ${simulationToReceive.weekLabel}` : ''}`;
      }
    }

    onMarkAsReceived(
      simulationToReceive.id,
      selectedTotalAmount,
      receiveDate,
      selectedDayIds,
      desc
    );
    setSimulationToReceive(null);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Overlay Background */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            onClick={onClose}
          />

          {/* Drawer Sidebar */}
          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10 pointer-events-none">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
              className="w-screen max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between shadow-2xl pointer-events-auto relative overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Soft Ambient Light */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex-1 overflow-hidden flex flex-col relative z-10">
                {/* Header */}
                <div className="flex items-center justify-between pb-5 border-b border-slate-200 dark:border-slate-800 mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-950/50 text-slate-950 font-black">
                      <Clock className="w-5 h-5 text-slate-950" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        Freelances Pendentes
                        {simulations.length > 0 && (
                          <span className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                            {simulations.length}
                          </span>
                        )}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Valores a receber aguardando confirmação
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={onClose}
                    className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-center transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Total Summary KPI */}
                {simulations.length > 0 && (
                  <div className="bg-gradient-to-r from-amber-50 via-white to-white dark:from-amber-950/40 dark:via-slate-900 dark:to-slate-900 border border-amber-500/30 p-4 rounded-2xl mb-4 shadow-md space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-amber-600/90 dark:text-amber-300/80 block">
                          Total Pendente a Receber
                        </span>
                        <span className="text-2xl font-black text-amber-700 dark:text-amber-300 font-mono tracking-tight">
                          {totalPendente.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </span>
                      </div>

                      {onReceiveAll && (
                        <button
                          onClick={() => setShowConfirmReceiveAll(true)}
                          className="px-3.5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-emerald-950/40 flex items-center justify-center gap-1.5 transform active:scale-95 cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                          <span>Receber Tudo ({simulations.length})</span>
                        </button>
                      )}
                    </div>

                    {/* Nome pro cabeçalho da mensagem + Copiar Tudo (junta todas as
                        semanas pendentes num texto só, com um total geral) */}
                    <div className="pt-3 border-t border-amber-500/10 flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={nomeWhatsApp}
                        onChange={(e) => handleChangeNome(e.target.value)}
                        placeholder="Nome (aparece no topo da mensagem)"
                        className="flex-1 bg-white/80 dark:bg-slate-950/80 text-slate-800 dark:text-slate-200 text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
                      />
                      <button
                        onClick={handleCopyAll}
                        title="Copia todas as semanas pendentes juntas, com um total geral"
                        className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition shadow-md flex items-center justify-center gap-1.5 transform active:scale-95 cursor-pointer border ${
                          copiedId === '__all__'
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                            : 'bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        {copiedId === '__all__' ? (
                          <>
                            <Check className="w-4 h-4" />
                            <span>Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            <span>Copiar Tudo p/ WhatsApp</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Pending Items List */}
                {simulations.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-4 shadow-inner">
                      <Clock className="w-8 h-8" />
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 font-medium text-sm mb-1">
                      Nenhum ganho pendente
                    </p>
                    <p className="text-slate-400 dark:text-slate-500 text-xs max-w-xs">
                      Use a calculadora para planejar e registrar suas diárias de freelance.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 overflow-y-auto pr-1 flex-1 custom-scrollbar">
                    {simulations.map((sim) => (
                      <div
                        key={sim.id}
                        className="bg-white/80 dark:bg-slate-900/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-amber-500/40 transition-all duration-200 shadow-sm space-y-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-1.5 mb-1">
                              {sim.weekLabel && (
                                <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300">
                                  {sim.weekLabel}
                                </span>
                              )}
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-mono">
                                Previsto: {sim.date}
                              </span>
                            </div>
                            <span className="font-mono text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight block">
                              {sim.amount.toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {onRemoveSimulation && (
                              <button
                                onClick={() => setSimulationToDelete(sim)}
                                title="Excluir pendência"
                                className="p-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 hover:border-rose-500/40 transition flex items-center justify-center transform active:scale-95 cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleOpenReceiveModal(sim)}
                              className="px-3.5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-emerald-950/40 flex items-center gap-1.5 transform active:scale-95 cursor-pointer"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Receber</span>
                            </button>
                          </div>
                        </div>

                        {/* Editar / Copiar (formato WhatsApp) */}
                        <div className="flex items-center gap-2">
                          {onEditSimulation && (
                            <button
                              onClick={() => onEditSimulation(sim)}
                              title="Editar esta simulação"
                              className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-700 transition flex items-center justify-center gap-1.5 text-[11px] font-semibold transform active:scale-95 cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              Editar
                            </button>
                          )}
                          <button
                            onClick={() => handleCopySimulation(sim)}
                            title="Copiar texto formatado (pra enviar no WhatsApp)"
                            className={`flex-1 px-3 py-2 rounded-xl border transition flex items-center justify-center gap-1.5 text-[11px] font-semibold transform active:scale-95 cursor-pointer ${
                              copiedId === sim.id
                                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                                : 'bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-700'
                            }`}
                          >
                            {copiedId === sim.id ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                Copiado!
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                Copiar p/ WhatsApp
                              </>
                            )}
                          </button>
                        </div>

                        {/* Sub-lista de dias (se houver detalhamento diário) */}
                        {sim.dailyBreakdown && sim.dailyBreakdown.length > 0 && (
                          <div className="pt-2.5 border-t border-slate-200 dark:border-slate-800">
                            <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider block mb-1.5">
                              Diárias Pendentes ({sim.dailyBreakdown.length} {sim.dailyBreakdown.length === 1 ? 'dia' : 'dias'}):
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {sim.dailyBreakdown.map((day) => (
                                <span
                                  key={day.id}
                                  className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 flex items-center gap-1"
                                >
                                  <span className="text-amber-600 dark:text-amber-400 font-bold">{day.dayName.split(' ')[0]}:</span>
                                  <span>{day.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Confirmation Modal: Receive Single Simulation */}
              <AnimatePresence>
                {simulationToReceive && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 10 }}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar"
                    >
                      <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
                        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                          <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Confirmar Recebimento</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Escolha os dias e a data do recebimento.</p>
                        </div>
                      </div>

                      <div className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                          <span className="text-slate-500 dark:text-slate-400 font-medium">Ref.:</span>
                          <span className="text-emerald-700 dark:text-emerald-300 font-bold text-right">
                            {simulationToReceive.weekLabel ? `Freelance - ${simulationToReceive.weekLabel}` : 'Receita Freelance'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 dark:text-slate-400 font-medium">Total Pendente:</span>
                          <span className="text-amber-600 dark:text-amber-400 font-black text-sm font-mono">
                            {simulationToReceive.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </span>
                        </div>
                      </div>

                      {/* Seleção de Dias Específicos (se houver detalhamento diário) */}
                      {simulationToReceive.dailyBreakdown && simulationToReceive.dailyBreakdown.length > 0 && (
                        <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                              <CheckSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              Quais dias você está recebendo?
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                if (selectedDayIds.length === simulationToReceive.dailyBreakdown?.length) {
                                  setSelectedDayIds([]);
                                } else {
                                  setSelectedDayIds(simulationToReceive.dailyBreakdown?.map(d => d.id) || []);
                                }
                              }}
                              className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                            >
                              {selectedDayIds.length === simulationToReceive.dailyBreakdown.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                            </button>
                          </div>

                          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
                            {simulationToReceive.dailyBreakdown.map(day => {
                              const isChecked = selectedDayIds.includes(day.id);
                              return (
                                <button
                                  key={day.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedDayIds(prev =>
                                      prev.includes(day.id) ? prev.filter(id => id !== day.id) : [...prev, day.id]
                                    );
                                  }}
                                  className={`w-full flex items-center justify-between p-2 rounded-lg border text-xs font-medium transition cursor-pointer ${
                                    isChecked
                                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <div className={`w-4 h-4 rounded flex items-center justify-center transition ${isChecked ? 'bg-emerald-500 text-slate-950' : 'border border-slate-300 dark:border-slate-700'}`}>
                                      {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                                    </div>
                                    <span>{day.dayName}</span>
                                  </div>
                                  <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300">
                                    {day.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                  </span>
                                </button>
                              );
                            })}
                          </div>

                          <div className="flex items-center justify-between pt-1.5 text-xs border-t border-slate-200 dark:border-slate-800">
                            <span className="text-slate-500 dark:text-slate-400 font-medium">Valor a Lançar:</span>
                            <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                              {selectedTotalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Mini Calendário Estilizado */}
                      <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                          <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                            <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span className="text-xs font-black capitalize">
                              {calendarViewDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setCalendarViewDate(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() - 1, 1))}
                              className="p-1 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition border border-slate-200 dark:border-slate-800 cursor-pointer"
                              title="Mês anterior"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const today = new Date();
                                setCalendarViewDate(today);
                                setReceiveDate(formatDateISO(today));
                              }}
                              className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 transition cursor-pointer"
                            >
                              Hoje
                            </button>
                            <button
                              type="button"
                              onClick={() => setCalendarViewDate(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + 1, 1))}
                              className="p-1 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition border border-slate-200 dark:border-slate-800 cursor-pointer"
                              title="Próximo mês"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Cabeçalho dias da semana */}
                        <div className="grid grid-cols-7 gap-1 text-center">
                          {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d, i) => (
                            <span key={d} className={`text-[9px] font-extrabold uppercase ${i === 6 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'}`}>
                              {d}
                            </span>
                          ))}
                        </div>

                        {/* Grade de dias */}
                        <div className="grid grid-cols-7 gap-1">
                          {receiveCalendarGrid.map((item, index) => {
                            const itemISO = formatDateISO(item.date);
                            const isSelected = itemISO === receiveDate;
                            const isToday = itemISO === formatDateISO(new Date());

                            return (
                              <button
                                key={index}
                                type="button"
                                onClick={() => setReceiveDate(itemISO)}
                                className={`py-1.5 text-xs font-mono font-bold rounded-lg transition flex flex-col items-center justify-center cursor-pointer ${
                                  isSelected
                                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-950/50 scale-105 z-10'
                                    : item.currentMonth
                                    ? 'bg-white/80 dark:bg-slate-900/80 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
                                    : 'bg-slate-50 dark:bg-slate-950 text-slate-400 dark:text-slate-500 hover:bg-white dark:hover:bg-slate-900'
                                }`}
                              >
                                <span>{item.date.getDate()}</span>
                                {isToday && (
                                  <span className={`w-1 h-1 rounded-full mt-0.5 ${isSelected ? 'bg-white dark:bg-slate-900' : 'bg-emerald-400'}`} />
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {/* Data Selecionada Display */}
                        <div className="flex items-center justify-between pt-1 text-[11px] border-t border-slate-200 dark:border-slate-800">
                          <span className="text-slate-500 dark:text-slate-400 font-medium">Data do Recebimento:</span>
                          <span className="font-mono text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            {receiveDate ? receiveDate.split('-').reverse().join('/') : '-'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setSimulationToReceive(null)}
                          className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          disabled={selectedTotalAmount <= 0}
                          onClick={handleConfirmReceive}
                          className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition shadow-md shadow-emerald-950/40 active:scale-95 cursor-pointer ${
                            selectedTotalAmount > 0
                              ? 'bg-emerald-600 hover:bg-emerald-500'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          Confirmar Recebimento ({selectedTotalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
                        </button>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

              {/* Confirmation Modal: Receive All */}
              <AnimatePresence>
                {showConfirmReceiveAll && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 10 }}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl"
                    >
                      <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
                        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                          <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Receber Todos os Ganhos?</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Adiciona {simulations.length} ganhos às suas transações.</p>
                        </div>
                      </div>

                      <div className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1 font-mono">
                        <div className="text-slate-500 dark:text-slate-400 text-[11px]">Valor Total a Lançar:</div>
                        <div className="text-emerald-600 dark:text-emerald-400 font-black text-lg">
                          {totalPendente.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowConfirmReceiveAll(false)}
                          className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (onReceiveAll) onReceiveAll();
                            setShowConfirmReceiveAll(false);
                          }}
                          className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition shadow-md shadow-emerald-950/40 active:scale-95"
                        >
                          Confirmar Recebimento
                        </button>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

              {/* Confirmation Modal: Delete Pending Simulation */}
              <AnimatePresence>
                {simulationToDelete && (
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
                          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Excluir Ganho Pendente?</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400">A simulação será removida sem lançar na conta.</p>
                        </div>
                      </div>

                      <div className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 font-mono flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400 font-bold">{simulationToDelete.date}</span>
                        <span className="text-amber-700 dark:text-amber-300 font-black text-base">
                          {simulationToDelete.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setSimulationToDelete(null)}
                          className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (onRemoveSimulation) onRemoveSimulation(simulationToDelete.id);
                            setSimulationToDelete(null);
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

              {/* Footer */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 relative z-10">
                <button
                  onClick={onClose}
                  className="w-full py-3 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold transition"
                >
                  Fechar Painel
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}

