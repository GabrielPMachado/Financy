import { useEffect, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Database, KeyRound, Landmark, LogOut, Palette, RefreshCw, type LucideIcon } from 'lucide-react';
import type { ThemePreference } from '../../lib/theme';
import type { BankSyncState, SyncOptions } from '../../lib/githubSync';
import { isIOS } from '../../lib/orbitaBridge';
import { updateLook, useLook } from '../../lib/appearance';
import AppearanceGroup from './AppearanceGroup';
import ConnectionsGroup, { useConnections } from './ConnectionsGroup';

interface SettingsViewProps {
  userName?: string;
  userEmail?: string | null;
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  expenseCategories: number;
  incomeCategories: number;
  cardsCount: number;
  onOpenCategories: () => void;
  onOpenCards: () => void;
  onOpenPlanning: () => void;
  onExportJSON: () => void;
  onExportCSV: () => void;
  onImportFile: (file: File) => void;
  onLogout: () => void;
  bankSync: BankSyncState;
  hasGithubToken: boolean;
  onSyncNow: (options: SyncOptions) => void;
  onSaveGithubToken: (token: string) => void;
  onClearGithubToken: () => void;
  /** Chave de acesso do Atalho do iPhone (token de atualização da sessão atual). */
  getShortcutKey: () => string;
  /** a permissão ou a preferência de lembretes mudou: reagendar */
  onRemindersChanged?: () => void;
}

type Page = 'main' | 'conexoes' | 'aparencia' | 'bancos' | 'dados';

const THEME_OPTIONS: { key: ThemePreference; label: string }[] = [
  { key: 'light', label: 'Claro' },
  { key: 'dark', label: 'Escuro' },
  { key: 'system', label: 'Sistema' },
];

function Group({ label, children, footer }: { label?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <section className="space-y-2">
      {label && <h3 className="px-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</h3>}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">{children}</div>
      {footer && <p className="px-2 text-xs text-slate-400 dark:text-slate-500">{footer}</p>}
    </section>
  );
}

const rowClass =
  'w-full flex items-center justify-between gap-3 px-4 min-h-[52px] text-left text-[15px] text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition';

function Row({ label, value, onClick }: { label: string; value?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={rowClass}>
      <span>{label}</span>
      <span className="flex items-center gap-1 text-sm text-slate-400 dark:text-slate-500">
        {value}
        <ChevronRight className="w-4 h-4" />
      </span>
    </button>
  );
}

/** Linha do menu: ícone, título, resumo e seta para a subtela. */
function NavRow({ icon: Icon, tone, label, hint, badge, onClick }: { icon: LucideIcon; tone: string; label: string; hint: string; badge?: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`${rowClass} min-h-[60px] py-2`}>
      <span className={`flex-none w-9 h-9 rounded-xl flex items-center justify-center ${tone}`}>
        <Icon className="w-[18px] h-[18px]" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block">{label}</span>
        <span className="block text-xs text-slate-400 dark:text-slate-500 truncate">{hint}</span>
      </span>
      {badge}
      <ChevronRight className="flex-none w-4 h-4 text-slate-400 dark:text-slate-500" />
    </button>
  );
}

function Switch({ on, label, hint, onToggle }: { on: boolean; label: string; hint?: string; onToggle: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={onToggle} className={`${rowClass} py-2`}>
      <span>
        {label}
        {hint && <span className="block text-xs text-slate-400 dark:text-slate-500">{hint}</span>}
      </span>
      <span className={`flex-none w-10 h-6 rounded-full p-0.5 transition ${on ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
        <span className={`block w-5 h-5 rounded-full bg-white transition ${on ? 'translate-x-4' : ''}`} />
      </span>
    </button>
  );
}

const SYNC_ACTIONS: { label: string; hint: string; options: SyncOptions }[] = [
  { label: 'Buscar agora (rápido)', hint: '~30 s', options: { refresh: false, bank: 'todos' } },
  { label: 'Atualizar Mercado Pago', hint: '1–2 min', options: { refresh: true, bank: 'Mercado Pago' } },
  { label: 'Atualizar Nubank', hint: '1–3 min', options: { refresh: true, bank: 'Nubank' } },
  { label: 'Atualizar os dois bancos', hint: '2–4 min', options: { refresh: true, bank: 'todos' } },
];

function SubPage({ title, onBack, children }: { title: string; onBack: () => void; children: ReactNode }) {
  return (
    <div className="space-y-6">
      <div className="-ml-2">
        <button type="button" onClick={onBack} className="flex items-center gap-0.5 px-2 min-h-[44px] text-[15px] font-semibold text-emerald-600 dark:text-emerald-400">
          <ChevronLeft className="w-5 h-5" />
          Ajustes
        </button>
        <h2 className="px-3 text-2xl font-bold text-slate-900 dark:text-slate-100">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export default function SettingsView(props: SettingsViewProps) {
  const [page, setPage] = useState<Page>('main');
  const look = useLook();
  const conns = useConnections(props);
  const initial = (props.userName || props.userEmail || '?').charAt(0).toUpperCase();
  const busy = props.bankSync.status === 'starting' || props.bankSync.status === 'running';

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [page]);

  const warn = conns.filter((c) => c.status === 'warn');
  const ok = conns.filter((c) => c.status === 'ok').length;
  const back = () => setPage('main');

  let content: ReactNode;
  if (page === 'conexoes') {
    content = (
      <SubPage title="Contas e conexões" onBack={back}>
        <ConnectionsGroup {...props} />
      </SubPage>
    );
  } else if (page === 'aparencia') {
    content = (
      <SubPage title="Aparência" onBack={back}>
        <Group label="Tema">
          <div className="px-4 py-3">
            <div role="radiogroup" aria-label="Tema" className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  role="radio"
                  aria-checked={props.theme === opt.key}
                  onClick={() => props.onThemeChange(opt.key)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                    props.theme === opt.key ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </Group>
        <AppearanceGroup Group={Group} />
        {isIOS && (
          <Group footer="Cor, ícones e ícone do app iguais nos dois: o que você mudar num muda no outro.">
            <Switch on={look.sincronizar} label="Mesma aparência do Órbita" onToggle={() => updateLook({ sincronizar: !look.sincronizar })} />
          </Group>
        )}
      </SubPage>
    );
  } else if (page === 'bancos') {
    const statusColor =
      props.bankSync.status === 'error'
        ? 'text-rose-600 dark:text-rose-400'
        : props.bankSync.status === 'done'
          ? 'text-emerald-600 dark:text-emerald-400'
          : 'text-slate-400 dark:text-slate-500';
    content = (
      <SubPage title="Atualizar bancos" onBack={back}>
        <Group footer="Os bancos atualizam sozinhos. Use isto só se quiser forçar agora.">
          {SYNC_ACTIONS.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => props.onSyncNow(action.options)}
              disabled={busy || !props.hasGithubToken}
              className={`${rowClass} disabled:opacity-60`}
            >
              <span>{action.label}</span>
              <span className="flex items-center gap-2 text-sm text-slate-400 dark:text-slate-500">
                {action.hint}
                <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />
              </span>
            </button>
          ))}
          {props.bankSync.message && (
            <p role="status" className={`px-4 py-2.5 text-xs ${statusColor}`}>
              {props.bankSync.message}
            </p>
          )}
          {!props.hasGithubToken && (
            <button type="button" onClick={() => setPage('conexoes')} className={rowClass}>
              <span className="text-sm text-amber-600 dark:text-amber-400">Falta o token do GitHub: salve em Contas e conexões › Bancos</span>
              <ChevronRight className="flex-none w-4 h-4 text-amber-600 dark:text-amber-400" />
            </button>
          )}
        </Group>
      </SubPage>
    );
  } else if (page === 'dados') {
    content = (
      <SubPage title="Seus dados" onBack={back}>
        <Group footer="Tudo já fica salvo na sua conta. O arquivo é uma cópia extra para guardar.">
          <Row label="Exportar JSON" value="backup completo" onClick={props.onExportJSON} />
          <Row label="Exportar CSV" value="para planilhas" onClick={props.onExportCSV} />
          <label className={`${rowClass} cursor-pointer`}>
            <span>Importar JSON</span>
            <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500" />
            <input
              type="file"
              accept="application/json"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) props.onImportFile(file);
                e.target.value = '';
              }}
            />
          </label>
        </Group>
      </SubPage>
    );
  } else {
    content = (
      <div className="space-y-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#1c1c1e] dark:bg-white text-white dark:text-slate-900 flex items-center justify-center text-lg font-bold">{initial}</div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">{props.userName || 'Minha conta'}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{props.userEmail}</p>
          </div>
        </div>

        <Group label="Contas e conexões">
          <NavRow
            icon={KeyRound}
            tone={warn.length ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'}
            label="Logins e conexões"
            hint={warn.length ? `${warn.map((c) => c.name).join(', ')} precisa${warn.length > 1 ? 'm' : ''} de atenção` : `${ok} de ${conns.length} conectados · conta, Órbita, bancos…`}
            badge={
              warn.length ? (
                <span className="flex-none min-w-[22px] h-[22px] px-1.5 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center">{warn.length}</span>
              ) : undefined
            }
            onClick={() => setPage('conexoes')}
          />
        </Group>

        <Group label="Registro">
          <Row label="Categorias de gasto" value={`${props.expenseCategories} ativas`} onClick={props.onOpenCategories} />
          <Row label="Categorias de receita" value={`${props.incomeCategories} ativas`} onClick={props.onOpenCategories} />
          <Row label="Cartões de crédito" value={`${props.cardsCount} ativos`} onClick={props.onOpenCards} />
          <Row label="Planejamento" value="Dívidas e metas" onClick={props.onOpenPlanning} />
        </Group>

        <Group label="App">
          <NavRow
            icon={Palette}
            tone="bg-violet-500/15 text-violet-600 dark:text-violet-400"
            label="Aparência"
            hint="Tema, cor, ícones e ícone do app"
            onClick={() => setPage('aparencia')}
          />
          <NavRow
            icon={Landmark}
            tone="bg-amber-500/15 text-amber-600 dark:text-amber-400"
            label="Atualizar bancos"
            hint={busy ? 'Atualizando…' : 'Forçar a busca no Nubank e no Mercado Pago'}
            onClick={() => setPage('bancos')}
          />
          <NavRow
            icon={Database}
            tone="bg-sky-500/15 text-sky-600 dark:text-sky-400"
            label="Seus dados"
            hint="Exportar e importar backup"
            onClick={() => setPage('dados')}
          />
        </Group>

        <Group>
          <button type="button" onClick={props.onLogout} className={rowClass}>
            <span className="font-semibold text-rose-600 dark:text-rose-400">Sair da conta</span>
            <LogOut className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </button>
        </Group>

        <p className="text-center text-xs text-slate-400 dark:text-slate-500">Financy {__APP_VERSION__}</p>
      </div>
    );
  }

  return (
    <motion.div key={page} initial={{ opacity: 0, x: page === 'main' ? -12 : 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}>
      {content}
    </motion.div>
  );
}
