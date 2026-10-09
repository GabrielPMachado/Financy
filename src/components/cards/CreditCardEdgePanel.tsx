import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CreditCard,
  ChevronLeft,
  Edit2,
  Check,
  X,
  ShieldAlert,
  TrendingDown,
  Plus,
  Trash2,
  Building2,
  CalendarDays,
  DollarSign,
  Sparkles,
} from 'lucide-react';
import { Transaction } from '../../App';
import CurrencyInput from '../common/CurrencyInput';

export interface CardConfig {
  id: string;
  name: string;
  bank: string;
  lastDigits: string;
  limit: number;
  closingDay: number;
  dueDay: number;
  color: 'emerald' | 'purple' | 'amber' | 'rose' | 'blue' | 'slate';
}

export interface BankPreset {
  id: string;
  name: string;
  gradient: string;
  badge: string;
  textColor: string;
  defaultColor: CardConfig['color'];
  chipColor: 'gold' | 'silver';
  flag: 'mastercard' | 'visa' | 'elo';
  accentOverlay?: string;
  logoSvg?: React.ReactNode;
}

export const BANK_PRESETS: Record<string, BankPreset> = {
  Nubank: {
    id: 'Nubank',
    name: 'Nubank',
    gradient: 'from-purple-900 via-purple-950 to-indigo-950 border-purple-500/50',
    badge: 'NU',
    textColor: 'text-purple-200',
    defaultColor: 'purple',
    chipColor: 'gold',
    flag: 'mastercard',
    logoSvg: (
      <div className="flex items-center gap-1">
        <span className="text-xl font-black tracking-tighter text-white font-sans lowercase italic">
          nu
        </span>
      </div>
    ),
  },
  Itaú: {
    id: 'Itaú',
    name: 'Itaú Click',
    gradient: 'from-slate-950 via-blue-950 to-orange-950 border-orange-500/50',
    badge: 'ITAÚ',
    textColor: 'text-orange-400',
    defaultColor: 'amber',
    chipColor: 'gold',
    flag: 'visa',
    logoSvg: (
      <div className="flex items-center gap-1.5">
        <div className="w-6 h-6 bg-orange-500 rounded-lg flex items-center justify-center font-black text-slate-950 text-[11px] leading-none shadow-md">
          i
        </div>
        <span className="text-sm font-black tracking-tight text-white font-sans">
          itaú
        </span>
      </div>
    ),
  },
  'Banco do Brasil': {
    id: 'Banco do Brasil',
    name: 'BB Ourocard',
    gradient: 'from-blue-950 via-indigo-950 to-slate-950 border-yellow-400/50',
    badge: 'OUROCARD',
    textColor: 'text-yellow-400',
    defaultColor: 'amber',
    chipColor: 'gold',
    flag: 'visa',
    logoSvg: (
      <div className="flex flex-col">
        <span className="text-[10px] font-black tracking-wider text-yellow-400 uppercase">
          BANCO DO BRASIL
        </span>
        <span className="text-[9px] font-bold tracking-widest text-slate-600 dark:text-slate-300 uppercase -mt-0.5">
          OUROCARD
        </span>
      </div>
    ),
  },
  Bradesco: {
    id: 'Bradesco',
    name: 'Bradesco Cartões',
    gradient: 'from-red-900 via-rose-950 to-slate-950 border-red-500/50',
    badge: 'BRADESCO',
    textColor: 'text-rose-300',
    defaultColor: 'rose',
    chipColor: 'silver',
    flag: 'visa',
    logoSvg: (
      <div className="flex items-center gap-1.5">
        <div className="w-5 h-5 rounded-md bg-white dark:bg-slate-900 text-red-600 font-extrabold text-[10px] flex items-center justify-center shadow-xs">
          B
        </div>
        <span className="text-xs font-black tracking-tight text-white uppercase">
          bradesco
        </span>
      </div>
    ),
  },
  Santander: {
    id: 'Santander',
    name: 'Santander SX',
    gradient: 'from-red-800 via-red-950 to-zinc-950 border-red-500/60',
    badge: 'SX',
    textColor: 'text-red-300',
    defaultColor: 'rose',
    chipColor: 'silver',
    flag: 'mastercard',
    logoSvg: (
      <div className="flex items-center gap-1">
        <svg className="w-5 h-5 text-white fill-current" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14.5h-2v-2h2v2zm0-4h-2V7h2v5.5z" />
        </svg>
        <span className="text-xs font-black tracking-tight text-white uppercase italic">
          Santander
        </span>
      </div>
    ),
  },
  Inter: {
    id: 'Inter',
    name: 'Banco Inter',
    gradient: 'from-orange-600 via-orange-700 to-slate-950 border-orange-400/60',
    badge: 'INTER',
    textColor: 'text-orange-200',
    defaultColor: 'amber',
    chipColor: 'silver',
    flag: 'mastercard',
    logoSvg: (
      <div className="flex items-center gap-1">
        <span className="text-base font-black tracking-tighter text-white font-sans lowercase">
          inter
        </span>
      </div>
    ),
  },
  'C6 Bank': {
    id: 'C6 Bank',
    name: 'C6 Carbon',
    gradient: 'from-zinc-900 via-neutral-950 to-black border-zinc-500/60',
    badge: 'CARBON',
    textColor: 'text-zinc-300',
    defaultColor: 'slate',
    chipColor: 'silver',
    flag: 'mastercard',
    logoSvg: (
      <div className="flex items-center gap-1">
        <span className="text-sm font-black tracking-tight text-white font-sans">
          C6<span className="font-light text-zinc-400">BANK</span>
        </span>
      </div>
    ),
  },
  XP: {
    id: 'XP',
    name: 'XP Visa Infinite',
    gradient: 'from-black via-zinc-950 to-slate-950 border-amber-500/70',
    badge: 'INFINITE',
    textColor: 'text-amber-300',
    defaultColor: 'amber',
    chipColor: 'gold',
    flag: 'visa',
    logoSvg: (
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-black tracking-wider text-amber-600 dark:text-amber-400 font-mono">
          XP
        </span>
        <span className="text-[9px] font-semibold text-amber-200/80 tracking-widest uppercase border-l border-amber-500/40 pl-1.5">
          INVESTIMENTOS
        </span>
      </div>
    ),
  },
  'BTG Pactual': {
    id: 'BTG Pactual',
    name: 'BTG Ultrablue',
    gradient: 'from-slate-950 via-blue-950 to-cyan-950 border-sky-400/60',
    badge: 'BTG',
    textColor: 'text-sky-300',
    defaultColor: 'blue',
    chipColor: 'silver',
    flag: 'mastercard',
    logoSvg: (
      <div className="flex items-center gap-1">
        <span className="text-xs font-black tracking-wider text-white uppercase">
          BTG PACTUAL
        </span>
      </div>
    ),
  },
  Caixa: {
    id: 'Caixa',
    name: 'Caixa Econômica',
    gradient: 'from-blue-900 via-blue-950 to-orange-950 border-sky-400/50',
    badge: 'CAIXA',
    textColor: 'text-sky-300',
    defaultColor: 'blue',
    chipColor: 'gold',
    flag: 'elo',
    logoSvg: (
      <div className="flex items-center gap-1">
        <span className="text-sm font-black tracking-widest text-white italic">
          CAIXA
        </span>
      </div>
    ),
  },
  Banrisul: {
    id: 'Banrisul',
    name: 'Banrisul',
    gradient: 'from-blue-800 via-sky-950 to-slate-950 border-sky-400/60',
    badge: 'BANRISUL',
    textColor: 'text-sky-300',
    defaultColor: 'blue',
    chipColor: 'silver',
    flag: 'mastercard',
    logoSvg: (
      <div className="flex items-center gap-1">
        <span className="text-xs font-black tracking-wider text-white uppercase italic">
          Banrisul
        </span>
      </div>
    ),
  },
  PicPay: {
    id: 'PicPay',
    name: 'PicPay Card',
    gradient: 'from-emerald-600 via-emerald-800 to-slate-950 border-emerald-400/60',
    badge: 'PICPAY',
    textColor: 'text-emerald-200',
    defaultColor: 'emerald',
    chipColor: 'silver',
    flag: 'mastercard',
    logoSvg: (
      <div className="flex items-center gap-1">
        <span className="text-sm font-black tracking-tight text-white font-sans">
          Pic<span className="text-emerald-300 font-extrabold">Pay</span>
        </span>
      </div>
    ),
  },
  'Mercado Pago': {
    id: 'Mercado Pago',
    name: 'Mercado Pago',
    gradient: 'from-sky-500 via-blue-700 to-slate-950 border-sky-300/60',
    badge: 'MP',
    textColor: 'text-sky-200',
    defaultColor: 'blue',
    chipColor: 'gold',
    flag: 'visa',
    logoSvg: (
      <div className="flex items-center gap-1">
        <span className="text-xs font-black tracking-tighter text-white uppercase italic">
          mercado<span className="text-amber-300">pago</span>
        </span>
      </div>
    ),
  },
  PagBank: {
    id: 'PagBank',
    name: 'PagBank',
    gradient: 'from-amber-500 via-yellow-700 to-slate-950 border-amber-300/60',
    badge: 'PAGBANK',
    textColor: 'text-amber-200',
    defaultColor: 'amber',
    chipColor: 'gold',
    flag: 'visa',
    logoSvg: (
      <div className="flex items-center gap-1">
        <span className="text-xs font-black tracking-tight text-white font-sans uppercase">
          Pag<span className="text-emerald-600 dark:text-emerald-400 font-black">Bank</span>
        </span>
      </div>
    ),
  },
  Neon: {
    id: 'Neon',
    name: 'Banco Neon',
    gradient: 'from-cyan-500 via-teal-700 to-slate-950 border-cyan-300/60',
    badge: 'NEON',
    textColor: 'text-cyan-200',
    defaultColor: 'blue',
    chipColor: 'silver',
    flag: 'visa',
    logoSvg: (
      <div className="flex items-center gap-1">
        <span className="text-sm font-black tracking-widest text-white font-sans lowercase">
          neon
        </span>
      </div>
    ),
  },
  Sicoob: {
    id: 'Sicoob',
    name: 'Sicoob',
    gradient: 'from-teal-800 via-cyan-950 to-slate-950 border-teal-400/60',
    badge: 'SICOOB',
    textColor: 'text-teal-300',
    defaultColor: 'emerald',
    chipColor: 'gold',
    flag: 'mastercard',
    logoSvg: (
      <div className="flex items-center gap-1">
        <span className="text-xs font-black tracking-widest text-white uppercase">
          SICOOB
        </span>
      </div>
    ),
  },
  Sicredi: {
    id: 'Sicredi',
    name: 'Sicredi',
    gradient: 'from-green-700 via-emerald-950 to-slate-950 border-green-400/60',
    badge: 'SICREDI',
    textColor: 'text-green-300',
    defaultColor: 'emerald',
    chipColor: 'gold',
    flag: 'mastercard',
    logoSvg: (
      <div className="flex items-center gap-1">
        <span className="text-xs font-black tracking-widest text-white font-sans">
          sicredi
        </span>
      </div>
    ),
  },
  Nomad: {
    id: 'Nomad',
    name: 'Nomad Global',
    gradient: 'from-yellow-400 via-amber-600 to-slate-950 border-yellow-300/60',
    badge: 'NOMAD',
    textColor: 'text-amber-200',
    defaultColor: 'amber',
    chipColor: 'gold',
    flag: 'visa',
    logoSvg: (
      <div className="flex items-center gap-1">
        <span className="text-xs font-black tracking-widest text-slate-950 uppercase bg-yellow-400 px-1 py-0.5 rounded">
          NOMAD
        </span>
      </div>
    ),
  },
  Wise: {
    id: 'Wise',
    name: 'Wise Account',
    gradient: 'from-lime-500 via-emerald-800 to-slate-950 border-lime-300/60',
    badge: 'WISE',
    textColor: 'text-lime-200',
    defaultColor: 'emerald',
    chipColor: 'silver',
    flag: 'visa',
    logoSvg: (
      <div className="flex items-center gap-1">
        <span className="text-xs font-black tracking-wider text-lime-300 uppercase italic">
          Wise
        </span>
      </div>
    ),
  },
};

export const RealisticBankCard: React.FC<{
  cardName: string;
  bankName: string;
  lastDigits: string;
  limitDisplay: string;
  color?: CardConfig['color'];
  compact?: boolean;
}> = ({
  cardName,
  bankName,
  lastDigits,
  limitDisplay,
  color = 'purple',
  compact = false,
}) => {
  const preset = BANK_PRESETS[bankName] || {
    id: 'Outro',
    name: bankName || 'Cartão',
    gradient:
      color === 'emerald'
        ? 'from-emerald-900 via-teal-950 to-slate-950 border-emerald-500/50'
        : color === 'rose'
        ? 'from-rose-900 via-rose-950 to-slate-950 border-rose-500/50'
        : color === 'amber'
        ? 'from-amber-900 via-slate-950 to-amber-950 border-amber-500/50'
        : color === 'blue'
        ? 'from-blue-900 via-slate-950 to-cyan-950 border-blue-500/50'
        : color === 'slate'
        ? 'from-zinc-900 via-zinc-950 to-black border-zinc-500/50'
        : 'from-purple-900 via-purple-950 to-slate-950 border-purple-500/50',
    badge: 'CARD',
    textColor: 'text-slate-800 dark:text-slate-200',
    defaultColor: color,
    chipColor: 'gold',
    flag: 'mastercard',
    logoSvg: (
      <span className="text-xs font-extrabold uppercase tracking-widest text-white">
        {bankName || 'CARTÃO'}
      </span>
    ),
  };

  const isGoldChip = preset.chipColor === 'gold';

  return (
    <div
      className={`relative w-full ${
        compact ? 'aspect-[2.1/1] p-3 rounded-xl' : 'aspect-[1.58/1] p-5 rounded-2xl'
      } bg-gradient-to-br ${preset.gradient} shadow-2xl overflow-hidden flex flex-col justify-between group transition-all duration-300 border border-white/10`}
    >
      {/* Visual Textures per Bank */}
      {bankName === 'Nubank' && (
        <div className="absolute -right-10 -bottom-10 w-44 h-44 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />
      )}
      {bankName === 'Itaú' && (
        <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-orange-500/20 rounded-full blur-xl pointer-events-none" />
      )}
      {bankName === 'Banco do Brasil' && (
        <div className="absolute right-0 top-0 bottom-0 w-1/2 opacity-15 pointer-events-none overflow-hidden">
          <div className="w-full h-full transform rotate-12 scale-125 bg-[repeating-linear-gradient(45deg,#facc15,#facc15_8px,transparent_8px,transparent_16px)]" />
        </div>
      )}
      {bankName === 'Bradesco' && (
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-red-500/20 rounded-full blur-2xl pointer-events-none" />
      )}
      {bankName === 'Santander' && (
        <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-red-600/25 rounded-full blur-xl pointer-events-none" />
      )}
      {bankName === 'Inter' && (
        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-orange-400/20 rounded-full blur-2xl pointer-events-none" />
      )}
      {bankName === 'C6 Bank' && (
        <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:8px_8px]" />
      )}
      {bankName === 'XP' && (
        <div className="absolute inset-0 border border-amber-500/30 rounded-xl pointer-events-none m-1.5" />
      )}
      {bankName === 'BTG Pactual' && (
        <div className="absolute inset-0 opacity-15 pointer-events-none bg-[linear-gradient(to_right,#38bdf8_1px,transparent_1px),linear-gradient(to_bottom,#38bdf8_1px,transparent_1px)] bg-[size:10px_10px]" />
      )}
      {bankName === 'Caixa' && (
        <div className="absolute right-0 top-0 bottom-0 w-1/2 opacity-25 pointer-events-none">
          <div className="w-full h-full bg-gradient-to-br from-amber-500 via-sky-400 to-transparent transform -skew-x-12" />
        </div>
      )}
      {bankName === 'Banrisul' && (
        <div className="absolute -right-6 -top-6 w-36 h-36 bg-sky-400/20 rounded-full blur-2xl pointer-events-none" />
      )}
      {bankName === 'PicPay' && (
        <div className="absolute -right-10 -bottom-10 w-44 h-44 bg-emerald-400/25 rounded-full blur-2xl pointer-events-none" />
      )}
      {bankName === 'Mercado Pago' && (
        <div className="absolute -right-8 -top-8 w-36 h-36 bg-sky-300/25 rounded-full blur-xl pointer-events-none" />
      )}
      {bankName === 'PagBank' && (
        <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-amber-400/20 rounded-full blur-2xl pointer-events-none" />
      )}
      {bankName === 'Neon' && (
        <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-cyan-400/30 rounded-full blur-2xl pointer-events-none" />
      )}
      {bankName === 'Sicoob' && (
        <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#2dd4bf_1px,transparent_1px)] [background-size:10px_10px]" />
      )}
      {bankName === 'Sicredi' && (
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-emerald-500/20 rounded-full blur-2xl pointer-events-none" />
      )}
      {bankName === 'Nomad' && (
        <div className="absolute inset-0 border border-amber-400/40 rounded-xl pointer-events-none m-1" />
      )}
      {bankName === 'Wise' && (
        <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-lime-400/20 rounded-full blur-xl pointer-events-none" />
      )}

      {/* Topo do Cartão: Banco Logo & Flag */}
      <div className="flex items-start justify-between relative z-10">
        <div>
          <div className="flex items-center gap-2">
            {preset.logoSvg}
            {preset.badge && (
              <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-white/10 text-white border border-white/20 uppercase tracking-widest">
                {preset.badge}
              </span>
            )}
          </div>
          <p className="text-[9px] font-medium text-slate-400 tracking-wide mt-1">
            {cardName || 'Meu Cartão'}
          </p>
        </div>

        {/* Flag (Bandeira) */}
        <div className="flex items-center">
          {preset.flag === 'mastercard' && (
            <div className="flex -space-x-2">
              <div className="w-5 h-5 rounded-full bg-rose-500/90 shadow-md" />
              <div className="w-5 h-5 rounded-full bg-amber-400/90 shadow-md" />
            </div>
          )}
          {preset.flag === 'visa' && (
            <span className="text-xs font-black italic tracking-tighter text-white font-sans drop-shadow-sm">
              VISA
            </span>
          )}
          {preset.flag === 'elo' && (
            <div className="flex items-center -space-x-0.5 font-black text-xs text-white">
              <span className="text-rose-500">e</span>
              <span className="text-amber-400">l</span>
              <span className="text-sky-400">o</span>
            </div>
          )}
        </div>
      </div>

      {/* Meio: Chip + Contactless + Números Ocultos */}
      <div className="relative z-10 my-0.5">
        <div className="flex items-center gap-2 mb-1.5">
          {/* Chip */}
          <div
            className={`w-7 h-5 rounded-md border flex flex-col justify-between p-0.5 shadow-inner ${
              isGoldChip
                ? 'bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 border-amber-300/60'
                : 'bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400 border-slate-300/80'
            }`}
          >
            <div className={`h-[1px] w-full ${isGoldChip ? 'bg-amber-100 dark:bg-amber-900/40' : 'bg-slate-200 dark:bg-slate-700'}`} />
            <div className={`h-[1px] w-full ${isGoldChip ? 'bg-amber-100 dark:bg-amber-900/40' : 'bg-slate-200 dark:bg-slate-700'}`} />
          </div>

          {/* Contactless */}
          <svg className="w-3.5 h-3.5 text-white/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8.5 14.5A5 5 0 0 1 8.5 9.5" />
            <path d="M12 17a8 8 0 0 0 0-10" />
            <path d="M15.5 19.5a11 11 0 0 0 0-15" />
          </svg>
        </div>

        <p className={`${compact ? 'text-[10px]' : 'text-xs'} text-slate-100 tracking-widest font-mono drop-shadow-xs`}>
          •••• •••• •••• {lastDigits || '8842'}
        </p>
      </div>

      {/* Rodapé: Limite + Validade */}
      <div className="flex items-end justify-between relative z-10">
        <div>
          <p className="text-[8px] uppercase tracking-wider text-slate-400 font-medium">
            Limite Disponível
          </p>
          <p className={`${compact ? 'text-xs' : 'text-base'} font-extrabold text-white tracking-tight drop-shadow-xs`}>
            {limitDisplay}
          </p>
        </div>

        <div className="text-right">
          <p className="text-[8px] uppercase tracking-wider text-slate-400 font-medium">
            Validade
          </p>
          <p className="text-[10px] font-semibold text-slate-100">
            08/29
          </p>
        </div>
      </div>
    </div>
  );
};

interface CreditCardEdgePanelProps {
  transactions: Transaction[];
  monthFilter: string;
  onEditTransaction?: (transaction: Transaction) => void;
  cards: CardConfig[];
  setCards: React.Dispatch<React.SetStateAction<CardConfig[]>>;
  onPayCard?: (payload: { cardId: string; cardName: string; amount: number; date: string; description?: string }) => void;
  /** Incremente esse número (ex: Date.now()) pra abrir o painel de fora
   *  (ex: um botão na tela de Configurações), sem duplicar o estado isOpen. */
  externalOpenSignal?: number;
}

export const CreditCardEdgePanel: React.FC<CreditCardEdgePanelProps> = ({
  transactions,
  monthFilter,
  onEditTransaction,
  cards,
  setCards,
  onPayCard,
  externalOpenSignal,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (externalOpenSignal) setIsOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalOpenSignal]);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [payDescription, setPayDescription] = useState('');

  const [activeCardId, setActiveCardId] = useState<string | null>(() => cards[0]?.id || null);

  // Sync active card if cards array changes
  useEffect(() => {
    if (cards.length > 0) {
      if (!activeCardId || !cards.some((c) => c.id === activeCardId)) {
        setActiveCardId(cards[0].id);
      }
    } else {
      setActiveCardId(null);
    }
  }, [cards, activeCardId]);

  // Modals / Editing States
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CardConfig | null>(null);

  // Form State for Adding / Editing Card
  const [cardForm, setCardForm] = useState<{
    name: string;
    bank: string;
    lastDigits: string;
    limit: string;
    closingDay: string;
    dueDay: string;
    color: CardConfig['color'];
  }>({
    name: '',
    bank: 'Nubank',
    lastDigits: '',
    limit: '',
    closingDay: '25',
    dueDay: '02',
    color: 'purple',
  });

  const activeCard = useMemo(() => {
    if (!activeCardId) return null;
    return cards.find((c) => c.id === activeCardId) || cards[0] || null;
  }, [cards, activeCardId]);

  // Transações vinculadas de fato ao cartão ativo (via cardId) — antes somava
  // TODAS as despesas do mês, mesmo sem relação com nenhum cartão específico.
  const cardTransactions = useMemo(() => {
    if (!activeCardId) return [];
    return transactions.filter((t) => {
      const matchesMonth = monthFilter === 'all' || (t.date && t.date.startsWith(monthFilter));
      if (!matchesMonth) return false;
      const isCardExpense = t.type === 'expense' && t.cardId === activeCardId;
      const isCardPayment = t.cardPaymentFor === activeCardId;
      return isCardExpense || isCardPayment;
    });
  }, [transactions, monthFilter, activeCardId]);

  // Limite usado ACUMULADO: soma despesas do cartão menos pagamentos de fatura
  // de TODA a história até o fim do mês selecionado (não só o mês atual) —
  // assim, se você não pagou tudo, o restante continua aparecendo nos meses
  // seguintes, igual o saldo geral do app.
  //
  // Exceção: despesas RECORRENTES ("repetir por X meses") não empilham com
  // meses anteriores — cada ocorrência é uma cobrança nova daquele mês (tipo
  // uma assinatura), não uma dívida antiga que carrega pro mês seguinte. Só
  // conta pro limite usado quando cai exatamente no mês selecionado.
  const usedLimit = useMemo(() => {
    if (!activeCardId) return 0;
    const cumulative = transactions.reduce((acc, t) => {
      if (!t.date) return acc;
      const txMonth = t.date.slice(0, 7);
      if (monthFilter !== 'all' && txMonth > monthFilter) return acc; // ainda não aconteceu até o mês selecionado
      if (t.type === 'expense' && t.cardId === activeCardId) {
        if (t.isRecurring && monthFilter !== 'all' && txMonth !== monthFilter) return acc;
        return acc + t.amount;
      }
      if (t.cardPaymentFor === activeCardId) return acc - t.amount;
      return acc;
    }, 0);
    return Math.max(0, cumulative);
  }, [transactions, monthFilter, activeCardId]);

  const remainingLimit = activeCard ? Math.max(0, activeCard.limit - usedLimit) : 0;
  const usagePercentage = activeCard
    ? Math.min(100, Math.round((usedLimit / (activeCard.limit || 1)) * 100))
    : 0;

  const getProgressColor = () => {
    if (usagePercentage > 85) return 'bg-rose-500 text-rose-600 dark:text-rose-400';
    if (usagePercentage > 60) return 'bg-amber-500 text-amber-600 dark:text-amber-400';
    return 'bg-emerald-500 text-emerald-600 dark:text-emerald-400';
  };

  const getCardGradient = (bankName?: string, color?: CardConfig['color']) => {
    if (bankName && BANK_PRESETS[bankName]) {
      return BANK_PRESETS[bankName].gradient;
    }
    switch (color) {
      case 'purple':
        return 'from-slate-900 via-purple-950 to-slate-900 border-purple-500/30';
      case 'amber':
        return 'from-slate-900 via-amber-950 to-slate-900 border-amber-500/30';
      case 'rose':
        return 'from-slate-900 via-rose-950 to-slate-900 border-rose-500/30';
      case 'blue':
        return 'from-slate-900 via-blue-950 to-slate-900 border-blue-500/30';
      case 'slate':
        return 'from-slate-900 via-slate-800 to-slate-950 border-slate-300 dark:border-slate-700';
      case 'emerald':
      default:
        return 'from-slate-900 via-emerald-950 to-slate-900 border-emerald-500/30';
    }
  };

  const handleOpenAddCard = () => {
    setEditingCard(null);
    setCardForm({
      name: 'Meu Cartão',
      bank: 'Nubank',
      lastDigits: '8842',
      limit: '5000',
      closingDay: '25',
      dueDay: '02',
      color: 'purple',
    });
    setIsCardModalOpen(true);
  };

  const handleOpenEditCard = () => {
    if (!activeCard) return;
    setEditingCard(activeCard);
    setCardForm({
      name: activeCard.name,
      bank: activeCard.bank,
      lastDigits: activeCard.lastDigits,
      limit: activeCard.limit.toString(),
      closingDay: activeCard.closingDay.toString(),
      dueDay: activeCard.dueDay.toString(),
      color: activeCard.color,
    });
    setIsCardModalOpen(true);
  };

  const handleSaveCard = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedLimit = parseFloat(cardForm.limit.replace(',', '.')) || 1000;
    const parsedClosing = parseInt(cardForm.closingDay, 10) || 25;
    const parsedDue = parseInt(cardForm.dueDay, 10) || 2;

    const chosenColor = BANK_PRESETS[cardForm.bank]?.defaultColor || cardForm.color;

    if (editingCard) {
      setCards((prev) =>
        prev.map((c) =>
          c.id === editingCard.id
            ? {
                ...c,
                name: cardForm.name || 'Cartão',
                bank: cardForm.bank || 'Outro',
                lastDigits: cardForm.lastDigits.slice(-4) || '0000',
                limit: parsedLimit,
                closingDay: parsedClosing,
                dueDay: parsedDue,
                color: chosenColor,
              }
            : c
        )
      );
    } else {
      const newCard: CardConfig = {
        id: `card-${Date.now()}`,
        name: cardForm.name || 'Novo Cartão',
        bank: cardForm.bank || 'Outro',
        lastDigits: cardForm.lastDigits.slice(-4) || '1234',
        limit: parsedLimit,
        closingDay: parsedClosing,
        dueDay: parsedDue,
        color: chosenColor,
      };
      setCards((prev) => [...prev, newCard]);
      setActiveCardId(newCard.id);
    }

    setIsCardModalOpen(false);
  };

  const [cardToDelete, setCardToDelete] = useState<CardConfig | null>(null);

  const handleDeleteCard = (card: CardConfig) => {
    setCardToDelete(card);
  };

  const confirmDeleteCard = () => {
    if (!cardToDelete) return;
    const filtered = cards.filter((c) => c.id !== cardToDelete.id);
    setCards(filtered);
    if (filtered.length > 0) {
      setActiveCardId(filtered[0].id);
    } else {
      setActiveCardId(null);
    }
    setCardToDelete(null);
    if (isCardModalOpen) {
      setIsCardModalOpen(false);
    }
  };

  return (
    <>
      {/* Botão Flutuante da Borda (Edge Handle) */}
      <motion.button
        type="button"
        onClick={() => setIsOpen(true)}
        initial={{ x: 20 }}
        animate={{ x: isOpen ? 100 : 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 200 }}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-white/90 dark:bg-slate-900/90 hover:bg-slate-100 dark:hover:bg-slate-800 text-emerald-600 dark:text-emerald-400 border-l border-y border-emerald-500/30 pl-2.5 pr-1.5 py-4 rounded-l-2xl shadow-2xl backdrop-blur-md flex items-center gap-1.5 group cursor-pointer transition-colors"
        title="Abrir Painel de Cartões de Crédito"
      >
        <div className="flex flex-col items-center gap-1">
          <ChevronLeft className="w-4 h-4 text-emerald-600 dark:text-emerald-400 group-hover:-translate-x-0.5 transition-transform" />
          <CreditCard className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <span className="text-[9px] font-bold uppercase tracking-wider [writing-mode:vertical-lr] rotate-180 text-slate-600 dark:text-slate-300">
            Cartão
          </span>
        </div>
      </motion.button>

      {/* Overlay Backdrop & Edge Drawer */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50"
            />

            {/* Painel Deslizante (Edge Panel) */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={{ left: 0, right: 0.8 }}
              onDragEnd={(_, info) => {
                if (info.offset.x > 100 || info.velocity.x > 500) {
                  setIsOpen(false);
                }
              }}
              className="fixed right-0 top-0 bottom-0 z-50 w-full sm:w-[420px] bg-white/95 dark:bg-slate-900/95 border-l border-slate-200 dark:border-slate-800 shadow-2xl backdrop-blur-xl flex flex-col justify-between overflow-hidden"
            >
              {/* Cabeçalho do Painel com Ações de Gerenciamento */}
              <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white dark:bg-slate-900">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-tight">
                      Meus Cartões
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Arraste para a direita para fechar
                    </p>
                  </div>
                </div>

                {/* Botões do Cabeçalho: Adicionar, Editar, Excluir e Fechar */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleOpenAddCard}
                    className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 transition active:scale-95 flex items-center gap-1 text-xs font-bold"
                    title="Adicionar Novo Cartão"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">Novo</span>
                  </button>

                  {activeCard && (
                    <button
                      type="button"
                      onClick={handleOpenEditCard}
                      className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 transition active:scale-95"
                      title="Editar Cartão Atual"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}

                  {activeCard && (
                    <button
                      type="button"
                      onClick={() => handleDeleteCard(activeCard)}
                      className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition active:scale-95"
                      title="Excluir Cartão Atual"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95 ml-1"
                    title="Fechar Painel"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Seletor de Cartões (Se houver múltiplos) */}
              {cards.length > 1 && (
                <div className="px-5 pt-3 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
                  {cards.map((card) => (
                    <button
                      key={card.id}
                      onClick={() => setActiveCardId(card.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition border ${
                        activeCardId === card.id
                          ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/50'
                          : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      {card.name} ({card.bank})
                    </button>
                  ))}
                </div>
              )}

              {/* Conteúdo do Painel */}
              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                {!activeCard ? (
                  /* Estado Vazio - Nenhum Cartão Cadastrado */
                  <div className="text-center py-12 px-4 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
                      <CreditCard className="w-8 h-8" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                        Nenhum cartão cadastrado
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                        Cadastre seu cartão de crédito (Nubank, Itaú, Bradesco, etc.) para gerenciar limites, vencimentos e compras.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleOpenAddCard}
                      className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition active:scale-95 inline-flex items-center gap-2 shadow-lg shadow-emerald-500/10"
                    >
                      <Plus className="w-4 h-4" />
                      Cadastrar Meu Primeiro Cartão
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Visualização do Cartão Selecionado com Design do Banco */}
                    <RealisticBankCard
                      cardName={activeCard.name}
                      bankName={activeCard.bank}
                      lastDigits={activeCard.lastDigits}
                      limitDisplay={`R$ ${remainingLimit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                      color={activeCard.color}
                    />

                    {/* Métricas do Limite & Edição Rápida */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                          <DollarSign className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          Limite Total Configurado
                        </span>

                        <button
                          type="button"
                          onClick={handleOpenEditCard}
                          className="flex items-center gap-1 text-xs font-bold text-slate-800 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 transition"
                        >
                          R$ {activeCard.limit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          <Edit2 className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                        </button>
                      </div>

                      {/* Barra de Progresso do Limite Usado */}
                      <div>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-slate-500 dark:text-slate-400">
                            Usado: <strong className="text-slate-800 dark:text-slate-200">R$ {usedLimit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                          </span>
                          <span className={`font-bold ${getProgressColor().split(' ')[1]}`}>{usagePercentage}%</span>
                        </div>

                        <div className="w-full h-2.5 bg-slate-50 dark:bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-200 dark:border-slate-800">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${usagePercentage}%` }}
                            transition={{ duration: 0.6, ease: 'easeOut' }}
                            className={`h-full rounded-full ${getProgressColor().split(' ')[0]}`}
                          />
                        </div>
                      </div>

                      {onPayCard && (
                        <button
                          type="button"
                          onClick={() => {
                            setPayAmount(usedLimit > 0 ? usedLimit.toFixed(2) : '');
                            setPayDate(new Date().toISOString().split('T')[0]);
                            setPayDescription('');
                            setIsPayModalOpen(true);
                          }}
                          className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-md shadow-emerald-950/30 flex items-center justify-center gap-1.5"
                        >
                          <CreditCard className="w-3.5 h-3.5" /> Pagar Fatura
                        </button>
                      )}

                      {/* Alerta de Consumo Elevado */}
                      {usagePercentage > 80 && (
                        <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl text-rose-700 dark:text-rose-300 text-xs">
                          <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                          <span>ATENÇÃO: Você utilizou mais de 80% do seu limite do cartão!</span>
                        </div>
                      )}
                    </div>

                    {/* Resumo de Fatura, Vencimento & Conta */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl">
                        <p className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                          <CalendarDays className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                          Fechamento Fatura
                        </p>
                        <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100">Dia {activeCard.closingDay}</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Melhor dia de compra</p>
                      </div>

                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl">
                        <p className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          Vencimento Fatura
                        </p>
                        <p className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">Dia {activeCard.dueDay}</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Vencimento mensal</p>
                      </div>
                    </div>

                    {/* Lista de Gastos Recentes no Cartão */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                          Despesas do Cartão ({cardTransactions.length})
                        </h3>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">
                          {monthFilter === 'all' ? 'Todos os meses' : 'Mês Selecionado'}
                        </span>
                      </div>

                      {cardTransactions.length === 0 ? (
                        <div className="text-center py-6 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                          <TrendingDown className="w-6 h-6 text-slate-400 dark:text-slate-500 mx-auto mb-1" />
                          <p className="text-xs text-slate-500 dark:text-slate-400">Nenhuma despesa registrada neste período.</p>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {cardTransactions.map((t) => {
                            const isPayment = t.cardPaymentFor === activeCardId;
                            return (
                            <div
                              key={t.id}
                              className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 hover:bg-white dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl transition group"
                            >
                              <div className="min-w-0 flex-1 pr-2">
                                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                                  {isPayment && '💳 '}{t.description || t.category}
                                </p>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                  {isPayment ? 'Pagamento de fatura' : t.category} • {t.date?.split('-').reverse().join('/')}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`text-xs font-bold ${isPayment ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                  {isPayment ? '+' : '-'} R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                                {onEditTransaction && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onEditTransaction(t);
                                    }}
                                    className="p-1 rounded-lg text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition active:scale-95"
                                    title="Editar esta transação"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Rodapé do Painel */}
              <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center shrink-0">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-medium text-xs transition active:scale-98"
                >
                  Fechar Painel
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Modal para Adicionar / Editar Cartão com Seleção do Banco */}
      <AnimatePresence>
        {isCardModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  {editingCard ? 'Editar Cartão' : 'Adicionar Novo Cartão'}
                </h3>
                <button
                  onClick={() => setIsCardModalOpen(false)}
                  className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveCard} className="space-y-4">
                {/* Seleção do Banco */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                    <span>Instituição Financeira / Banco</span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal">Ajusta o visual automaticamente</span>
                  </label>
                  <select
                    value={cardForm.bank}
                    onChange={(e) => {
                      const selectedBank = e.target.value;
                      const presetColor = BANK_PRESETS[selectedBank]?.defaultColor || cardForm.color;
                      setCardForm({
                        ...cardForm,
                        bank: selectedBank,
                        color: presetColor,
                      });
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500 font-medium"
                  >
                    {Object.keys(BANK_PRESETS).map((bankKey) => (
                      <option key={bankKey} value={bankKey}>
                        {BANK_PRESETS[bankKey].name}
                      </option>
                    ))}
                    <option value="Outro">Outro Banco (Personalizado)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Nome do Cartão (Apelido)
                  </label>
                  <input
                    type="text"
                    required
                    value={cardForm.name}
                    onChange={(e) => setCardForm({ ...cardForm, name: e.target.value })}
                    placeholder="Ex: Cartão Principal, Gold, Black, Corporativo"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Últimos 4 Dígitos
                    </label>
                    <input
                      type="text"
                      maxLength={4}
                      value={cardForm.lastDigits}
                      onChange={(e) => setCardForm({ ...cardForm, lastDigits: e.target.value })}
                      placeholder="8842"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Limite (R$)
                    </label>
                    <CurrencyInput
                      required
                      value={cardForm.limit}
                      onChange={(limit) => setCardForm({ ...cardForm, limit })}
                      placeholder="0,00"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500 font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Dia Fechamento Fatura
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={cardForm.closingDay}
                      onChange={(e) => setCardForm({ ...cardForm, closingDay: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Dia Vencimento Fatura
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={cardForm.dueDay}
                      onChange={(e) => setCardForm({ ...cardForm, dueDay: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Pré-visualização do Cartão em Tempo Real no Modal */}
                <div className="pt-2">
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-2">
                    Pré-visualização em Tempo Real
                  </label>
                  <RealisticBankCard
                    cardName={cardForm.name || 'Meu Cartão'}
                    bankName={cardForm.bank || 'Nubank'}
                    lastDigits={cardForm.lastDigits || '8842'}
                    limitDisplay={`R$ ${(parseFloat(cardForm.limit || '0') || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    color={cardForm.color}
                    compact
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
                  {editingCard ? (
                    <button
                      type="button"
                      onClick={() => handleDeleteCard(editingCard)}
                      className="px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Excluir Cartão
                    </button>
                  ) : (
                    <div />
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsCardModalOpen(false)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition active:scale-95"
                    >
                      Salvar Cartão
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Confirmação de Exclusão Sem Usar confirm Native */}
      <AnimatePresence>
        {cardToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl"
            >
              <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Excluir Cartão?</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Esta ação removerá o cartão da lista.</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                Tem certeza que deseja remover o cartão{' '}
                <strong className="text-slate-900 dark:text-white">{cardToDelete.name} ({cardToDelete.bank})</strong>?
              </p>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setCardToDelete(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteCard}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition active:scale-95 flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Sim, Excluir Cartão
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Pagamento de Fatura */}
      <AnimatePresence>
        {isPayModalOpen && activeCard && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              className="bg-white dark:bg-slate-900 border border-emerald-500/30 p-5 rounded-2xl w-full max-w-sm shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Pagar Fatura — {activeCard.name}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(false)}
                  className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4">
                Isso registra uma despesa que sai da sua conta e passa a contar
                no total do mês — as compras já feitas no cartão continuam
                registradas, mas só afetam o saldo geral a partir do pagamento.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                    Valor a pagar
                  </label>
                  <CurrencyInput
                    value={payAmount}
                    onChange={setPayAmount}
                    placeholder="0,00"
                    className="w-full bg-slate-50 dark:bg-slate-950 text-emerald-600 dark:text-emerald-400 font-bold text-lg px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setPayAmount(usedLimit.toFixed(2))}
                    className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 mt-1 font-medium"
                  >
                    Usar valor total usado (R$ {usedLimit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                    Data do pagamento
                  </label>
                  <input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 text-sm px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                    Descrição (opcional)
                  </label>
                  <input
                    type="text"
                    value={payDescription}
                    onChange={(e) => setPayDescription(e.target.value)}
                    placeholder={`Pagamento fatura - ${activeCard.name}`}
                    className="w-full bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 text-sm px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-2.5 mt-5">
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(false)}
                  className="py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!payAmount || parseFloat(payAmount) <= 0 || !payDate}
                  onClick={() => {
                    const amount = parseFloat(payAmount);
                    if (isNaN(amount) || amount <= 0 || !onPayCard) return;
                    onPayCard({
                      cardId: activeCard.id,
                      cardName: activeCard.name,
                      amount,
                      date: payDate,
                      description: payDescription,
                    });
                    setIsPayModalOpen(false);
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition shadow-md shadow-emerald-950/30"
                >
                  Confirmar Pagamento
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};


