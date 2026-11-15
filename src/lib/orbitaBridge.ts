/**
 * Ponte com o Órbita (app de organização pessoal do iPhone).
 *
 *  - Links: financy://resumo e financy://novo?tipo=&valor=&descricao=&categoria=&data=
 *    (o Órbita abre o Financy assim; no site, os mesmos parâmetros vão em ?action=).
 *  - orbita://...  abre o Órbita a partir do Financy.
 *  - users/{uid}/comprasApplePay/{id}: o Órbita registra cada compra do Apple Pay com a
 *    categoria escolhida na hora. Quando a mesma compra chega pelo Open Finance (Pluggy),
 *    o Financy aplica essa categoria nela e apaga o aviso. Não cria lançamento novo, então
 *    nada é contado em dobro.
 */
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { collection, doc, onSnapshot, writeBatch, type Unsubscribe } from 'firebase/firestore';
import { db } from './firebase';

export const isNativeApp = Capacitor.isNativePlatform();
export const isIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent);

/** Abre o Órbita (no app nativo e no PWA do iPhone o iOS pergunta/abre direto). */
export function openOrbita(path: '' | 'financas' | 'foco' | 'checkin' = '') {
  window.location.href = `orbita://${path}`;
}

export interface FinancyAction {
  action: 'resumo' | 'quick-add';
  tipo?: 'income' | 'expense' | 'investment';
  valor?: string;
  descricao?: string;
  categoria?: string;
  data?: string;
}

/** Lê ?action=... (site/PWA) ou financy://acao?... (app nativo). */
export function parseAction(input: string | URLSearchParams): FinancyAction | null {
  let params: URLSearchParams;
  let action: string | null;
  if (typeof input === 'string') {
    const m = input.match(/^financy:\/\/([^?#/]*)\/?(?:\?([^#]*))?/i);
    if (!m) return null;
    params = new URLSearchParams(m[2] ?? '');
    action = params.get('action') ?? m[1];
  } else {
    params = input;
    action = params.get('action');
  }
  if (action === 'novo' || action === 'add') action = 'quick-add';
  if (action !== 'resumo' && action !== 'quick-add') return null;
  const tipo = params.get('tipo');
  return {
    action,
    tipo: tipo === 'income' || tipo === 'investment' ? tipo : 'expense',
    valor: params.get('valor') ?? undefined,
    descricao: params.get('descricao') ?? undefined,
    categoria: params.get('categoria') ?? undefined,
    data: params.get('data') ?? undefined,
  };
}

/** Links financy:// recebidos pelo app nativo (abertura a frio e com o app aberto). */
export function listenDeepLinks(onAction: (a: FinancyAction) => void): () => void {
  if (!isNativeApp) return () => {};
  let removed = false;
  const handle = (url?: string) => {
    const a = url ? parseAction(url) : null;
    if (a && !removed) onAction(a);
  };
  CapApp.getLaunchUrl()
    .then((r) => handle(r?.url))
    .catch(() => {});
  const sub = CapApp.addListener('appUrlOpen', (e) => handle(e.url));
  return () => {
    removed = true;
    sub.then((s) => s.remove()).catch(() => {});
  };
}

/* ---------- Compras do Apple Pay vindas do Órbita ---------- */

export interface ApplePayHint {
  id: string;
  valor: number;
  /** yyyy-MM-dd */
  data: string;
  /** HH:mm */
  hora?: string;
  estabelecimento?: string;
  cartao?: string;
  categoria: string;
  criadoEm?: string;
}

interface TxLike {
  id: string;
  type: string;
  amount: number;
  date: string;
  time?: string;
  category?: string;
  source?: string;
  applePayCategory?: boolean;
}

const HINTS = 'comprasApplePay';
const DAY = 86_400_000;
const dayDiff = (a: string, b: string) => Math.abs(new Date(`${a}T12:00:00`).getTime() - new Date(`${b}T12:00:00`).getTime()) / DAY;
const minutes = (t?: string) => (t && /^\d{1,2}:\d{2}/.test(t) ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) : null);

/**
 * Casa cada aviso com uma despesa importada do banco: mesmo valor, data até 2 dias
 * depois (o banco pode lançar no dia seguinte) e, havendo horário dos dois lados,
 * o mais próximo. Devolve os pares e os avisos vencidos (mais de 10 dias sem par).
 */
export function matchHints(hints: ApplePayHint[], txs: TxLike[], today = new Date().toISOString().slice(0, 10)) {
  const used = new Set<string>();
  const pairs: { hint: ApplePayHint; tx: TxLike }[] = [];
  const expired: ApplePayHint[] = [];
  for (const h of hints) {
    if (!h || !(h.valor > 0) || !h.data || !h.categoria) {
      expired.push(h);
      continue;
    }
    const candidates = txs.filter(
      (t) =>
        !used.has(t.id) &&
        t.type === 'expense' &&
        t.source === 'pluggy' &&
        !t.applePayCategory &&
        Math.abs(t.amount - h.valor) < 0.01 &&
        t.date >= h.data &&
        dayDiff(t.date, h.data) <= 2,
    );
    const hm = minutes(h.hora);
    candidates.sort((a, b) => {
      const da = dayDiff(a.date, h.data) * 1440 + (hm != null && minutes(a.time) != null ? Math.abs(minutes(a.time)! - hm) : 720);
      const db_ = dayDiff(b.date, h.data) * 1440 + (hm != null && minutes(b.time) != null ? Math.abs(minutes(b.time)! - hm) : 720);
      return da - db_;
    });
    const best = candidates[0];
    if (best) {
      used.add(best.id);
      pairs.push({ hint: h, tx: best });
    } else if (dayDiff(today, h.data) > 10) {
      expired.push(h);
    }
  }
  return { pairs, expired };
}

export function subscribeApplePayHints(uid: string, onHints: (h: ApplePayHint[]) => void): Unsubscribe {
  return onSnapshot(
    collection(db, 'users', uid, HINTS),
    (snap) => onHints(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ApplePayHint, 'id'>) }))),
    (error) => console.error('Erro ao ler as compras do Apple Pay:', error),
  );
}

/** Apaga da fila os avisos já aplicados ou vencidos. */
export async function clearApplePayHints(uid: string, ids: string[]): Promise<void> {
  if (!ids.length) return;
  const batch = writeBatch(db);
  ids.forEach((id) => batch.delete(doc(db, 'users', uid, HINTS, id)));
  await batch.commit();
}
