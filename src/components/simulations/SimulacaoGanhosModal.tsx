import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calculator, 
  Sparkles, 
  X, 
  Check, 
  Pizza, 
  Clock, 
  ArrowRight,
  RotateCcw,
  PlusCircle,
  CalendarDays,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square
} from 'lucide-react';
import { getHolidayName, isBrazilHoliday } from '../../lib/holidays';

// Helpers para manipular datas da semana (Segunda a Domingo)
function formatDateISO(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getMondayOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diffToMonday);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getDaysOfWeek(monday: Date) {
  const ids = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
  const nomes = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];
  const abrevs = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  return ids.map((id, index) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + index);
    return {
      id,
      nome: nomes[index],
      abrev: abrevs[index],
      date: d,
      dateISO: formatDateISO(d),
      dateFormatted: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      destaque: id === 'dom',
    };
  });
}

interface TimePickerProps {
  value: string;
  onChange: (val: string) => void;
}

const TimePicker: React.FC<TimePickerProps> = ({ value, onChange }) => {
  const [hora, minuto] = value ? value.split(':') : ['', ''];

  const handleHoraChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(`${e.target.value}:${minuto || '00'}`);
  };

  const handleMinutoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(`${hora || '00'}:${e.target.value}`);
  };

  const horas = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const minutos = ['00', '15', '30', '45'];

  return (
    <div className="flex items-center gap-1 bg-white/80 dark:bg-slate-950/80 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
      <select
        value={hora}
        onChange={handleHoraChange}
        className="bg-transparent text-slate-900 dark:text-slate-100 text-xs font-mono font-bold rounded-lg px-2 py-1 focus:bg-white dark:focus:bg-slate-900 focus:outline-none cursor-pointer"
      >
        <option value="" disabled className="bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400">HH</option>
        {horas.map(h => <option key={h} value={h} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">{h}h</option>)}
      </select>
      <span className="text-slate-400 dark:text-slate-500 text-xs font-bold">:</span>
      <select
        value={minuto}
        onChange={handleMinutoChange}
        className="bg-transparent text-slate-900 dark:text-slate-100 text-xs font-mono font-bold rounded-lg px-2 py-1 focus:bg-white dark:focus:bg-slate-900 focus:outline-none cursor-pointer"
      >
        <option value="" disabled className="bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400">MM</option>
        {minutos.map(m => <option key={m} value={m} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">{m}m</option>)}
      </select>
    </div>
  );
};

export interface DailyBreakdownItem {
  id: string;
  dayName: string;
  date: string;
  amount: number;
  /** Novo: preservados pra permitir editar depois e montar o texto de cópia
   *  com o mesmo formato "das HH:MM as HH:MM". */
  horaInicio?: string;
  horaFim?: string;
  adicional?: number;
}

interface DiaInfo {
  inicio: string;
  fim: string;
  comeuPizza: boolean;
}

interface SimulacaoGanhosModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    amount: number;
    date: string;
    weekLabel: string;
    dailyBreakdown?: DailyBreakdownItem[];
    editingId?: string;
  }) => void;
  /** Se preenchido, o modal abre já carregado com os dias/horários dessa
   *  simulação pendente (em vez de começar do zero), pro botão "Editar". */
  editingSimulation?: {
    id: string;
    dailyBreakdown?: DailyBreakdownItem[];
  } | null;
}

export default function SimulacaoGanhosModal({ isOpen, onClose, onSave, editingSimulation }: SimulacaoGanhosModalProps) {
  const [diasTrabalhados, setDiasTrabalhados] = useState<Record<string, DiaInfo>>(() => {
    if (editingSimulation?.dailyBreakdown) {
      const inicial: Record<string, DiaInfo> = {};
      editingSimulation.dailyBreakdown.forEach((item) => {
        if (item.horaInicio && item.horaFim) {
          inicial[item.id] = {
            inicio: item.horaInicio,
            fim: item.horaFim,
            comeuPizza: (item.adicional ?? 20) < 20,
          };
        }
      });
      return inicial;
    }
    return {};
  });
  const [resultado, setResultado] = useState<number | null>(() => {
    if (editingSimulation?.dailyBreakdown && editingSimulation.dailyBreakdown.length > 0) {
      return editingSimulation.dailyBreakdown.reduce((acc, d) => acc + d.amount, 0);
    }
    return null;
  });

  // Estado da semana selecionada
  const [selectedMonday, setSelectedMonday] = useState<Date>(() => {
    if (editingSimulation?.dailyBreakdown && editingSimulation.dailyBreakdown.length > 0) {
      const primeiraData = editingSimulation.dailyBreakdown
        .map((d) => d.date)
        .filter(Boolean)
        .sort()[0];
      if (primeiraData) {
        const [y, m, d] = primeiraData.split('-').map(Number);
        return getMondayOfWeek(new Date(y, m - 1, d));
      }
    }
    return getMondayOfWeek(new Date());
  });
  const [calendarViewDate, setCalendarViewDate] = useState<Date>(() => new Date());
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);

  // Lista dos 7 dias da semana selecionada
  const diasDaSemanaComData = useMemo(() => {
    return getDaysOfWeek(selectedMonday);
  }, [selectedMonday]);

  // Data default para recebimento é o Domingo da semana selecionada
  const domingoDataISO = useMemo(() => {
    const dom = new Date(selectedMonday);
    dom.setDate(selectedMonday.getDate() + 6);
    return formatDateISO(dom);
  }, [selectedMonday]);

  const todosSelecionados = useMemo(() => {
    return diasDaSemanaComData.length > 0 && diasDaSemanaComData.every(dia => !!diasTrabalhados[dia.id]);
  }, [diasDaSemanaComData, diasTrabalhados]);

  if (!isOpen) return null;

  const handleResetModal = () => {
    setDiasTrabalhados({});
    setResultado(null);
    setSelectedMonday(getMondayOfWeek(new Date()));
    onClose();
  };

  const handleSalvarPendencia = () => {
    if (resultado && resultado > 0) {
      const valorHoraDiurna = 15;
      const valorHoraNoturna = 18;
      const alimentacaoPorDia = 20;

      const breakdown: DailyBreakdownItem[] = [];

      diasDaSemanaComData.forEach(diaMatch => {
        const info = diasTrabalhados[diaMatch.id];
        if (!info || !info.inicio || !info.fim) return;

        const { inicio, fim, comeuPizza } = info;

        const [inicioH, inicioM] = inicio.split(':').map(Number);
        const [fimH, fimM] = fim.split(':').map(Number);

        const inicioTotal = inicioH + (inicioM / 60);
        let fimTotal = fimH + (fimM / 60);

        if (fimTotal < inicioTotal) fimTotal += 24;

        let ganhoDia = 0;
        // Domingo e feriado pagam todas as horas pelo valor noturno (R$ 18/h).
        if (diaMatch.id === 'dom' || isBrazilHoliday(diaMatch.dateISO)) {
          const horasTrabalhadas = fimTotal - inicioTotal;
          ganhoDia = horasTrabalhadas * valorHoraNoturna;
        } else {
          const periodoDiurnoInicio = 11;
          const periodoDiurnoFim = 22;
          let horasDiurnas = 0;

          const diurnoInicio = Math.max(inicioTotal, periodoDiurnoInicio);
          const diurnoFim = Math.min(fimTotal, periodoDiurnoFim);

          if (diurnoFim > diurnoInicio) horasDiurnas = diurnoFim - diurnoInicio;

          const horasNoturnas = (fimTotal - inicioTotal) - horasDiurnas;
          ganhoDia = (horasDiurnas * valorHoraDiurna) + (horasNoturnas * valorHoraNoturna);
        }

        let ganhoDoDiaComAlimentacao = ganhoDia + alimentacaoPorDia;
        if (comeuPizza) ganhoDoDiaComAlimentacao -= 10;

        breakdown.push({
          id: diaMatch.id,
          dayName: `${diaMatch.nome} (${diaMatch.dateFormatted})`,
          date: diaMatch.dateISO,
          amount: ganhoDoDiaComAlimentacao,
          horaInicio: inicio,
          horaFim: fim,
          adicional: comeuPizza ? alimentacaoPorDia - 10 : alimentacaoPorDia,
        });
      });

      const weekLabel = `Semana ${diasDaSemanaComData[0].dateFormatted} a ${diasDaSemanaComData[6].dateFormatted}`;
      onSave({
        amount: resultado,
        date: domingoDataISO,
        weekLabel,
        dailyBreakdown: breakdown,
        editingId: editingSimulation?.id,
      });
      handleResetModal();
    }
  };

  const handleSelectWeek = (dateInWeek: Date) => {
    const monday = getMondayOfWeek(dateInWeek);
    setSelectedMonday(monday);
    setResultado(null);
  };

  const handleToggleAllWeekDays = () => {
    if (todosSelecionados) {
      setDiasTrabalhados({});
      setResultado(null);
    } else {
      const todos: Record<string, DiaInfo> = {};
      diasDaSemanaComData.forEach(dia => {
        todos[dia.id] = diasTrabalhados[dia.id] || { inicio: '12:00', fim: '20:00', comeuPizza: false };
      });
      setDiasTrabalhados(todos);
      setResultado(null);
    }
  };

  const handleDayChange = (diaId: string) => {
    setDiasTrabalhados(prev => {
      const novoEstado = { ...prev };
      if (novoEstado[diaId]) {
        delete novoEstado[diaId];
      } else {
        novoEstado[diaId] = { inicio: '12:00', fim: '20:00', comeuPizza: false };
      }
      return novoEstado;
    });
    setResultado(null);
  };

  const handleTimeChange = (diaId: string, tipo: keyof DiaInfo, valor: any) => {
    setDiasTrabalhados(prev => ({
      ...prev,
      [diaId]: { ...prev[diaId], [tipo]: valor }
    }));
    setResultado(null);
  };

  const calcularGanhos = () => {
    let ganhoTotal = 0;
    const valorHoraDiurna = 15;
    const valorHoraNoturna = 18;
    const alimentacaoPorDia = 20;

    for (const diaId in diasTrabalhados) {
      const { inicio, fim, comeuPizza } = diasTrabalhados[diaId];
      if (!inicio || !fim) continue;

      const [inicioH, inicioM] = inicio.split(':').map(Number);
      const [fimH, fimM] = fim.split(':').map(Number);

      const inicioTotal = inicioH + (inicioM / 60);
      let fimTotal = fimH + (fimM / 60);

      if (fimTotal < inicioTotal) fimTotal += 24;

      let ganhoDia = 0;
      // Domingo e feriado pagam todas as horas pelo valor noturno (R$ 18/h).
      const dataDoDia = diasDaSemanaComData.find((d) => d.id === diaId)?.dateISO;
      if (diaId === 'dom' || isBrazilHoliday(dataDoDia)) {
        const horasTrabalhadas = fimTotal - inicioTotal;
        ganhoDia = horasTrabalhadas * valorHoraNoturna;
      } else {
        const periodoDiurnoInicio = 11;
        const periodoDiurnoFim = 22;
        let horasDiurnas = 0;

        const diurnoInicio = Math.max(inicioTotal, periodoDiurnoInicio);
        const diurnoFim = Math.min(fimTotal, periodoDiurnoFim);

        if (diurnoFim > diurnoInicio) horasDiurnas = diurnoFim - diurnoInicio;

        const horasNoturnas = (fimTotal - inicioTotal) - horasDiurnas;
        ganhoDia = (horasDiurnas * valorHoraDiurna) + (horasNoturnas * valorHoraNoturna);
      }

      let ganhoDoDiaComAlimentacao = ganhoDia + alimentacaoPorDia;
      if (comeuPizza) ganhoDoDiaComAlimentacao -= 10;

      ganhoTotal += ganhoDoDiaComAlimentacao;
    }
    setResultado(ganhoTotal);
  };

  const totalDiasSelecionados = Object.keys(diasTrabalhados).length;

  // Renderizador do Calendário Mês/Semana Estilizado
  const renderStylizedCalendar = () => {
    const year = calendarViewDate.getFullYear();
    const month = calendarViewDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // Ajuste para a semana começar na Segunda-feira (1)
    let startDayOfWeek = firstDayOfMonth.getDay(); // 0 = Domingo, 1 = Segunda
    const leadingDays = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

    const daysInMonth = lastDayOfMonth.getDate();

    // Dias do mês anterior para preencher a grade
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    const calendarGrid: { date: Date; currentMonth: boolean }[] = [];

    for (let i = leadingDays - 1; i >= 0; i--) {
      calendarGrid.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        currentMonth: false,
      });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      calendarGrid.push({
        date: new Date(year, month, i),
        currentMonth: true,
      });
    }

    // Completa os dias do próximo mês para fechar semanas completas (múltiplo de 7)
    const remainingDays = 7 - (calendarGrid.length % 7);
    if (remainingDays < 7) {
      for (let i = 1; i <= remainingDays; i++) {
        calendarGrid.push({
          date: new Date(year, month + 1, i),
          currentMonth: false,
        });
      }
    }

    const monthName = firstDayOfMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    // Segunda e Domingo da semana atualmente selecionada
    const currentMondayISO = formatDateISO(selectedMonday);
    const currentSunday = new Date(selectedMonday);
    currentSunday.setDate(selectedMonday.getDate() + 6);
    const currentSundayISO = formatDateISO(currentSunday);

    // Segunda e Domingo da semana sobre a qual o mouse está passando (hover)
    let hoverMondayISO: string | null = null;
    let hoverSundayISO: string | null = null;
    if (hoveredDate) {
      const hMon = getMondayOfWeek(hoveredDate);
      hoverMondayISO = formatDateISO(hMon);
      const hSun = new Date(hMon);
      hSun.setDate(hMon.getDate() + 6);
      hoverSundayISO = formatDateISO(hSun);
    }

    return (
      <div className="bg-white/90 dark:bg-slate-900/90 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 mb-5 relative overflow-hidden shadow-xl">
        {/* Top bar do Calendário */}
        <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <Calendar className="w-4 h-4" />
            </div>
            <span className="text-sm font-black text-slate-900 dark:text-slate-100 capitalize tracking-wide">
              {monthName}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCalendarViewDate(new Date(year, month - 1, 1))}
              className="p-1.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition border border-slate-200 dark:border-slate-800 cursor-pointer"
              title="Mês anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                const today = new Date();
                setCalendarViewDate(today);
                handleSelectWeek(today);
              }}
              className="px-2.5 py-1.5 text-[11px] font-bold rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 transition cursor-pointer"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => setCalendarViewDate(new Date(year, month + 1, 1))}
              className="p-1.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition border border-slate-200 dark:border-slate-800 cursor-pointer"
              title="Próximo mês"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Cabeçalho dos dias da semana (Seg a Dom) */}
        <div className="grid grid-cols-7 gap-1.5 text-center mb-2">
          {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d, i) => (
            <span key={d} className={`text-[10px] font-extrabold uppercase tracking-widest ${i === 6 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`}>
              {d}
            </span>
          ))}
        </div>

        {/* Grade de dias do Mês */}
        <div className="grid grid-cols-7 gap-1.5">
          {calendarGrid.map((item, index) => {
            const dateISO = formatDateISO(item.date);

            const isSelectedWeek = dateISO >= currentMondayISO && dateISO <= currentSundayISO;
            const isHoveredWeek = hoverMondayISO && hoverSundayISO && dateISO >= hoverMondayISO && dateISO <= hoverSundayISO;
            const isToday = dateISO === formatDateISO(new Date());
            const isMonday = item.date.getDay() === 1;
            const isSunday = item.date.getDay() === 0;

            return (
              <button
                key={index}
                type="button"
                onMouseEnter={() => setHoveredDate(item.date)}
                onMouseLeave={() => setHoveredDate(null)}
                onClick={() => handleSelectWeek(item.date)}
                className={`py-2.5 text-xs font-mono font-bold transition-all relative flex flex-col items-center justify-center cursor-pointer ${
                  isSelectedWeek
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-950/50 scale-[1.02] z-10'
                    : isHoveredWeek
                    ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40'
                    : item.currentMonth
                    ? 'bg-white/80 dark:bg-slate-900/80 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
                    : 'bg-slate-50 dark:bg-slate-950 text-slate-400 dark:text-slate-500 hover:bg-white dark:hover:bg-slate-900 border border-transparent'
                } ${isMonday && isSelectedWeek ? 'rounded-l-xl' : ''} ${isSunday && isSelectedWeek ? 'rounded-r-xl' : 'rounded-lg'}`}
              >
                <span>{item.date.getDate()}</span>
                {isToday && (
                  <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${isSelectedWeek ? 'bg-white dark:bg-slate-900' : 'bg-emerald-400 ring-2 ring-emerald-500/40'}`} />
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between px-1 pt-2 border-t border-slate-200 dark:border-slate-800">
          <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
            💡 Selecione qualquer dia para definir a semana.
          </span>
          <span className="font-mono text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-500/20">
            {diasDaSemanaComData[0].dateFormatted} a {diasDaSemanaComData[6].dateFormatted}
          </span>
        </div>
      </div>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto"
          onClick={handleResetModal}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 320 }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-7 rounded-3xl w-full max-w-xl shadow-2xl my-8 relative max-h-[90vh] overflow-y-auto custom-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Soft Ambient Glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-4 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-950/50 text-white">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    {editingSimulation ? 'Editar Simulação' : 'Calculadora Freelancer'}
                    <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {editingSimulation
                      ? 'Ajuste os horários e valores desta semana já salva'
                      : 'Selecione a semana no calendário e configure suas diárias e horários'}
                  </p>
                </div>
              </div>

              <button
                onClick={handleResetModal}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Calendário Estilizado Selecionador de Semana */}
            {renderStylizedCalendar()}

            {/* Ações Rápidas de Seleção da Semana */}
            <div className="flex items-center justify-between gap-2 mb-3 relative z-10">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Dias da Semana ({diasDaSemanaComData[0].dateFormatted} à {diasDaSemanaComData[6].dateFormatted})</span>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleAllWeekDays}
                  className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border transition flex items-center gap-1.5 cursor-pointer ${
                    todosSelecionados
                      ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30'
                      : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                  }`}
                >
                  {todosSelecionados ? <Square className="w-3.5 h-3.5" /> : <CheckSquare className="w-3.5 h-3.5" />}
                  <span>{todosSelecionados ? 'Desmarcar Semana Toda' : 'Marcar Semana Toda'}</span>
                </button>
              </div>
            </div>

            {/* Days Selection List */}
            <div className="space-y-2.5 mb-5 max-h-[300px] overflow-y-auto pr-1 relative z-10 custom-scrollbar">
              {diasDaSemanaComData.map(dia => {
                const isChecked = !!diasTrabalhados[dia.id];
                const diaData = diasTrabalhados[dia.id];

                return (
                  <div
                    key={dia.id}
                    className={`p-3 rounded-2xl border transition-all duration-200 ${
                      isChecked
                        ? 'bg-white/90 dark:bg-slate-900/90 border-emerald-500/40 shadow-md shadow-emerald-950/20'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      {/* Checkbox and Day Label with Specific Date */}
                      <label className="flex items-center space-x-3 cursor-pointer group select-none">
                        <div
                          onClick={() => handleDayChange(dia.id)}
                          className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${
                            isChecked
                              ? 'bg-emerald-500 border-emerald-400 text-slate-950 shadow-xs'
                              : 'border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-slate-950/80 group-hover:border-slate-400 dark:group-hover:border-slate-600'
                          }`}
                        >
                          {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs sm:text-sm font-semibold transition ${
                              isChecked ? 'text-slate-900 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200'
                            }`}
                          >
                            {dia.nome}
                          </span>
                          <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-800">
                            {dia.dateFormatted}
                          </span>
                          {dia.destaque && (
                            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                              Dom 100%
                            </span>
                          )}
                          {getHolidayName(dia.dateISO) && (
                            <span
                              title={getHolidayName(dia.dateISO) ?? undefined}
                              className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                            >
                              Feriado 100%
                            </span>
                          )}
                        </div>
                      </label>

                      {/* Time Controls & Pizza Toggle */}
                      {isChecked && diaData && (
                        <motion.div
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-center justify-center flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 p-2 rounded-xl border border-slate-200 dark:border-slate-800"
                        >
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                            <TimePicker
                              value={diaData.inicio}
                              onChange={v => handleTimeChange(dia.id, 'inicio', v)}
                            />
                            <span className="text-slate-400 dark:text-slate-500 font-medium">até</span>
                            <TimePicker
                              value={diaData.fim}
                              onChange={v => handleTimeChange(dia.id, 'fim', v)}
                            />
                          </div>

                          {/* Pizza Toggle Centralizado */}
                          <div className="flex items-center justify-center sm:border-l sm:border-slate-200 dark:sm:border-slate-800 sm:pl-2">
                            <button
                              type="button"
                              title={diaData.comeuPizza ? 'Comer pizza ativado (-R$10.00)' : 'Clique se comeu pizza (-R$10.00)'}
                              onClick={() => handleTimeChange(dia.id, 'comeuPizza', !diaData.comeuPizza)}
                              className={`px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                                diaData.comeuPizza
                                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-700 dark:text-amber-300 shadow-xs'
                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
                              }`}
                            >
                              <Pizza className={`w-3.5 h-3.5 ${diaData.comeuPizza ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'}`} />
                              <span>{diaData.comeuPizza ? 'Pizza (-R$10)' : 'Pizza'}</span>
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Calculated Result Card */}
            {resultado !== null && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-r from-emerald-50 via-teal-50 to-white dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-slate-900 border border-emerald-200 dark:border-emerald-800/50 p-4 rounded-2xl text-center mb-5 relative overflow-hidden shadow-lg shadow-emerald-950/40"
              >
                <div className="flex justify-between items-center px-2">
                  <div className="text-left">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600/90 dark:text-emerald-300/80 block">
                      Estimativa Freelance ({totalDiasSelecionados} {totalDiasSelecionados === 1 ? 'dia' : 'dias'})
                    </span>
                    <span className="text-2xl font-black text-emerald-700 dark:text-emerald-300 font-mono tracking-tight">
                      {resultado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-700 dark:text-emerald-300">
                    <Sparkles className="w-5 h-5" />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center gap-3 justify-end pt-3 border-t border-slate-200 dark:border-slate-800 relative z-10">
              {totalDiasSelecionados > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setDiasTrabalhados({});
                    setResultado(null);
                  }}
                  className="mr-auto text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 flex items-center gap-1 py-2 px-1 transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Limpar seleção</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleResetModal}
                className="py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold transition cursor-pointer"
              >
                Cancelar
              </button>

              {resultado !== null && resultado > 0 ? (
                <button
                  type="button"
                  onClick={handleSalvarPendencia}
                  className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-600 hover:from-amber-400 hover:to-emerald-500 text-white text-xs font-bold transition shadow-lg shadow-emerald-950/50 flex items-center gap-2 transform active:scale-95 cursor-pointer"
                >
                  <Clock className="w-4 h-4" />
                  <span>Adicionar aos Pendentes</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={calcularGanhos}
                  disabled={totalDiasSelecionados === 0}
                  className={`py-2.5 px-5 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-lg ${
                    totalDiasSelecionados > 0
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-950/50 transform active:scale-95 cursor-pointer'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Calculator className="w-4 h-4" />
                  <span>Calcular Valor</span>
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
