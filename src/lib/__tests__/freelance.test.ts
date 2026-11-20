import { describe, expect, it } from 'vitest';
import { calcularGanhoDia, isValidQuickJob, mergeJobIntoPending, weekOf, type QuickJob } from '../freelance';

const dia = (dateISO: string, inicio: string, fim: string, extra: Partial<{ isSunday: boolean; comeuPizza: boolean }> = {}) =>
  calcularGanhoDia({ dateISO, inicio, fim, isSunday: false, comeuPizza: false, ...extra });

describe('calcularGanhoDia', () => {
  it('divide as horas entre diurnas (R$ 15) e noturnas (R$ 18) e soma a alimentação', () => {
    // 09–11 noturno (2 h × 18) + 11–13 diurno (2 h × 15) + 20 de alimentação
    expect(dia('2026-11-18', '09:00', '13:00')).toEqual({ amount: 86, adicional: 20 });
  });

  it('atravessa a meia-noite', () => {
    // 20–22 diurno (2 h × 15) + 22–02 noturno (4 h × 18) + 20
    expect(dia('2026-11-18', '20:00', '02:00').amount).toBe(122);
  });

  it('domingo paga tudo a R$ 18/h e a pizza desconta R$ 10', () => {
    expect(dia('2026-11-22', '12:00', '14:00', { isSunday: true })).toEqual({ amount: 56, adicional: 20 });
    expect(dia('2026-11-22', '12:00', '14:00', { isSunday: true, comeuPizza: true })).toEqual({ amount: 46, adicional: 10 });
  });

  it('feriado paga como domingo', () => {
    // 20/11 (Consciência Negra), uma sexta
    expect(dia('2026-11-20', '12:00', '14:00').amount).toBe(56);
    // 03/04/2026 é Sexta-feira Santa (móvel)
    expect(dia('2026-04-03', '12:00', '14:00').amount).toBe(56);
  });
});

describe('weekOf', () => {
  it('acha a segunda e o domingo da semana', () => {
    expect(weekOf('2026-11-20')).toEqual({
      mondayISO: '2026-11-16',
      sundayISO: '2026-11-22',
      weekLabel: 'Semana 16/11 a 22/11',
      dayId: 'sex',
      dayName: 'Sexta-feira (20/11)',
    });
  });

  it('domingo fecha a semana (não abre a próxima)', () => {
    expect(weekOf('2026-11-22').mondayISO).toBe('2026-11-16');
    expect(weekOf('2026-11-22').dayId).toBe('dom');
  });

  it('semana que vira o mês', () => {
    expect(weekOf('2026-12-02').weekLabel).toBe('Semana 30/11 a 06/12');
  });
});

describe('isValidQuickJob', () => {
  const ok: QuickJob = { id: 'a', date: '2026-11-18', inicio: '09:00', fim: '13:00', comeuPizza: false };
  it('aceita um trabalho bem formado', () => expect(isValidQuickJob(ok)).toBe(true));
  it.each([
    ['data sem zero', { date: '2026-1-8' }],
    ['hora 24', { fim: '24:00' }],
    ['minuto 60', { inicio: '09:60' }],
    ['pizza como texto', { comeuPizza: 'sim' as unknown as boolean }],
    ['sem id', { id: undefined }],
  ])('recusa %s', (_, mudanca) => expect(isValidQuickJob({ ...ok, ...mudanca })).toBe(false));
});

describe('mergeJobIntoPending', () => {
  const seg: QuickJob = { id: '1', date: '2026-11-16', inicio: '09:00', fim: '13:00', comeuPizza: false };
  const qua: QuickJob = { id: '2', date: '2026-11-18', inicio: '12:00', fim: '14:00', comeuPizza: true };

  it('cria a semana pendente do trabalho', () => {
    const [semana, ...resto] = mergeJobIntoPending([], seg);
    expect(resto).toHaveLength(0);
    expect(semana.weekLabel).toBe('Semana 16/11 a 22/11');
    expect(semana.amount).toBe(86);
  });

  it('é idempotente: o mesmo dia enviado duas vezes não soma em dobro', () => {
    const uma = mergeJobIntoPending([], seg);
    const duas = mergeJobIntoPending(uma, seg);
    expect(duas).toHaveLength(1);
    expect(duas[0].amount).toBe(86);
  });

  it('soma dias diferentes da mesma semana, em ordem', () => {
    const lista = mergeJobIntoPending(mergeJobIntoPending([], qua), seg);
    expect(lista).toHaveLength(1);
    // quarta: 2 h × 15 + 10 (pizza) = 40
    expect(lista[0].amount).toBe(126);
    expect(lista[0].dailyBreakdown?.map((d) => d.id)).toEqual(['seg', 'qua']);
  });

  it('não altera a lista original', () => {
    const original = mergeJobIntoPending([], seg);
    const copia = JSON.parse(JSON.stringify(original));
    mergeJobIntoPending(original, qua);
    expect(original).toEqual(copia);
  });
});
