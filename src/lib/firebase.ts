import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  writeBatch,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  GoogleAuthProvider,
  signOut,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Hospedado no Firebase Hosting (financy-2d.web.app), o login do Google usa o
// próprio domínio do site: no iPhone o Safari bloqueia o cookie de outro domínio
// (firebaseapp.com) e o login por redirecionamento não voltaria logado.
const onFirebaseHosting = typeof location !== 'undefined' && /\.(web\.app|firebaseapp\.com)$/.test(location.hostname);
const app = getApps().length === 0
  ? initializeApp(onFirebaseHosting ? { ...firebaseConfig, authDomain: location.hostname } : firebaseConfig)
  : getApps()[0];

// firestoreDatabaseId vazio ou "(default)" usa o banco padrão do projeto;
// só passa o segundo argumento quando é um banco nomeado de verdade.
export const db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);
export const auth = getAuth(app);

export interface UserFinancialData {
  transactions: any[];
  categories: any[];
  pendingSimulations: any[];
  cards?: any[];
  /** Área de Planejamento (edge esquerdo): dívidas e investimentos futuros,
   *  só simulação — nunca entram nos totais/saldo reais do app. */
  plannedDebts?: any[];
  plannedInvestments?: any[];
  updatedAt?: string;
}

/**
 * Observa o estado de autenticação do usuário (login/logout).
 */
export function subscribeAuthState(onChange: (user: User | null) => void) {
  return onAuthStateChanged(auth, onChange);
}

export async function loginWithEmail(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email, password);
}

export async function registerWithEmail(email: string, password: string): Promise<void> {
  await createUserWithEmailAndPassword(auth, email, password);
}

export async function loginWithGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider();
  // App instalado na Tela de Início do iPhone: pop-up não volta para o app,
  // então troca a página pelo login e o onAuthStateChanged pega a volta.
  const standaloneIos = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standaloneIos) await signInWithRedirect(auth, provider);
  else await signInWithPopup(auth, provider);
}

export async function logout(): Promise<void> {
  await signOut(auth);
}

/**
 * Estrutura no Firestore (tudo debaixo do dono, users/{uid}, exigido pelas
 * regras de segurança):
 *
 *   users/{uid}                        -> perfil (email, criadoEm, atualizadoEm)
 *   users/{uid}/despesas/{id}          -> transações do tipo "expense"
 *   users/{uid}/receitas/{id}          -> transações do tipo "income"
 *   users/{uid}/investimentos/{id}     -> transações do tipo "investment"
 *   users/{uid}/categorias/{id}        -> categorias cadastradas
 *   users/{uid}/cartoes/{id}           -> cartões de crédito cadastrados
 *   users/{uid}/simulacoesPendentes/{id} -> pendências do simulador freelancer
 *   users/{uid}/dividasPlanejadas/{id}   -> dívidas futuras (área de Planejamento)
 *   users/{uid}/investimentosPlanejados/{id} -> investimentos futuros (área de Planejamento)
 *
 * Cada tipo de transação vira uma coleção própria (em vez de tudo misturado
 * num array só) — fica mais fácil de consultar, expandir e não esbarra no
 * limite de 1MB por documento conforme o histórico cresce.
 */
const TRANSACTION_COLLECTIONS: Record<'expense' | 'income' | 'investment', string> = {
  expense: 'despesas',
  income: 'receitas',
  investment: 'investimentos',
};
const CATEGORIES_COLLECTION = 'categorias';
const CARDS_COLLECTION = 'cartoes';
const PENDING_SIMULATIONS_COLLECTION = 'simulacoesPendentes';
const PLANNED_DEBTS_COLLECTION = 'dividasPlanejadas';
const PLANNED_INVESTMENTS_COLLECTION = 'investimentosPlanejados';

/**
 * Espelha uma lista local (com `id` próprio) numa subcoleção do Firestore:
 * grava/atualiza cada item presente e apaga do banco quem não existe mais
 * localmente. Faz uma leitura da coleção pra descobrir o que precisa ser
 * removido, então roda tudo num único batch.
 */
async function syncSubcollection(
  uid: string,
  collectionName: string,
  items: Array<{ id: string;[key: string]: any }>
): Promise<void> {
  const colRef = collection(db, 'users', uid, collectionName);
  const existingSnapshot = await getDocs(colRef);
  const existingIds = new Set(existingSnapshot.docs.map((d) => d.id));
  const localIds = new Set(items.map((item) => item.id));

  const batch = writeBatch(db);

  items.forEach((item) => {
    const { id, ...rest } = item;
    // Remove undefined pra não quebrar a escrita no Firestore.
    const cleanRest = JSON.parse(JSON.stringify(rest));
    batch.set(doc(colRef, id), cleanRest, { merge: true });
  });

  existingIds.forEach((id) => {
    if (!localIds.has(id)) {
      batch.delete(doc(colRef, id));
    }
  });

  await batch.commit();
}

/**
 * Sincronização em tempo real: escuta as seis subcoleções do usuário e
 * remonta o formato único { transactions, categories, cards, pendingSimulations }
 * que o resto do app já espera — a normalização do banco fica escondida
 * atrás dessa função.
 */
export function subscribeUserData(uid: string, onDataReceived: (data: UserFinancialData) => void): Unsubscribe {
  type Key =
    | 'expense'
    | 'income'
    | 'investment'
    | 'categories'
    | 'cards'
    | 'pendingSimulations'
    | 'plannedDebts'
    | 'plannedInvestments';

  const buffers: Record<Key, any[]> = {
    expense: [],
    income: [],
    investment: [],
    categories: [],
    cards: [],
    pendingSimulations: [],
    plannedDebts: [],
    plannedInvestments: [],
  };
  const received: Record<Key, boolean> = {
    expense: false,
    income: false,
    investment: false,
    categories: false,
    cards: false,
    pendingSimulations: false,
    plannedDebts: false,
    plannedInvestments: false,
  };

  const emit = () => {
    if (!Object.values(received).every(Boolean)) return; // espera todas as coleções reportarem ao menos 1x
    const transactions = [
      ...buffers.expense.map((t) => ({ ...t, type: 'expense' as const })),
      ...buffers.income.map((t) => ({ ...t, type: 'income' as const })),
      ...buffers.investment.map((t) => ({ ...t, type: 'investment' as const })),
    ];
    onDataReceived({
      transactions,
      categories: buffers.categories,
      cards: buffers.cards,
      pendingSimulations: buffers.pendingSimulations,
      plannedDebts: buffers.plannedDebts,
      plannedInvestments: buffers.plannedInvestments,
    });
  };

  const listen = (collectionName: string, key: Key) =>
    onSnapshot(
      collection(db, 'users', uid, collectionName),
      (snapshot) => {
        buffers[key] = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        received[key] = true;
        emit();
      },
      (error) => {
        console.error(`Erro no listener do banco de dados online (${collectionName}):`, error);
      }
    );

  const unsubscribers = [
    listen(TRANSACTION_COLLECTIONS.expense, 'expense'),
    listen(TRANSACTION_COLLECTIONS.income, 'income'),
    listen(TRANSACTION_COLLECTIONS.investment, 'investment'),
    listen(CATEGORIES_COLLECTION, 'categories'),
    listen(CARDS_COLLECTION, 'cards'),
    listen(PENDING_SIMULATIONS_COLLECTION, 'pendingSimulations'),
    listen(PLANNED_DEBTS_COLLECTION, 'plannedDebts'),
    listen(PLANNED_INVESTMENTS_COLLECTION, 'plannedInvestments'),
  ];

  return () => unsubscribers.forEach((unsub) => unsub());
}

export async function saveUserDataToCloud(uid: string, data: UserFinancialData): Promise<void> {
  const transactions = data.transactions || [];
  const expenses = transactions.filter((t) => t.type === 'expense');
  const income = transactions.filter((t) => t.type === 'income');
  const investments = transactions.filter((t) => t.type === 'investment');

  await Promise.all([
    syncSubcollection(uid, TRANSACTION_COLLECTIONS.expense, expenses),
    syncSubcollection(uid, TRANSACTION_COLLECTIONS.income, income),
    syncSubcollection(uid, TRANSACTION_COLLECTIONS.investment, investments),
    syncSubcollection(uid, CATEGORIES_COLLECTION, data.categories || []),
    syncSubcollection(uid, CARDS_COLLECTION, data.cards || []),
    syncSubcollection(uid, PENDING_SIMULATIONS_COLLECTION, data.pendingSimulations || []),
    syncSubcollection(uid, PLANNED_DEBTS_COLLECTION, data.plannedDebts || []),
    syncSubcollection(uid, PLANNED_INVESTMENTS_COLLECTION, data.plannedInvestments || []),
  ]);

  // Doc de perfil do usuário — só metadados, os dados financeiros ficam
  // nas subcoleções acima.
  await setDoc(doc(db, 'users', uid), { updatedAt: new Date().toISOString() }, { merge: true });
}

// ---------------------------------------------------------------------------
// Migração de dados legados
// ---------------------------------------------------------------------------

/**
 * Detecta e migra dados do formato antigo (campos transactions/categories/...
 * como arrays dentro do próprio doc de perfil users/{uid}, de antes de
 * existir a estrutura em subcoleções) para o formato atual. Seguro de chamar
 * sempre no login: se as subcoleções já tiverem dados (ou já existir uma
 * migração registrada), a função não faz nada.
 */
export async function migrateLegacyDataIfNeeded(uid: string): Promise<void> {
  const profileRef = doc(db, 'users', uid);
  const profileSnap = await getDoc(profileRef);
  const profileData = profileSnap.exists() ? (profileSnap.data() as any) : null;

  if (profileData?.migratedAt) return; // já migrado antes

  // Já existe algo nas subcoleções novas? Então não há nada legado a migrar
  // (evita duplicar dados se essa função rodar mais de uma vez).
  const existingExpenses = await getDocs(collection(db, 'users', uid, TRANSACTION_COLLECTIONS.expense));
  const existingIncome = await getDocs(collection(db, 'users', uid, TRANSACTION_COLLECTIONS.income));
  if (!existingExpenses.empty || !existingIncome.empty) {
    await setDoc(profileRef, { migratedAt: new Date().toISOString() }, { merge: true });
    return;
  }

  const legacyData: UserFinancialData | null =
    profileData && (Array.isArray(profileData.transactions) || Array.isArray(profileData.categories))
      ? (profileData as UserFinancialData)
      : null;

  if (legacyData && (legacyData.transactions?.length || legacyData.categories?.length)) {
    await saveUserDataToCloud(uid, legacyData);
  }

  await setDoc(profileRef, { migratedAt: new Date().toISOString() }, { merge: true });
}
