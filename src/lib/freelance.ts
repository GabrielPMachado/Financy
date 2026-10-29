import { isBrazilHoliday } from './holidays';

/**
 * Regras da calculadora freelancer (as mesmas da SimulacaoGanhosModal):
 * R$ 15/h das 11h às 22h e R$ 18/h fora disso; domingo e feriado pagam tudo a
 * R$ 18/h; mais R$ 20 de alimentação por dia (R$ 10 se comeu pizza).
 */
const HORA_DIURNA = 15;
const HORA_NOTURNA = 18;
const ALIMENTACAO_POR_DIA = 20;
const DESCONTO_PIZZA = 10;
const DIURNO_INICIO_H = 11;
const DIURNO_FIM_H = 22;

const DAY_IDS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'] as const;
const DAY_NAMES = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'] as const;

export interface DayBreakdown {
  id: string;
  dayName: string;
  date: string;
  amount: number;
  horaInicio?: string;
  horaFim?: string;
  adicional?: number;
}

export interface PendingWeek {
  id: string;
  amount: number;
  date: string;
  weekLabel?: string;
  dailyBreakdown?: DayBreakdown[];
}

/** Um trabalho enviado pelo Atalho do iPhone, esperando para entrar numa semana pendente. */
export interface QuickJob {
  id: string;
  /** AAAA-MM-DD */
  date: string;
  /** HH:MM */
  inicio: string;
  fim: string;
  comeuPizza: boolean;
}

const pad = (n: number): string => String(n).padStart(2, '0');
const toISO = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toDDMM = (d: Date): string => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;

function parseISO(dateISO: string): Date {
  const [y, m, d] = dateISO.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Horas decimais (ex: "18:30" = 18.5); termina no dia seguinte quando o fim é menor que o início. */
function hourRange(inicio: string, fim: string): { start: number; end: number } {
  const [inicioH, inicioM] = inicio.split(':').map(Number);
  const [fimH, fimM] = fim.split(':').map(Number);
  const start = inicioH + inicioM / 60;
  let end = fimH + fimM / 60;
  if (end < start) end += 24;
  return { start, end };
}

/** Ganho de um dia de trabalho, já com a alimentação. `adicional` é só a alimentação (R$ 20 ou R$ 10). */
export function calcularGanhoDia(params: {
  dateISO: string | undefined;
  isSunday: boolean;
  inicio: string;
  fim: string;
  comeuPizza: boolean;
}): { amount: number; adicional: number } {
  const { start, end } = hourRange(params.inicio, params.fim);

  let ganho: number;
  if (params.isSunday || isBrazilHoliday(params.dateISO)) {
    ganho = (end - start) * HORA_NOTURNA;
  } else {
    const diurnoStart = Math.max(start, DIURNO_INICIO_H);
    const diurnoEnd = Math.min(end, DIURNO_FIM_H);
    const horasDiurnas = diurnoEnd > diurnoStart ? diurnoEnd - diurnoStart : 0;
    const horasNoturnas = end - start - horasDiurnas;
    ganho = horasDiurnas * HORA_DIURNA + horasNoturnas * HORA_NOTURNA;
  }

  const adicional = params.comeuPizza ? ALIMENTACAO_POR_DIA - DESCONTO_PIZZA : ALIMENTACAO_POR_DIA;
  return { amount: ganho + adicional, adicional };
}

/** Segunda a domingo da semana de uma data, no formato que a calculadora usa. */
export function weekOf(dateISO: string): {
  mondayISO: string;
  sundayISO: string;
  weekLabel: string;
  dayId: string;
  dayName: string;
} {
  const date = parseISO(dateISO);
  const weekday = date.getDay(); // 0 = domingo
  const index = weekday === 0 ? 6 : weekday - 1;
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - index);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  return {
    mondayISO: toISO(monday),
    sundayISO: toISO(sunday),
    weekLabel: `Semana ${toDDMM(monday)} a ${toDDMM(sunday)}`,
    dayId: DAY_IDS[index],
    dayName: `${DAY_NAMES[index]} (${toDDMM(date)})`,
  };
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Um trabalho só vale com data e horários bem formados (vem de fora do app). */
export function isValidQuickJob(job: Partial<QuickJob>): job is QuickJob {
  return (
    typeof job.id === 'string' &&
    typeof job.date === 'string' && DATE_PATTERN.test(job.date) && !Number.isNaN(parseISO(job.date).getTime()) &&
    typeof job.inicio === 'string' && TIME_PATTERN.test(job.inicio) &&
    typeof job.fim === 'string' && TIME_PATTERN.test(job.fim) &&
    typeof job.comeuPizza === 'boolean'
  );
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * Coloca um trabalho na semana pendente dele (cria a semana se não existir).
 * Idempotente: o mesmo dia da semana é substituído, nunca somado em dobro.
 * Devolve uma nova lista, sem alterar a original.
 */
export function mergeJobIntoPending(pendings: readonly PendingWeek[], job: QuickJob): PendingWeek[] {
  const week = weekOf(job.date);
  const { amount, adicional } = calcularGanhoDia({
    dateISO: job.date,
    isSunday: week.dayId === 'dom',
    inicio: job.inicio,
    fim: job.fim,
    comeuPizza: job.comeuPizza,
  });
  const entry: DayBreakdown = {
    id: week.dayId,
    dayName: week.dayName,
    date: job.date,
    amount,
    horaInicio: job.inicio,
    horaFim: job.fim,
    adicional,
  };

  const existing = pendings.find((p) => p.weekLabel === week.weekLabel);
  // Semana antiga sem detalhamento por dia: o valor que ela já tinha continua somando.
  const untracked = existing ? existing.amount - (existing.dailyBreakdown ?? []).reduce((acc, d) => acc + d.amount, 0) : 0;
  const days = [...(existing?.dailyBreakdown ?? []).filter((d) => d.id !== entry.id), entry].sort(
    (a, b) => DAY_IDS.indexOf(a.id as (typeof DAY_IDS)[number]) - DAY_IDS.indexOf(b.id as (typeof DAY_IDS)[number])
  );
  const merged: PendingWeek = {
    id: existing?.id ?? `semana-${week.mondayISO}`,
    amount: round2(days.reduce((acc, d) => acc + d.amount, 0) + untracked),
    date: week.sundayISO,
    weekLabel: week.weekLabel,
    dailyBreakdown: days,
  };

  return existing ? pendings.map((p) => (p.id === existing.id ? merged : p)) : [merged, ...pendings];
}
