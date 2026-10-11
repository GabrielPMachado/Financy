#!/usr/bin/env node
/**
 * Sincroniza transações dos bancos (via Open Finance / MeuPluggy) para o
 * Firestore do Financy.
 *
 *   node scripts/sync-pluggy.mjs          -> lê da Pluggy e grava no Firestore
 *   node scripts/sync-pluggy.mjs --dry    -> só lê da Pluggy e mostra um resumo
 *
 * Variáveis de ambiente (arquivo .env.local localmente; Secrets no GitHub):
 *   PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET, PLUGGY_ITEM_IDS (separados por vírgula)
 *   FIREBASE_SERVICE_ACCOUNT  JSON da conta de serviço (inteiro, numa variável)
 *   SYNC_USER_EMAIL           e-mail da conta do Financy que recebe os dados
 *   SYNC_FROM                 (opcional) só importa transações a partir desta data
 *                             (AAAA-MM-DD). Padrão: 2026-10-01
 *
 * Segurança: o script nunca imprime segredos nem valores/descrições de
 * transações no log — só contagens. Os logs do GitHub Actions podem ser públicos.
 */
import { readFileSync } from 'node:fs';

try {
  process.loadEnvFile('.env.local');
} catch {
  // Sem .env.local (ex: GitHub Actions): usa só as variáveis do ambiente.
}

const PLUGGY_API = 'https://api.pluggy.ai';
const DRY_RUN = process.argv.includes('--dry');
const SYNC_FROM = /^\d{4}-\d{2}-\d{2}$/.test(process.env.SYNC_FROM || '') ? process.env.SYNC_FROM : '2026-10-01';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Variável de ambiente ausente: ${name}`);
    process.exit(1);
  }
  return value;
}

async function pluggy(path, apiKey, params = {}) {
  const url = new URL(path, PLUGGY_API);
  Object.entries(params).forEach(([k, v]) => v !== undefined && url.searchParams.set(k, String(v)));
  const res = await fetch(url, { headers: { 'X-API-KEY': apiKey, accept: 'application/json' } });
  if (!res.ok) throw new Error(`Pluggy ${path} respondeu ${res.status}`);
  return res.json();
}

async function authenticate(clientId, clientSecret) {
  const res = await fetch(`${PLUGGY_API}/auth`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ clientId, clientSecret }),
  });
  if (!res.ok) throw new Error(`Autenticação na Pluggy falhou (${res.status}). Confira o Client ID/Secret.`);
  return (await res.json()).apiKey;
}

async function fetchAllTransactions(apiKey, accountId, from, to) {
  // Endpoint v2 (o /transactions antigo foi desativado pela Pluggy).
  // Paginação por cursor: `next` vem preenchido quando há mais resultados.
  const all = [];
  let cursor;
  for (let page = 0; page < 20; page++) {
    const data = await pluggy('/v2/transactions', apiKey, { accountId, dateFrom: from, dateTo: to, cursor });
    all.push(...data.results);
    if (!data.next || data.results.length === 0) return all;
    cursor = data.next;
  }
  console.warn('Aviso: limite de páginas atingido; avance SYNC_FROM se faltar algo.');
  return all;
}

// --- Data e hora (fuso de Brasília) -----------------------------------------
// A Pluggy devolve timestamps em UTC (ex: 2026-10-09T01:45:59Z). Cortar os 10
// primeiros caracteres joga compras das 22h–23h59 para o dia seguinte; por isso
// convertemos para America/Sao_Paulo e guardamos também o horário (HH:MM).

const BR_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

/** Retorna { date: 'AAAA-MM-DD', time?: 'HH:MM' }. Datas sem hora real (meia-noite UTC) ficam sem horário. */
function toBrazilDateTime(value) {
  const raw = String(value);
  if (raw.length <= 10 || /T00:00:00(\.0+)?Z?$/.test(raw)) return { date: raw.slice(0, 10) };
  const parts = Object.fromEntries(BR_FORMAT.formatToParts(new Date(raw)).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

// --- Conversão Pluggy -> modelo do Financy ----------------------------------

const CATEGORY_KEYWORDS = [
  [['food', 'restaur', 'grocer', 'supermarket', 'aliment', 'mercado'], 'Alimentação'],
  [['transport', 'taxi', 'ride', 'fuel', 'gas station', 'combust', 'uber'], 'Transporte'],
  [['health', 'pharma', 'saúde', 'saude', 'farm'], 'Saúde'],
  [['education', 'school', 'educa'], 'Educação'],
  [['entertain', 'leisure', 'streaming', 'lazer', 'subscription'], 'Lazer'],
  [['rent', 'housing', 'utilities', 'moradia', 'condom'], 'Moradia'],
];

function pickCategory(pluggyCategory, isIncome) {
  if (isIncome) return 'Outras Receitas';
  const text = String(pluggyCategory || '').toLowerCase();
  const hit = CATEGORY_KEYWORDS.find(([keys]) => keys.some((k) => text.includes(k)));
  return hit ? hit[1] : 'Outras Despesas';
}

const CARD_PAYMENT_PATTERN = /pagamento.*fatura|fatura.*cart[aã]o/i;

/** Retorna null para o que não deve virar lançamento (pagamentos/estornos no cartão). */
function toFinancyTransaction(tx, account, cardIdForPayments) {
  const isCreditCard = account.type === 'CREDIT';
  // No cartão, compras vêm como DEBIT; CREDIT são pagamentos de fatura/estornos,
  // que já aparecem como saída na conta corrente — ignorar evita contar em dobro.
  if (isCreditCard && tx.type === 'CREDIT') return null;
  const isIncome = !isCreditCard && tx.type === 'CREDIT';
  const base = {
    description: String(tx.description || 'Sem descrição').trim().slice(0, 120),
    amount: Math.round(Math.abs(Number(tx.amount)) * 100) / 100,
    type: isIncome ? 'income' : 'expense',
    category: pickCategory(tx.category, isIncome),
    ...toBrazilDateTime(tx.date),
    source: 'pluggy',
  };
  if (isCreditCard) base.cardId = `pluggy-${account.id}`;
  // Saída da conta pagando a fatura: segue a regra do app (reduz o "usado" do cartão).
  if (!isCreditCard && !isIncome && cardIdForPayments && CARD_PAYMENT_PATTERN.test(base.description)) {
    base.category = 'Pagamento de Fatura';
    base.cardPaymentFor = cardIdForPayments;
  }
  return { id: `pluggy-${tx.id}`, collection: isIncome ? 'receitas' : 'despesas', data: base };
}

function toFinancyCard(account, bankName) {
  const credit = account.creditData || {};
  const dueDay = credit.balanceDueDate ? Number(String(credit.balanceDueDate).slice(8, 10)) : 10;
  const closingDay = ((dueDay - 7 - 1 + 31) % 31) + 1; // estimativa: fecha ~7 dias antes do vencimento
  return {
    id: `pluggy-${account.id}`,
    data: {
      name: account.name || 'Cartão',
      bank: bankName,
      lastDigits: String(account.number || '').slice(-4),
      limit: Number(credit.creditLimit) || 0,
      closingDay,
      dueDay,
      color: 'purple',
      source: 'pluggy',
    },
  };
}

// --- Saldos de abertura ------------------------------------------------------
// O app só conhece as transações a partir de SYNC_FROM, mas as contas já tinham
// dinheiro (e o cartão já tinha fatura) nessa data. Os lançamentos abaixo
// completam a conta: abertura = saldo atual do banco - movimento desde SYNC_FROM.

const round2 = (n) => Math.round(n * 100) / 100;

function openingBalanceEntry(account, bankName, netSinceStart) {
  const opening = round2(Number(account.balance) - netSinceStart);
  if (Math.abs(opening) < 0.005) return null;
  const isIncome = opening > 0;
  return {
    id: `pluggy-saldo-inicial-${account.id}`,
    collection: isIncome ? 'receitas' : 'despesas',
    otherCollection: isIncome ? 'despesas' : 'receitas',
    data: {
      description: `Saldo inicial — ${bankName}`,
      amount: Math.abs(opening),
      type: isIncome ? 'income' : 'expense',
      category: 'Saldo inicial',
      date: SYNC_FROM,
      source: 'pluggy',
    },
  };
}

/** Fatura que já existia em SYNC_FROM: usado hoje = compras desde a data - pagamentos + fatura anterior. */
function openingCardEntry(account, purchases, payments) {
  const credit = account.creditData || {};
  const limit = Number(credit.creditLimit) || 0;
  const available = Number(credit.availableCreditLimit);
  const usedNow = Number.isFinite(available) && limit > 0 ? limit - available : Number(account.balance) || 0;
  const previous = round2(usedNow - purchases + payments);
  if (previous < 0.005) return null;
  return {
    id: `pluggy-fatura-anterior-${account.id}`,
    collection: 'despesas',
    otherCollection: 'receitas',
    data: {
      description: 'Fatura anterior do cartão',
      amount: previous,
      type: 'expense',
      category: 'Outras Despesas',
      date: SYNC_FROM,
      source: 'pluggy',
      cardId: `pluggy-${account.id}`,
    },
  };
}

/** Sempre regrava (o valor depende do saldo de hoje) e limpa a cópia na coleção oposta. */
async function upsertOpenings(db, userRef, openings) {
  for (const entry of openings) {
    await userRef.collection(entry.collection).doc(entry.id).set(entry.data);
    await userRef.collection(entry.otherCollection).doc(entry.id).delete();
  }
}

// --- Firestore --------------------------------------------------------------

async function openFirestore() {
  const { initializeApp, cert } = await import('firebase-admin/app');
  const { getAuth } = await import('firebase-admin/auth');
  const { getFirestore } = await import('firebase-admin/firestore');

  const serviceAccount = JSON.parse(requireEnv('FIREBASE_SERVICE_ACCOUNT'));
  const app = initializeApp({ credential: cert(serviceAccount) });
  const config = JSON.parse(readFileSync(new URL('../firebase-applet-config.json', import.meta.url), 'utf8'));
  const dbId = config.firestoreDatabaseId;
  const db = dbId && dbId !== '(default)' ? getFirestore(app, dbId) : getFirestore(app);

  const user = await getAuth(app).getUserByEmail(requireEnv('SYNC_USER_EMAIL'));
  return { db, uid: user.uid };
}

/** Grava só o que ainda não existe (não sobrescreve edições feitas no app). */
let backfilled = 0;

async function createMissing(db, colRef, items) {
  if (items.length === 0) return 0;
  const refs = items.map((i) => colRef.doc(i.id));
  const snaps = await db.getAll(...refs);
  const batch = db.batch();
  let created = 0;
  let touched = false;
  snaps.forEach((snap, idx) => {
    const { time, date, source } = items[idx].data;
    if (!snap.exists) {
      batch.set(refs[idx], items[idx].data);
      created++;
      touched = true;
    } else if (source === 'pluggy' && time && !snap.get('time')) {
      // Lançamento importado antes de existir horário: completa só data e hora
      // (não mexe em descrição/categoria que você tenha editado no app).
      batch.update(refs[idx], { date, time });
      backfilled++;
      touched = true;
    }
  });
  if (touched) await batch.commit();
  return created;
}

/**
 * Apaga importações antigas da Pluggy anteriores a SYNC_FROM. Só toca em
 * documentos marcados com `source: 'pluggy'` — nunca em lançamentos criados
 * à mão no app.
 */
async function pruneOldImports(db, colRef) {
  const snap = await colRef.where('source', '==', 'pluggy').get();
  const old = snap.docs.filter((d) => String(d.get('date') || '') < SYNC_FROM);
  for (let i = 0; i < old.length; i += 400) {
    const batch = db.batch();
    old.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  return old.length;
}

// --- Principal --------------------------------------------------------------

async function main() {
  const clientId = requireEnv('PLUGGY_CLIENT_ID');
  const clientSecret = requireEnv('PLUGGY_CLIENT_SECRET');
  const itemIds = requireEnv('PLUGGY_ITEM_IDS').split(',').map((s) => s.trim()).filter(Boolean);

  const apiKey = await authenticate(clientId, clientSecret);
  const from = SYNC_FROM;
  const to = new Date().toISOString().slice(0, 10);

  const transactions = [];
  const cards = [];
  const openings = [];
  const outsideWindowIds = [];

  for (const itemId of itemIds) {
    const item = await pluggy(`/items/${itemId}`, apiKey);
    const accounts = (await pluggy('/accounts', apiKey, { itemId })).results;
    // O item do MeuPluggy não diz o banco; usa o nome da conta como pista.
    const bankName = /nu\b|nubank|nu pagamentos/i.test(accounts.map((a) => a.name).join(' ')) ? 'Nubank' : 'Mercado Pago';
    console.log(`Item ${itemId.slice(0, 8)}…: status ${item.status}, ${accounts.length} conta(s)`);

    const itemCard = accounts.find((a) => a.type === 'CREDIT');
    for (const account of accounts) {
      if (account.type === 'CREDIT') cards.push(toFinancyCard(account, bankName));
      const txs = await fetchAllTransactions(apiKey, account.id, from, to);
      console.log(`  ${account.type} …${String(account.number || '').slice(-4)}: ${txs.length} transação(ões) desde ${SYNC_FROM}`);
      let net = 0;
      let purchases = 0;
      let payments = 0;
      txs.forEach((tx) => {
        // Pela data de Brasília, parte do que veio "de 01/10 (UTC)" é de 30/09: fora da janela.
        if (toBrazilDateTime(tx.date).date < SYNC_FROM) {
          outsideWindowIds.push(`pluggy-${tx.id}`);
          return;
        }
        const amount = Math.abs(Number(tx.amount));
        if (account.type === 'CREDIT') {
          if (tx.type === 'CREDIT') payments += amount;
          else purchases += amount;
        } else {
          net += tx.type === 'CREDIT' ? amount : -amount;
        }
        const converted = toFinancyTransaction(tx, account, itemCard ? `pluggy-${itemCard.id}` : undefined);
        if (converted) transactions.push(converted);
      });
      const opening = account.type === 'CREDIT'
        ? openingCardEntry(account, purchases, payments)
        : openingBalanceEntry(account, bankName, net);
      if (opening) openings.push(opening);
    }
  }

  const expenses = transactions.filter((t) => t.collection === 'despesas').length;
  console.log(`Saldos de abertura calculados: ${openings.length}`);
  console.log(`Total lido: ${transactions.length} (${expenses} despesas, ${transactions.length - expenses} receitas), ${cards.length} cartão(ões)`);

  if (DRY_RUN) {
    console.log('Modo --dry: nada foi gravado.');
    return;
  }

  const { db, uid } = await openFirestore();
  const userRef = db.collection('users').doc(uid);
  await upsertOpenings(db, userRef, openings);
  for (const id of outsideWindowIds) {
    await userRef.collection('despesas').doc(id).delete();
    await userRef.collection('receitas').doc(id).delete();
  }
  const prunedExpenses = await pruneOldImports(db, userRef.collection('despesas'));
  const prunedIncome = await pruneOldImports(db, userRef.collection('receitas'));
  if (prunedExpenses + prunedIncome > 0) {
    console.log(`Removido: ${prunedExpenses} despesa(s) e ${prunedIncome} receita(s) importadas antes de ${SYNC_FROM}.`);
  }
  const createdCards = await createMissing(db, userRef.collection('cartoes'), cards);
  const createdExpenses = await createMissing(
    db, userRef.collection('despesas'), transactions.filter((t) => t.collection === 'despesas'));
  const createdIncome = await createMissing(
    db, userRef.collection('receitas'), transactions.filter((t) => t.collection === 'receitas'));
  if (backfilled > 0) console.log(`Horário completado em ${backfilled} lançamento(s) antigo(s).`);
  console.log(`Gravado: ${createdExpenses} despesa(s), ${createdIncome} receita(s), ${createdCards} cartão(ões) novos.`);
}

main().catch((err) => {
  console.error('Falha na sincronização:', err.message);
  process.exit(1);
});
