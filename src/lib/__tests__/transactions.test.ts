import { describe, expect, it } from 'vitest';
import { compareNewestFirst, formatDateTime } from '../transactions';
import { getHolidayName, isBrazilHoliday } from '../holidays';

describe('compareNewestFirst', () => {
  it('ordena por data e hora, mais recente primeiro; sem hora conta como 00:00', () => {
    const lista = [
      { id: 'a', date: '2026-11-10', time: '09:00' },
      { id: 'b', date: '2026-11-10' },
      { id: 'c', date: '2026-11-11', time: '08:00' },
      { id: 'd', date: '2026-11-10', time: '18:30' },
    ];
    expect([...lista].sort(compareNewestFirst).map((t) => t.id)).toEqual(['c', 'd', 'a', 'b']);
  });
});

describe('formatDateTime', () => {
  it('formata no padrão brasileiro', () => {
    expect(formatDateTime('2026-10-09', '14:32')).toBe('09/10/2026 · 14:32');
    expect(formatDateTime('2026-10-09')).toBe('09/10/2026');
    expect(formatDateTime()).toBe('');
  });
});

describe('feriados', () => {
  it('fixos, estaduais e a Sexta-feira Santa (móvel)', () => {
    expect(getHolidayName('2026-12-25')).toBe('Natal');
    expect(getHolidayName('2026-09-20')).toBe('Dia do Gaúcho (RS)');
    expect(getHolidayName('2025-04-18')).toBe('Sexta-feira Santa');
    expect(getHolidayName('2026-04-03')).toBe('Sexta-feira Santa');
  });
  it('dia comum e data inválida não são feriado', () => {
    expect(isBrazilHoliday('2026-11-18')).toBe(false);
    expect(isBrazilHoliday('')).toBe(false);
    expect(isBrazilHoliday(undefined)).toBe(false);
  });
});
