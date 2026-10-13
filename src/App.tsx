/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  PlusCircle,
  PieChart,
  Plus,
  Calculator,
  Clock,
  Search,
  Eye,
  Smartphone,
  Home,
  Settings,
  ChevronRight,
  Link2
} from 'lucide-react';
import CategoryModal, { CategoryData } from './components/categories/CategoryModal';
import SimulacaoGanhosModal from './components/simulations/SimulacaoGanhosModal';
import PendingSimulationsSidebar, { PendingSimulation, DailyBreakdownItem } from './components/simulations/PendingSimulationsSidebar';
import ManageCategoriesModal from './components/categories/ManageCategoriesModal';
import SummaryCards from './components/dashboard/SummaryCards';
import TransactionModal, { TransactionFormData } from './components/transactions/TransactionModal';
import TransactionHistory from './components/transactions/TransactionHistory';
import Header from './components/layout/Header';
import Charts from './components/dashboard/Charts';
import RecentTransactions from './components/dashboard/RecentTransactions';
import AnalysisView from './components/dashboard/AnalysisView';
import SettingsView from './components/settings/SettingsView';
import LinkPixModal from './components/simulations/LinkPixModal';
import { CreditCardEdgePanel, CardConfig } from './components/cards/CreditCardEdgePanel';
import { PlanningEdgePanel, PlannedDebt, PlannedInvestment } from './components/planning/PlanningEdgePanel';
import Login from './components/auth/Login';
import { subscribeUserData, saveUserDataToCloud, subscribeAuthState, logout, migrateLegacyDataIfNeeded, auth } from './lib/firebase';
import { useThemePreference } from './lib/theme';
import { useBankSync, setGithubToken, type SyncOptions } from './lib/githubSync';
import { currentTimeHHMM, compareNewestFirst } from './lib/transactions';
import { onIdTokenChanged, type User } from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { QuickAddOverlay } from './native/quickAddOverlay';

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense' | 'investment';
  category: string;
  date: string;
  /** Opcional: id do cartão (CardConfig.id) ao qual essa despesa está vinculada.
   *  Ausente = não vinculada a nenhum cartão (não conta em nenhum limite). */
  cardId?: string;
  /** Opcional: presente só em transações de "Pagamento de Fatura" — indica de
   *  qual cartão essa fatura é, pra reduzir o "usado" daquele cartão sem
   *  remover as despesas originais do histórico. */
  cardPaymentFor?: string;
  /** Opcional: true nas transações geradas por "repetir por X meses"
   *  (recorrente). Usado pelo cálculo de limite usado do cartão pra não
   *  empilhar ocorrências de meses anteriores como se fossem dívida não
   *  paga — cada mês da recorrência conta só no próprio mês, como uma
   *  assinatura normal (ver CreditCardEdgePanel.tsx). */
  isRecurring?: boolean;
  /** Horário do lançamento (HH:MM). Ordena junto com a data. */
  time?: string;
  /** Origem do lançamento; 'pluggy' = importado automaticamente do banco. */
  source?: string;
  /** Pagamento freelance ao qual este Pix recebido foi vinculado. */
  linkedFreelance?: LinkedFreelance;
}

export interface LinkedFreelance {
  weekLabel?: string;
  /** Valor que a calculadora previa para a semana (o Pix pode vir diferente). */
  expectedAmount: number;
  date?: string;
}

export interface CategoryItem {
  id: string;
  name: string;
  type: 'income' | 'expense' | 'investment';
  color?: string;
}

export const DEFAULT_TYPED_CATEGORIES: CategoryItem[] = [
  // Despesas
  { id: '1', name: 'Alimentação', type: 'expense', color: '#F43F5E' },
  { id: '2', name: 'Moradia', type: 'expense', color: '#E11D48' },
  { id: '3', name: 'Transporte', type: 'expense', color: '#F97316' },
  { id: '4', name: 'Lazer', type: 'expense', color: '#D97706' },
  { id: '5', name: 'Saúde', type: 'expense', color: '#22C55E' },
  { id: '6', name: 'Educação', type: 'expense', color: '#3B82F6' },
  { id: '7', name: 'Outras Despesas', type: 'expense', color: '#64748B' },

  // Receitas
  { id: '8', name: 'Salário', type: 'income', color: '#10B981' },
  { id: '9', name: 'Freelance', type: 'income', color: '#14B8A6' },
  { id: '10', name: 'Vendas', type: 'income', color: '#06B6D4' },
  { id: '11', name: 'Rendimentos', type: 'income', color: '#8B5CF6' },
  { id: '12', name: 'Outras Receitas', type: 'income', color: '#64748B' },

  // Investimentos
  { id: '13', name: 'Ações', type: 'investment', color: '#6366F1' },
  { id: '14', name: 'Fundos Imobiliários', type: 'investment', color: '#8B5CF6' },
  { id: '15', name: 'Renda Fixa', type: 'investment', color: '#A855F7' },
  { id: '16', name: 'Cripto', type: 'investment', color: '#EC4899' },
  { id: '17', name: 'Reserva de Emergência', type: 'investment', color: '#3B82F6' },
  { id: '18', name: 'Outros Investimentos', type: 'investment', color: '#64748B' },
];

function addMonthsToDateStr(dateStr: string, monthsToAdd: number): string {
  if (monthsToAdd === 0) return dateStr;
  const parts = dateStr.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);

  const date = new Date(year, month - 1 + monthsToAdd, day);
  const expectedMonth = (month - 1 + monthsToAdd) % 12;
  const targetMonth = expectedMonth < 0 ? expectedMonth + 12 : expectedMonth;

  if (date.getMonth() !== targetMonth) {
    date.setDate(0);
  }

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const VIEW_TITLES: Record<string, { eyebrow: string; title: string }> = {
  analise: { eyebrow: 'Análise', title: 'Metas' },
  contas: { eyebrow: 'Planejamento', title: 'Contas' },
  config: { eyebrow: 'Preferências', title: 'Ajustes' },
};

export default function App() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Migração automática de formatos antigos de armazenamento (doc único por
  // usuário com arrays, ou doc único compartilhado de antes de existir login)
  // pras subcoleções atuais (despesas/receitas/investimentos/categorias/
  // cartões/simulações). Roda sozinha uma vez por conta, sem exigir ação do
  // usuário — ver detalhes em migrateLegacyDataIfNeeded.
  useEffect(() => {
    if (!authUser) return;
    migrateLegacyDataIfNeeded(authUser.uid).catch((err) => {
      console.error('Erro ao migrar dados legados:', err);
    });
  }, [authUser]);

  useEffect(() => {
    const unsubscribe = subscribeAuthState((user) => {
      setAuthUser(user);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Repassa a sessão de login (uid + ID token) pro overlay nativo de
  // lançamento rápido, pra ele conseguir ler/escrever direto no Firestore
  // quando há internet — ver FirestoreSync.kt. onIdTokenChanged dispara de
  // novo sempre que o Firebase renova o token (a cada ~1h), mantendo o
  // overlay com um token razoavelmente fresco enquanto o app é aberto de
  // vez em quando.
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;
    const unsubscribe = onIdTokenChanged(auth, async (user) => {
      if (user) {
        try {
          const idToken = await user.getIdToken();
          await QuickAddOverlay.setAuthSession({ uid: user.uid, idToken });
        } catch (e) {
          console.error('Erro ao repassar sessão pro overlay:', e);
        }
      } else {
        QuickAddOverlay.clearAuthSession().catch(() => {});
      }
    });
    return () => unsubscribe();
  }, []);

  const [categories, setCategories] = useState<CategoryItem[]>(() => {
    const saved = localStorage.getItem('financas_categorias_v2');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Erro ao ler categorias v2', e);
      }
    }
    // Migration from old string[] if present
    const legacySaved = localStorage.getItem('financas_categorias');
    if (legacySaved) {
      try {
        const parsed: string[] = JSON.parse(legacySaved);
        if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string') {
          return parsed.map((catName, idx) => {
            let catType: 'income' | 'expense' | 'investment' = 'expense';
            const lower = catName.toLowerCase();
            if (['salário', 'freelance', 'vendas', 'rendimentos', 'receita'].some(k => lower.includes(k))) {
              catType = 'income';
            } else if (['investimento', 'ações', 'fundos', 'renda fixa', 'cripto', 'reserva'].some(k => lower.includes(k))) {
              catType = 'investment';
            }
            return {
              id: `legacy-${idx}-${Date.now()}`,
              name: catName,
              type: catType,
            };
          });
        }
      } catch (e) {
        console.error('Erro ao converter categorias legadas', e);
      }
    }
    return DEFAULT_TYPED_CATEGORIES;
  });

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isManageCategoriesOpen, setIsManageCategoriesOpen] = useState(false);
  const [isSimulationModalOpen, setIsSimulationModalOpen] = useState(false);
  const [isPendingSidebarOpen, setIsPendingSidebarOpen] = useState(false);
  const [editingPendingSimulation, setEditingPendingSimulation] = useState<PendingSimulation | null>(null);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [modalInitialViewMode, setModalInitialViewMode] = useState<'wizard' | 'form'>('wizard');

  // Cartões cadastrados (movido pra cá, de dentro do CreditCardEdgePanel, pra poder
  // ser usado também no seletor de "vincular a um cartão" do TransactionModal).
  const [cards, setCards] = useState<CardConfig[]>(() => {
    try {
      const saved = localStorage.getItem('financas_cartoes_lista');
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // fallback
    }
    return [];
  });

  // Área de Planejamento (edge esquerdo): dívidas e investimentos FUTUROS,
  // só simulação. Guardados em estado/armazenamento próprios, separados de
  // `transactions` — nunca entram nos cálculos de saldo/receita/despesa reais.
  const [plannedDebts, setPlannedDebts] = useState<PlannedDebt[]>(() => {
    try {
      const saved = localStorage.getItem('financas_planejamento_dividas');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // fallback
    }
    return [];
  });
  const [plannedInvestments, setPlannedInvestments] = useState<PlannedInvestment[]>(() => {
    try {
      const saved = localStorage.getItem('financas_planejamento_investimentos');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // fallback
    }
    return [];
  });

  const [modalForm, setModalForm] = useState<TransactionFormData>({
    valor: '',
    descricao: '',
    categoria: (() => {
      const first = categories[0];
      if (first && typeof first === 'object') return first.name;
      return String(first || 'Outros');
    })(),
    data: new Date().toISOString().split('T')[0],
    type: 'expense',
  });

  const [pendingSimulations, setPendingSimulations] = useState<PendingSimulation[]>(() => {
    const saved = localStorage.getItem('financas_pendentes');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Erro ao ler simulações pendentes', e);
      }
    }
    return [];
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('financas_transacoes');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Erro ao ler transações salvas', e);
      }
    }
    // Sem dados salvos ainda: começa vazio. NÃO usar dados de exemplo aqui —
    // antes disso apontava pra um array fixo de transações fictícias, que
    // numa conta nova acabava sendo salvo de verdade no Firestore por causa
    // da corrida com a primeira sincronização da nuvem (ver hasSyncedFromCloud
    // logo abaixo).
    return [];
  });

  // Mantém o overlay nativo com cache local de cartões/categorias sempre
  // atualizado, pra ele conseguir mostrar essa informação mesmo offline
  // (ver FirestoreSync.kt / QuickAddOverlayPlugin.kt).
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;
    const cardsJson = JSON.stringify(
      cards.map((c) => ({ id: c.id, name: c.name, bank: c.bank, lastDigits: c.lastDigits }))
    );
    QuickAddOverlay.cacheCards({ cardsJson }).catch(() => {});
  }, [cards]);

  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;
    const categoriesJson = JSON.stringify(
      categories.map((c) => ({ id: c.id, name: c.name, type: c.type, color: c.color }))
    );
    QuickAddOverlay.cacheCategories({ categoriesJson }).catch(() => {});
  }, [categories]);

  // "Limite usado" por cartão no mês corrente real (não o monthFilter do
  // picker) — mesmo cálculo que o overlay nativo já fazia antes (soma das
  // despesas do mês vinculadas a cada cardId).
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;
    const currentMonth = (() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    })();
    const usedByCard = new Map<string, number>();
    transactions.forEach((t) => {
      if (t.type === 'expense' && t.cardId && t.date && t.date.startsWith(currentMonth)) {
        usedByCard.set(t.cardId, (usedByCard.get(t.cardId) || 0) + t.amount);
      }
    });
    const cardsUsageJson = JSON.stringify(
      cards.map((c) => ({
        id: c.id,
        name: c.name,
        bank: c.bank,
        lastDigits: c.lastDigits,
        limit: c.limit,
        used: usedByCard.get(c.id) || 0,
      }))
    );
    QuickAddOverlay.cacheCardsUsage({ cardsUsageJson }).catch(() => {});
  }, [cards, transactions]);

  // Sincroniza transações criadas no overlay enquanto offline (ou sem
  // sessão válida) assim que o app abre logado — funde na lista local, que
  // já dispara o fluxo normal de salvamento na nuvem.
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android' || !authUser) return;
    (async () => {
      try {
        const { transactionsJson } = await QuickAddOverlay.getPendingTransactions();
        const pending = JSON.parse(transactionsJson || '[]');
        if (Array.isArray(pending) && pending.length > 0) {
          setTransactions((prev) => {
            const existingIds = new Set(prev.map((t) => t.id));
            const newOnes = pending.filter((t: any) => t?.id && !existingIds.has(t.id));
            return newOnes.length > 0 ? [...newOnes, ...prev] : prev;
          });
          await QuickAddOverlay.clearPendingTransactions();
        }
      } catch (e) {
        console.error('Erro ao sincronizar transações pendentes do overlay:', e);
      }
    })();
  }, [authUser]);

  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense' | 'investment'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [monthFilter, setMonthFilter] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);

  const [saveStatus, setSaveStatus] = useState<'saving' | 'error' | 'local' | 'db'>('db');
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const isFirstMount = useRef(true);
  const isUpdatingFromCloud = useRef(false);
  // Fica false até a primeira sincronização real da nuvem chegar. Enquanto
  // isso, o efeito de auto-save abaixo NÃO pode salvar nada — sem essa
  // trava, o estado local inicial (que pode estar vazio/desatualizado numa
  // conta recém-logada) corre o risco de ser gravado por cima dos dados reais
  // da nuvem antes deles sequer chegarem.
  const hasSyncedFromCloud = useRef(false);

  // Sincronização em tempo real com o banco de dados Firestore (só depois de logado)
  useEffect(() => {
    hasSyncedFromCloud.current = false;
    if (!authUser) return;
    const unsubscribe = subscribeUserData(authUser.uid, (cloudData) => {
      if (!cloudData) return;
      isUpdatingFromCloud.current = true;

      if (cloudData.transactions && Array.isArray(cloudData.transactions)) {
        setTransactions(cloudData.transactions);
      }
      if (cloudData.categories && Array.isArray(cloudData.categories)) {
        setCategories(cloudData.categories);
      }
      if (cloudData.pendingSimulations && Array.isArray(cloudData.pendingSimulations)) {
        setPendingSimulations(cloudData.pendingSimulations);
      }
      if (cloudData.cards && Array.isArray(cloudData.cards)) {
        setCards(cloudData.cards);
      }
      if (cloudData.plannedDebts && Array.isArray(cloudData.plannedDebts)) {
        setPlannedDebts(cloudData.plannedDebts);
      }
      if (cloudData.plannedInvestments && Array.isArray(cloudData.plannedInvestments)) {
        setPlannedInvestments(cloudData.plannedInvestments);
      }

      hasSyncedFromCloud.current = true;
      setSaveStatus('db');

      setTimeout(() => {
        isUpdatingFromCloud.current = false;
      }, 500);
    });

    return () => unsubscribe();
  }, [authUser]);

  // Sincronização síncrona imediata com LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem('financas_transacoes', JSON.stringify(transactions));
      localStorage.setItem('financas_categorias', JSON.stringify(categories));
      localStorage.setItem('financas_categorias_v2', JSON.stringify(categories));
      localStorage.setItem('financas_pendentes', JSON.stringify(pendingSimulations));
      localStorage.setItem('financas_cartoes_lista', JSON.stringify(cards));
      localStorage.setItem('financas_planejamento_dividas', JSON.stringify(plannedDebts));
      localStorage.setItem('financas_planejamento_investimentos', JSON.stringify(plannedInvestments));
    } catch (e) {
      console.error('Erro ao salvar no LocalStorage:', e);
    }
  }, [transactions, categories, pendingSimulations, cards, plannedDebts, plannedInvestments]);

  const performSave = useCallback(() => {
    if (!authUser) {
      setSaveStatus('local');
      return setTimeout(() => {}, 0);
    }

    setSaveStatus('saving');
    setSaveErrorMessage(null);

    const timer = setTimeout(async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setSaveStatus('local');
        return;
      }

      try {
        await saveUserDataToCloud(authUser.uid, {
          transactions,
          categories,
          pendingSimulations,
          cards,
          plannedDebts,
          plannedInvestments
        });

        setSaveStatus('db');
      } catch (err: any) {
        console.error('Erro ao salvar no banco de dados:', err);
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          setSaveStatus('local');
        } else {
          setSaveStatus('error');
          setSaveErrorMessage(err?.message || 'Falha ao salvar no banco de dados online.');
        }
      }
    }, 300);

    return timer;
  }, [authUser, transactions, categories, pendingSimulations, cards, plannedDebts, plannedInvestments]);

  useEffect(() => {
    const handleOnline = () => {
      performSave();
    };
    const handleOffline = () => {
      setSaveStatus('local');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [performSave]);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    if (isUpdatingFromCloud.current) {
      return;
    }

    // Ainda não recebemos a primeira sincronização real da nuvem pra essa
    // conta — não salva nada até lá (evita sobrescrever os dados reais do
    // usuário com o estado local inicial/incompleto).
    if (authUser && !hasSyncedFromCloud.current) {
      return;
    }

    const timer = performSave();
    return () => clearTimeout(timer);
  }, [authUser, transactions, categories, pendingSimulations, performSave]);

  useEffect(() => {
    // Atalho global de teclado para acionar pop-up rápido (Ctrl + K ou Alt + N)
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey && e.key.toLowerCase() === 'k') || (e.altKey && e.key.toLowerCase() === 'n')) {
        e.preventDefault();
        setModalInitialViewMode('wizard');
        setIsTransactionModalOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'financas_transacoes' && e.newValue) {
        try {
          setTransactions(JSON.parse(e.newValue));
        } catch (err) {
          console.error('Erro ao sincronizar transações', err);
        }
      }
      if (e.key === 'financas_categorias_v2' && e.newValue) {
        try {
          setCategories(JSON.parse(e.newValue));
        } catch (err) {
          console.error('Erro ao sincronizar categorias', err);
        }
      }
      if (e.key === 'financas_pendentes' && e.newValue) {
        try {
          setPendingSimulations(JSON.parse(e.newValue));
        } catch (err) {
          console.error('Erro ao sincronizar simulações', err);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const [categoryInitialType, setCategoryInitialType] = useState<string>('expense');

  const handleSaveCategory = (newCat: CategoryData) => {
    let catType: 'income' | 'expense' | 'investment' = 'expense';
    if (newCat.type === 'Receita' || newCat.type === 'income') {
      catType = 'income';
    } else if (newCat.type === 'Investimento' || newCat.type === 'investment') {
      catType = 'investment';
    } else {
      catType = 'expense';
    }

    const newCategoryItem: CategoryItem = {
      id: Date.now().toString(),
      name: newCat.name,
      type: catType,
      color: newCat.color || (catType === 'income' ? '#10B981' : catType === 'investment' ? '#8B5CF6' : '#F43F5E'),
    };

    setCategories((prev) => {
      if (prev.some((c) => c.name.toLowerCase() === newCat.name.toLowerCase() && c.type === catType)) {
        return prev;
      }
      return [...prev, newCategoryItem];
    });

    // Se o modal de transação estiver aberto (ex: criando categoria de dentro
    // do wizard), seleciona a categoria recém-criada automaticamente e garante
    // que o tipo da transação bata com o tipo da categoria nova.
    if (isTransactionModalOpen) {
      setModalForm((prev) => ({ ...prev, categoria: newCategoryItem.name, type: catType }));
    }
  };

  const handleDeleteCategory = (catIdentifier: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== catIdentifier && c.name !== catIdentifier));
  };

  const handleOpenNewCategory = (type?: string) => {
    if (type) {
      setCategoryInitialType(type);
    }
    setIsCategoryModalOpen(true);
  };

  const handleSaveSimulation = (data: {
    amount: number;
    date?: string;
    weekLabel?: string;
    dailyBreakdown?: DailyBreakdownItem[];
    editingId?: string;
  }) => {
    if (data.editingId) {
      // Edição: atualiza a pendência existente no lugar, mantendo o mesmo id
      setPendingSimulations(prev => prev.map(sim =>
        sim.id === data.editingId
          ? {
              ...sim,
              amount: data.amount,
              date: data.date || sim.date,
              weekLabel: data.weekLabel,
              dailyBreakdown: data.dailyBreakdown,
            }
          : sim
      ));
      setEditingPendingSimulation(null);
    } else {
      const newPending: PendingSimulation = {
        id: Date.now().toString(),
        amount: data.amount,
        date: data.date || new Date().toISOString().split('T')[0],
        weekLabel: data.weekLabel,
        dailyBreakdown: data.dailyBreakdown
      };
      setPendingSimulations(prev => [newPending, ...prev]);
    }
    setIsPendingSidebarOpen(true);
  };

  const handleEditPendingSimulation = (sim: PendingSimulation) => {
    setEditingPendingSimulation(sim);
    setIsPendingSidebarOpen(false);
    setIsSimulationModalOpen(true);
  };

  const handleMarkPendingAsReceived = (
    id: string,
    amount: number,
    date?: string,
    receivedDayIds?: string[],
    customDescription?: string
  ) => {
    const targetSim = pendingSimulations.find(item => item.id === id);
    if (!targetSim) return;

    const desc = customDescription || (targetSim.weekLabel
      ? `Freelance - ${targetSim.weekLabel}`
      : 'Receita Freelance');

    const newTransaction: Transaction = {
      id: Date.now().toString(),
      description: desc,
      amount,
      type: 'income',
      category: 'Freelance',
      date: date || targetSim.date || new Date().toISOString().split('T')[0]
    };
    setTransactions(prev => [newTransaction, ...prev]);

    if (receivedDayIds && targetSim.dailyBreakdown && targetSim.dailyBreakdown.length > 0) {
      const remainingBreakdown = targetSim.dailyBreakdown.filter(
        day => !receivedDayIds.includes(day.id)
      );
      if (remainingBreakdown.length === 0) {
        setPendingSimulations(prev => prev.filter(item => item.id !== id));
      } else {
        const remainingAmount = remainingBreakdown.reduce((acc, d) => acc + d.amount, 0);
        setPendingSimulations(prev =>
          prev.map(item =>
            item.id === id
              ? { ...item, amount: remainingAmount, dailyBreakdown: remainingBreakdown }
              : item
          )
        );
      }
    } else {
      setPendingSimulations(prev => prev.filter(item => item.id !== id));
    }
  };

  const handleRemovePendingSimulation = (id: string) => {
    setPendingSimulations(prev => prev.filter(item => item.id !== id));
  };

  const handleReceiveAllPending = () => {
    if (pendingSimulations.length === 0) return;

    const newTransactions: Transaction[] = pendingSimulations.map((sim, index) => {
      let desc = sim.weekLabel ? `Freelance - ${sim.weekLabel}` : 'Receita Freelance';
      if (sim.dailyBreakdown && sim.dailyBreakdown.length > 0) {
        const dayList = sim.dailyBreakdown.map(d => d.dayName).join(', ');
        desc = `Freelance (${dayList})${sim.weekLabel ? ` - ${sim.weekLabel}` : ''}`;
      }
      return {
        id: (Date.now() + index).toString(),
        description: desc,
        amount: sim.amount,
        type: 'income',
        category: 'Freelance',
        date: sim.date || new Date().toISOString().split('T')[0]
      };
    });

    setTransactions(prev => [...newTransactions, ...prev]);
    setPendingSimulations([]);
  };

  const handleEditTransaction = (transaction: Transaction) => {
    setEditingTransactionId(transaction.id);
    setModalForm({
      valor: transaction.amount.toString(),
      descricao: transaction.description,
      categoria: transaction.category,
      data: transaction.date || new Date().toISOString().split('T')[0],
      type: transaction.type,
      repeatType: 'single',
      installmentsCount: 2,
      recurringMonths: 6,
      cardId: transaction.cardId,
    });
    setModalInitialViewMode('form');
    setIsTransactionModalOpen(true);
  };

  /**
   * Pagamento de fatura de cartão: cria uma despesa NORMAL (sem cardId),
   * que portanto conta no total do mês — é o ponto em que o gasto que
   * estava "só no limite do cartão" vira, de fato, uma saída de dinheiro
   * da sua conta.
   */
  const handlePayCard = (payload: { cardId: string; cardName: string; amount: number; date: string; description?: string }) => {
    const newTransaction: Transaction = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      description: payload.description?.trim() || `Pagamento fatura - ${payload.cardName}`,
      amount: payload.amount,
      type: 'expense',
      category: 'Pagamento de Fatura',
      date: payload.date,
      // sem cardId: essa despesa afeta o total normalmente.
      // cardPaymentFor: reduz o "usado" do cartão sem apagar as despesas originais.
      cardPaymentFor: payload.cardId,
    };
    setTransactions(prev => [newTransaction, ...prev]);
  };

  const handleOpenNewTransaction = (type: 'income' | 'expense' | 'investment' = 'expense') => {
    setEditingTransactionId(null);
    setModalForm({
      valor: '',
      descricao: '',
      categoria: (categories[0] && typeof categories[0] === 'object') ? categories[0].name : String(categories[0] || 'Outros'),
      data: new Date().toISOString().split('T')[0],
      type,
      repeatType: 'single',
      installmentsCount: 2,
      recurringMonths: 6,
    });
    setModalInitialViewMode('form');
    setIsTransactionModalOpen(true);
  };

  const handleSaveModalTransaction = (e?: React.FormEvent, closeModal: boolean = true) => {
    if (e) e.preventDefault();
    const parsedAmount = parseFloat(modalForm.valor);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return false;

    const desc = modalForm.descricao.trim() || modalForm.categoria || 'Sem descrição';
    const baseDate = modalForm.data || new Date().toISOString().split('T')[0];
    const categoryName = modalForm.categoria || ((categories[0] && typeof categories[0] === 'object') ? categories[0].name : String(categories[0])) || 'Outros';
    const transactionType = modalForm.type || 'expense';
    // Só faz sentido vincular a um cartão quando a transação é uma despesa.
    const linkedCardId = transactionType === 'expense' ? modalForm.cardId : undefined;

    const newTransactions: Transaction[] = [];
    // Ao editar, preserva o que o formulário não mostra (hora, origem, vínculo com freelance...).
    const previousTx = editingTransactionId ? transactions.find(t => t.id === editingTransactionId) : undefined;
    const txTime = editingTransactionId ? previousTx?.time : currentTimeHHMM();

    if (modalForm.repeatType === 'installment' && (modalForm.installmentsCount || 2) > 1) {
      const count = modalForm.installmentsCount || 2;
      const installmentAmount = Math.round((parsedAmount / count) * 100) / 100;

      for (let i = 1; i <= count; i++) {
        const itemDate = addMonthsToDateStr(baseDate, i - 1);
        newTransactions.push({
          id: `${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
          description: `${desc} (${i}/${count})`,
          amount: installmentAmount,
          type: transactionType,
          category: categoryName,
          date: itemDate,
          time: i === 1 ? txTime : undefined,
          cardId: linkedCardId,
        });
      }
    } else if (modalForm.repeatType === 'recurring' && (modalForm.recurringMonths || 6) > 1) {
      const months = modalForm.recurringMonths || 6;
      for (let i = 0; i < months; i++) {
        const itemDate = addMonthsToDateStr(baseDate, i);
        newTransactions.push({
          id: `${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
          description: desc,
          amount: parsedAmount,
          type: transactionType,
          category: categoryName,
          date: itemDate,
          time: i === 0 ? txTime : undefined,
          cardId: linkedCardId,
          isRecurring: true,
        });
      }
    } else {
      newTransactions.push({
        ...previousTx,
        id: editingTransactionId || Date.now().toString(),
        description: desc,
        amount: parsedAmount,
        type: transactionType,
        category: categoryName,
        date: baseDate,
        time: txTime,
        cardId: linkedCardId,
      });
    }

    if (editingTransactionId) {
      setTransactions(prev => [...newTransactions, ...prev.filter(t => t.id !== editingTransactionId)]);
      setEditingTransactionId(null);
    } else {
      setTransactions(prev => [...newTransactions, ...prev]);
    }

    if (closeModal) {
      setIsTransactionModalOpen(false);
      setModalForm({
        valor: '',
        descricao: '',
        categoria: categoryName,
        data: new Date().toISOString().split('T')[0],
        type: 'expense',
        repeatType: 'single',
        installmentsCount: 2,
        recurringMonths: 6,
      });
    }

    return true;
  };

  const handleDeleteTransaction = (id: string) => {
    setTransactions(transactions.filter(t => t.id !== id));
  };

  const handleExportJSON = () => {
    const data = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      transactions,
      categories,
      pendingSimulations,
    };
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financas_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    const headers = ['ID', 'Data', 'Hora', 'Descrição', 'Valor', 'Tipo', 'Categoria'];
    const rows = transactions.map(t => [
      t.id,
      t.date,
      t.time || '',
      `"${t.description.replace(/"/g, '""')}"`,
      t.amount.toFixed(2),
      t.type,
      `"${t.category.replace(/"/g, '""')}"`
    ]);
    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transacoes_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = (importedData: any) => {
    try {
      if (Array.isArray(importedData)) {
        setTransactions(importedData);
      } else if (importedData && typeof importedData === 'object') {
        if (Array.isArray(importedData.transactions)) {
          setTransactions(importedData.transactions);
        }
        if (Array.isArray(importedData.categories)) {
          setCategories(importedData.categories);
        }
        if (Array.isArray(importedData.pendingSimulations)) {
          setPendingSimulations(importedData.pendingSimulations);
        }
      }
    } catch (e) {
      console.error('Erro ao importar arquivo JSON:', e);
    }
  };

  // Transações filtradas pelo mês selecionado
  const monthTransactions = useMemo(() => {
    if (!monthFilter || monthFilter === 'all') return transactions;
    return transactions.filter(t => t.date && t.date.startsWith(monthFilter));
  }, [transactions, monthFilter]);

  // Cálculos consolidados do mês selecionado
  const totalIncome = monthTransactions
    .filter(t => t.type === 'income')
    .reduce((acc, curr) => acc + curr.amount, 0);

  // Despesas vinculadas a um cartão (cardId) NÃO entram no total — elas só afetam
  // o saldo quando a fatura daquele cartão é paga (ver handlePayCard). Até lá,
  // contam apenas como "limite usado" dentro do painel do cartão.
  const totalExpense = monthTransactions
    .filter(t => t.type === 'expense' && !t.cardId)
    .reduce((acc, curr) => acc + curr.amount, 0);

  const totalInvestments = monthTransactions
    .filter(t => t.type === 'investment' || t.category.toLowerCase().includes('invest'))
    .reduce((acc, curr) => acc + curr.amount, 0);

  // Total das simulações pendentes de recebimento (todas, não só do mês
  // filtrado) — usado no cartão do topo da aba Contas.
  const totalPendingAmount = pendingSimulations.reduce((acc, sim) => acc + sim.amount, 0);

  // Saldo ACUMULADO: soma receitas/despesas de TODAS as transações até o fim do
  // mês selecionado (não só do mês atual) — assim o saldo de meses anteriores
  // continua "carregando" pros meses seguintes, em vez de zerar todo mês.
  const cumulativeBalanceUpTo = useCallback((monthStr: string) => {
    return transactions.reduce((acc, t) => {
      if (!t.date) return acc;
      const txMonth = t.date.slice(0, 7);
      if (monthStr !== 'all' && txMonth > monthStr) return acc; // ainda não aconteceu até esse mês
      if (t.type === 'income') return acc + t.amount;
      if (t.type === 'expense' && !t.cardId) return acc - t.amount;
      return acc;
    }, 0);
  }, [transactions]);

  const shiftMonth = (monthStr: string, delta: number): string => {
    const [y, m] = monthStr.split('-').map(Number);
    const d = new Date(y, (m - 1) + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  const totalBalance = cumulativeBalanceUpTo(monthFilter);

  // Saldo acumulado até o fim do mês ANTERIOR ao selecionado — mostrado como
  // referência pequena ao lado do saldo atual (null quando o filtro é "all",
  // já que não existe "mês anterior" nesse caso).
  // Despesas do mês anterior ao filtro (mesma regra do totalExpense) — só pra comparação na aba Análise.
  const previousExpense = monthFilter === 'all'
    ? null
    : transactions
        .filter(t => t.type === 'expense' && !t.cardId && t.date && t.date.startsWith(shiftMonth(monthFilter, -1)))
        .reduce((acc, curr) => acc + curr.amount, 0);

  const previousMonthBalance = monthFilter === 'all'
    ? null
    : cumulativeBalanceUpTo(shiftMonth(monthFilter, -1));

  // Dados para gráficos de Pizza
  const incomeData = useMemo(() => {
    const map = new Map<string, number>();
    monthTransactions.filter(t => t.type === 'income').forEach(t => {
      map.set(t.category, (map.get(t.category) || 0) + t.amount);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [monthTransactions]);

  const expenseData = useMemo(() => {
    const map = new Map<string, number>();
    monthTransactions.filter(t => t.type === 'expense' && !t.cardId).forEach(t => {
      map.set(t.category, (map.get(t.category) || 0) + t.amount);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [monthTransactions]);

  const investmentData = useMemo(() => {
    const map = new Map<string, number>();
    monthTransactions.filter(t => t.type === 'investment' || t.category.toLowerCase().includes('invest')).forEach(t => {
      map.set(t.category, (map.get(t.category) || 0) + t.amount);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [monthTransactions]);

  // Filtragem de transações
  const filteredTransactions = transactions.filter(t => {
    const matchesType = filterType === 'all' || t.type === filterType;
    const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.category.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesSearch;
  });

  /**
   * Vincula um Pix já recebido (receita importada do banco) a uma pendência
   * freelance: o Pix vira "Freelance" e a pendência sai da lista. Não cria
   * lançamento novo, então o valor não é contado duas vezes no saldo.
   */
  const handleLinkPixToPending = (transactionId: string) => {
    if (!linkingPending) return;
    const pending = linkingPending;
    setTransactions(prev => prev.map(t =>
      t.id === transactionId
        ? {
            ...t,
            category: 'Freelance',
            linkedFreelance: { weekLabel: pending.weekLabel, expectedAmount: pending.amount, date: pending.date },
          }
        : t
    ));
    setPendingSimulations(prev => prev.filter(item => item.id !== pending.id));
    setLinkingPending(null);
  };

  // Receitas recebidas que ainda podem ser vinculadas a um freelance.
  const pixCandidates = transactions
    .filter(t => t.type === 'income' && !t.linkedFreelance && !t.description.startsWith('Saldo inicial'))
    .sort(compareNewestFirst)
    .slice(0, 40);

  // Formatador de moeda
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const historyRef = useRef<HTMLDivElement>(null);

  const scrollToHistory = () => {
    setTimeout(() => {
      historyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (e) {
      console.error('Erro ao sair da conta:', e);
    }
  };

  // Nome pra saudação do cabeçalho: usa o nome do Google (displayName) quando
  // existe, senão cai pro prefixo do e-mail (ex: "caio.silva@..." -> "Caio").
  const greetingName = (() => {
    const raw = authUser?.displayName?.trim() || authUser?.email?.split('@')[0] || '';
    const firstWord = raw.split(/[.\s_]+/)[0] || raw;
    return firstWord ? firstWord.charAt(0).toUpperCase() + firstWord.slice(1) : undefined;
  })();

  // Navegação por seções (barra inferior): cada aba agora é uma página de
  // verdade, não só um scroll/atalho.
  const [activeView, setActiveView] = useState<'home' | 'analise' | 'contas' | 'config'>('home');
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const bankSync = useBankSync();
  // Pendência freelance para a qual o usuário está escolhendo o Pix recebido.
  const [linkingPending, setLinkingPending] = useState<PendingSimulation | null>(null);

  // Sem token configurado, leva direto aos Ajustes (onde ele é colado).
  const handleSyncNow = (options?: SyncOptions) => {
    if (!bankSync.hasToken) setActiveView('config');
    void bankSync.start(options);
  };

  // Preferência de tema (claro/escuro/sistema) — ver src/lib/theme.ts
  const [themePreference, setThemePreference] = useThemePreference();

  // "Sinais" pra abrir os painéis edge (Cartões / Planejamento) de fora,
  // a partir da tela de Configurações — ver CreditCardEdgePanel/PlanningEdgePanel.
  const [openCardsPanelSignal, setOpenCardsPanelSignal] = useState(0);
  const [openPlanningPanelSignal, setOpenPlanningPanelSignal] = useState(0);

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-slate-300 dark:border-slate-700 border-t-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!authUser) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Main Container */}
      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        
        {/* Header Dashboard with Saldo and Month DatePicker */}
        <Header
          monthFilter={monthFilter}
          setMonthFilter={setMonthFilter}
          balance={totalBalance}
          previousMonthBalance={previousMonthBalance}
          income={totalIncome}
          expense={totalExpense}
          userName={greetingName}
          userEmail={authUser.email || undefined}
          onLogout={handleLogout}
          onOpenNewTransaction={() => handleOpenNewTransaction('expense')}
          saveStatus={saveStatus}
          saveErrorMessage={saveErrorMessage}
          onRetrySave={performSave}
          cardMode={
            activeView === 'analise' ? 'gasto'
              : activeView === 'contas' ? 'pendente'
              : activeView === 'config' ? 'none'
              : 'saldo'
          }
          pendingTotal={totalPendingAmount}
          pendingCount={pendingSimulations.length}
          eyebrow={VIEW_TITLES[activeView]?.eyebrow}
          title={VIEW_TITLES[activeView]?.title}
          onSeeDetails={activeView === 'home' ? () => setActiveView('analise') : undefined}
          onSyncNow={handleSyncNow}
          syncStatus={bankSync.state.status}
          syncMessage={bankSync.state.message}
        />

        {/* HOME: últimas transações (histórico completo em "Ver todas") */}
        {activeView === 'home' && (
          showAllTransactions ? (
            <div ref={historyRef} className="w-full scroll-mt-6" id="transaction-history">
              <button
                type="button"
                onClick={() => setShowAllTransactions(false)}
                className="mb-3 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              >
                ← Voltar
              </button>
              <TransactionHistory
                transactions={monthTransactions}
                categories={categories}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                filterType={filterType}
                setFilterType={setFilterType}
                onDeleteTransaction={handleDeleteTransaction}
                onEditTransaction={handleEditTransaction}
                onOpenNewTransaction={() => handleOpenNewTransaction('expense')}
                onOpenManageCategories={() => setIsManageCategoriesOpen(true)}
                onOpenNewCategory={(type) => handleOpenNewCategory(type)}
                onExportJSON={handleExportJSON}
                onExportCSV={handleExportCSV}
                onImportJSON={handleImportJSON}
                formatCurrency={formatCurrency}
              />
            </div>
          ) : (
            <RecentTransactions
              transactions={monthTransactions}
              formatCurrency={formatCurrency}
              onEdit={handleEditTransaction}
              onSeeAll={() => setShowAllTransactions(true)}
              onNew={() => handleOpenNewTransaction('expense')}
            />
          )
        )}

        {/* ANÁLISE ("Metas"): comparação com o mês anterior + gastos por categoria */}
        {activeView === 'analise' && (
          <div className="space-y-6">
            <AnalysisView
              expense={totalExpense}
              income={totalIncome}
              previousExpense={previousExpense}
              categories={expenseData}
              formatCurrency={formatCurrency}
              onSelectCategory={(name) => {
                setFilterType('expense');
                setSearchTerm(name);
                setShowAllTransactions(true);
                setActiveView('home');
              }}
            />
            <Charts
              incomeData={incomeData}
              expenseData={expenseData}
              investmentData={investmentData}
              onSliceClick={(data, chartType) => {
                if (chartType) setFilterType(chartType);
                if (data?.name) setSearchTerm(data.name);
                setShowAllTransactions(true);
                setActiveView('home');
              }}
              onChartClick={(chartType) => {
                if (chartType) setFilterType(chartType);
                setShowAllTransactions(true);
                setActiveView('home');
              }}
            />
          </div>
        )}

        {/* CONTAS: calculadora freelancer + pendentes */}
        {activeView === 'contas' && (
          <div className="space-y-6">
            <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
              <button
                type="button"
                onClick={() => setIsSimulationModalOpen(true)}
                className="w-full flex items-center gap-3 px-4 py-3.5 min-h-[64px] text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
              >
                <span className="w-11 h-11 rounded-xl bg-[#1c1c1e] dark:bg-white text-white dark:text-slate-900 flex items-center justify-center shrink-0">
                  <Calculator className="w-5 h-5" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold text-[15px] text-slate-900 dark:text-slate-100">Calculadora freelancer</span>
                  <span className="block text-xs text-slate-400 dark:text-slate-500">Monte a semana e simule quanto vai receber</span>
                </span>
                <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
              </button>
              <button
                type="button"
                onClick={() => setIsPendingSidebarOpen(true)}
                className="w-full flex items-center gap-3 px-4 py-3.5 min-h-[64px] text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
              >
                <span className="w-11 h-11 rounded-xl bg-[#1c1c1e] dark:bg-white text-white dark:text-slate-900 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold text-[15px] text-slate-900 dark:text-slate-100">Pendentes</span>
                  <span className="block text-xs text-slate-400 dark:text-slate-500">
                    {pendingSimulations.length > 0
                      ? `${pendingSimulations.length} aguardando recebimento`
                      : 'Nenhuma pendência — use a calculadora para criar uma'}
                  </span>
                </span>
                <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
              </button>
            </section>

            {pendingSimulations.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-baseline justify-between px-1">
                  <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">A receber</h2>
                  <span className="text-sm text-slate-400 dark:text-slate-500">{pendingSimulations.length} itens</span>
                </div>
                <ul className="space-y-2.5">
                  {pendingSimulations.map((sim) => (
                    <li key={sim.id} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm overflow-hidden">
                      <button
                        type="button"
                        onClick={() => handleEditPendingSimulation(sim)}
                        className="w-full flex items-center gap-3 px-4 py-3.5 min-h-[64px] text-left active:bg-slate-50 dark:active:bg-slate-800/50 transition"
                      >
                        <span className="w-11 h-11 rounded-xl bg-[#1c1c1e] dark:bg-white text-white dark:text-slate-900 flex items-center justify-center font-bold shrink-0">
                          {(sim.weekLabel || 'F').charAt(0).toUpperCase()}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block font-semibold text-[15px] text-slate-900 dark:text-slate-100 truncate">
                            {sim.weekLabel || 'Receita Freelance'}
                          </span>
                          <span className="block text-xs text-slate-400 dark:text-slate-500">Pagamento em {sim.date}</span>
                        </span>
                        <span className="font-semibold text-[15px] text-slate-900 dark:text-slate-100 tabular-nums shrink-0">
                          {formatCurrency(sim.amount)}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setLinkingPending(sim)}
                        className="w-full flex items-center justify-center gap-1.5 py-2.5 border-t border-slate-100 dark:border-slate-800 text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition"
                      >
                        <Link2 className="w-4 h-4" /> Vincular Pix recebido
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}

        {/* AJUSTES */}
        {activeView === 'config' && (
          <SettingsView
            userName={greetingName}
            userEmail={authUser.email}
            theme={themePreference}
            onThemeChange={setThemePreference}
            expenseCategories={categories.filter(c => c.type === 'expense').length}
            incomeCategories={categories.filter(c => c.type === 'income').length}
            cardsCount={cards.length}
            onOpenCategories={() => setIsManageCategoriesOpen(true)}
            onOpenCards={() => setOpenCardsPanelSignal(Date.now())}
            onOpenPlanning={() => setOpenPlanningPanelSignal(Date.now())}
            onExportJSON={handleExportJSON}
            onExportCSV={handleExportCSV}
            onImportFile={(file) => {
              const reader = new FileReader();
              reader.onload = (ev) => {
                try {
                  handleImportJSON(JSON.parse(ev.target?.result as string));
                  alert('Dados importados com sucesso!');
                } catch {
                  alert('Erro ao ler o arquivo JSON. Verifique o formato.');
                }
              };
              reader.readAsText(file);
            }}
            onLogout={handleLogout}
            bankSync={bankSync.state}
            hasGithubToken={bankSync.hasToken}
            onSyncNow={handleSyncNow}
            onSaveGithubToken={(token) => {
              setGithubToken(token);
              bankSync.refreshTokenFlag();
            }}
            onClearGithubToken={() => {
              setGithubToken('');
              bankSync.refreshTokenFlag();
            }}
          />
        )}

        {/* Espaço extra no final, pra dar pra rolar além do botão flutuante da
            Calculadora e da barra de navegação inferior fixa, e não ficar
            preso atrás deles */}
        <div className="h-28" aria-hidden="true" />

      </main>


      {/* Modal de Gerenciamento de Categorias */}
      <ManageCategoriesModal
        isOpen={isManageCategoriesOpen}
        onClose={() => setIsManageCategoriesOpen(false)}
        categories={categories}
        onDeleteCategory={handleDeleteCategory}
        onOpenNewCategory={(type) => handleOpenNewCategory(type)}
      />

      {/* Modal de Criação de Categoria */}
      <CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onSave={handleSaveCategory}
        initialType={categoryInitialType}
      />

      {/* Modal de Simulador de Ganhos */}
      <React.Fragment key={editingPendingSimulation ? `edit-${editingPendingSimulation.id}` : 'nova-simulacao'}>
        <SimulacaoGanhosModal
          isOpen={isSimulationModalOpen}
          onClose={() => {
            setIsSimulationModalOpen(false);
            setEditingPendingSimulation(null);
          }}
          onSave={handleSaveSimulation}
          editingSimulation={editingPendingSimulation}
        />
      </React.Fragment>

      {/* Barra de navegação inferior — cada aba agora troca a seção exibida
          em <main> (activeView), em vez de só abrir modal/rolar a página. */}
      <nav
        aria-label="Navegação principal"
        className="fixed bottom-3 inset-x-4 z-40 max-w-md mx-auto rounded-full bg-slate-200/80 dark:bg-slate-900/90 backdrop-blur-xl shadow-lg shadow-black/10 p-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]"
      >
        <div className="flex items-center justify-between gap-1">
          {[
            { key: 'contas' as const, label: 'Contas', icon: Clock, badge: pendingSimulations.length },
            { key: 'home' as const, label: 'Home', icon: Home },
            { key: 'analise' as const, label: 'Análise', icon: PieChart },
            { key: 'config' as const, label: 'Config', icon: Settings },
          ].map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeView === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => {
                  setActiveView(tab.key);
                  if (tab.key === 'home') {
                    setShowAllTransactions(false);
                    scrollToTop();
                  }
                }}
                className={`relative flex items-center justify-center gap-1.5 h-11 rounded-full text-xs font-semibold transition active:scale-95 ${
                  isActive
                    ? 'flex-[1.4] bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                    : 'flex-1 text-slate-500 dark:text-slate-400'
                }`}
              >
                <TabIcon className="w-[18px] h-[18px]" />
                <span>{tab.label}</span>
                {!!tab.badge && !isActive && (
                  <span className="absolute top-1 right-2 bg-amber-500 text-white font-bold text-[9px] min-w-4 h-4 px-1 rounded-full flex items-center justify-center">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Sidebar de Ganhos Pendentes */}
      <PendingSimulationsSidebar
        isOpen={isPendingSidebarOpen}
        onClose={() => setIsPendingSidebarOpen(false)}
        simulations={pendingSimulations}
        onMarkAsReceived={handleMarkPendingAsReceived}
        onRemoveSimulation={handleRemovePendingSimulation}
        onReceiveAll={handleReceiveAllPending}
        onEditSimulation={handleEditPendingSimulation}
      />

      {/* Painel Edge do Cartão de Crédito */}
      <CreditCardEdgePanel
        transactions={transactions}
        monthFilter={monthFilter}
        onEditTransaction={handleEditTransaction}
        cards={cards}
        setCards={setCards}
        onPayCard={handlePayCard}
        externalOpenSignal={openCardsPanelSignal}
      />

      {/* Painel Edge de Planejamento (dívidas e investimentos futuros + IA) —
          do lado oposto ao dos cartões; é só simulação, não mexe no saldo real. */}
      <PlanningEdgePanel
        currentBalance={totalBalance}
        plannedDebts={plannedDebts}
        setPlannedDebts={setPlannedDebts}
        plannedInvestments={plannedInvestments}
        setPlannedInvestments={setPlannedInvestments}
        formatCurrency={formatCurrency}
        externalOpenSignal={openPlanningPanelSignal}
      />

      {/* Vincular Pix recebido a um pagamento freelance */}
      <LinkPixModal
        pending={linkingPending}
        candidates={pixCandidates}
        formatCurrency={formatCurrency}
        onLink={handleLinkPixToPending}
        onClose={() => setLinkingPending(null)}
      />

      {/* Modal de Transação (Nova / Editar) */}
      <TransactionModal
        isOpen={isTransactionModalOpen}
        onClose={() => {
          setIsTransactionModalOpen(false);
          setEditingTransactionId(null);
        }}
        handleSave={handleSaveModalTransaction}
        activeTab={modalForm.type === 'income' ? 'Receita' : modalForm.type === 'investment' ? 'Investimento' : 'Despesa'}
        form={modalForm}
        setForm={setModalForm}
        categories={categories}
        isEditing={!!editingTransactionId}
        initialViewMode={modalInitialViewMode}
        onOpenNewCategory={(type) => handleOpenNewCategory(type)}
        onOpenManageCategories={() => setIsManageCategoriesOpen(true)}
        cards={cards}
      />
    </div>
  );
}


