/**
 * Notificações locais do Financy (só no app do iPhone): lembretes de vencimento das faturas
 * dos cartões e das dívidas planejadas. No navegador não existem: tudo aqui vira no-op.
 */
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

export const notifAvailable = Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('LocalNotifications');
export type NotifPerm = 'granted' | 'denied' | 'prompt' | 'unavailable';

const PREF = 'financy.lembretes';
const CARD_BASE = 7000;
const DEBT_BASE = 8000;

export function lembretesOn(): boolean {
  try {
    return localStorage.getItem(PREF) !== '0';
  } catch {
    return true;
  }
}
export function setLembretes(on: boolean) {
  try {
    localStorage.setItem(PREF, on ? '1' : '0');
  } catch {
    // sem armazenamento: fica ligado
  }
}

export async function notifPermission(): Promise<NotifPerm> {
  if (!notifAvailable) return 'unavailable';
  const p = await LocalNotifications.checkPermissions();
  return p.display === 'granted' ? 'granted' : p.display === 'denied' ? 'denied' : 'prompt';
}

export async function askNotifPermission(): Promise<NotifPerm> {
  if (!notifAvailable) return 'unavailable';
  const p = await LocalNotifications.requestPermissions();
  return p.display === 'granted' ? 'granted' : 'denied';
}

/** Manda uma notificação de teste em 3 segundos. */
export async function testNotification(): Promise<string> {
  if (!notifAvailable) throw new Error('Notificações só funcionam no app do iPhone.');
  if ((await askNotifPermission()) !== 'granted') throw new Error('Notificações bloqueadas nos Ajustes do iPhone.');
  await LocalNotifications.schedule({
    notifications: [{ id: 6999, title: 'Financy', body: 'Teste de notificação: tudo certo.', schedule: { at: new Date(Date.now() + 3000) } }],
  });
  return 'Enviada: deve chegar em 3 segundos';
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Reagenda os lembretes: fatura de cada cartão (um dia antes do vencimento, 9h, todo mês) e cada
 * dívida planejada com data (um dia antes, 9h). Chamado quando cartões ou dívidas mudam.
 */
export async function scheduleBillReminders(
  cards: { id: string; name: string; dueDay: number }[],
  debts: { description: string; amount: number; dueDate?: string }[],
): Promise<number> {
  if (!notifAvailable || (await notifPermission()) !== 'granted') return 0;
  const pending = await LocalNotifications.getPending();
  const nossos = pending.notifications.filter((n) => n.id >= CARD_BASE && n.id < DEBT_BASE + 1000);
  if (nossos.length) await LocalNotifications.cancel({ notifications: nossos.map((n) => ({ id: n.id })) });
  if (!lembretesOn()) return 0;

  const list: Parameters<typeof LocalNotifications.schedule>[0]['notifications'] = [];
  cards.slice(0, 50).forEach((c, i) => {
    const due = Math.min(Math.max(Math.round(c.dueDay) || 0, 1), 31);
    if (!due) return;
    const vesp = due > 1;
    list.push({
      id: CARD_BASE + i,
      title: `Fatura do ${c.name}`,
      body: vesp ? `Vence amanhã (dia ${due}).` : 'Vence hoje.',
      schedule: { on: { day: vesp ? due - 1 : due, hour: 9, minute: 0 }, allowWhileIdle: true },
    });
  });
  const agora = Date.now();
  debts.slice(0, 200).forEach((d, i) => {
    if (!d.dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(d.dueDate)) return;
    const [y, m, dd] = d.dueDate.split('-').map(Number);
    const at = new Date(y, m - 1, dd - 1, 9, 0, 0);
    if (at.getTime() <= agora) return;
    list.push({ id: DEBT_BASE + i, title: d.description || 'Conta a pagar', body: `${brl(d.amount)} vence amanhã.`, schedule: { at } });
  });
  if (list.length) await LocalNotifications.schedule({ notifications: list });
  return list.length;
}
