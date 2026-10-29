import { useState, type ReactNode } from 'react';
import { ChevronRight, RefreshCw } from 'lucide-react';
import type { ThemePreference } from '../../lib/theme';
import type { BankSyncState, SyncOptions } from '../../lib/githubSync';

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
}

const THEME_OPTIONS: { key: ThemePreference; label: string }[] = [
  { key: 'light', label: 'Claro' },
  { key: 'dark', label: 'Escuro' },
  { key: 'system', label: 'Sistema' },
];

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="px-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</h3>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
        {children}
      </div>
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

const SYNC_ACTIONS: { label: string; hint: string; options: SyncOptions }[] = [
  { label: 'Buscar agora (rápido)', hint: '~30 s', options: { refresh: false, bank: 'todos' } },
  { label: 'Atualizar Mercado Pago', hint: '1–2 min', options: { refresh: true, bank: 'Mercado Pago' } },
  { label: 'Atualizar Nubank', hint: '1–3 min', options: { refresh: true, bank: 'Nubank' } },
  { label: 'Atualizar os dois bancos', hint: '2–4 min', options: { refresh: true, bank: 'todos' } },
];

function ShortcutKeyGroup({ getShortcutKey }: Pick<SettingsViewProps, 'getShortcutKey'>) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'manual'>('idle');
  const [manualKey, setManualKey] = useState('');

  const handleCopy = async () => {
    const key = getShortcutKey();
    if (!key) return;
    try {
      await navigator.clipboard.writeText(key);
      setStatus('copied');
    } catch {
      setManualKey(key); // sem permissão da área de transferência: mostra para copiar à mão
      setStatus('manual');
    }
  };

  return (
    <Group label="Atalho do iPhone">
      <button type="button" onClick={handleCopy} className={rowClass}>
        <span>Copiar chave do Atalho</span>
        <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500" />
      </button>
      {status === 'copied' && (
        <p role="status" className="px-4 py-2.5 text-xs text-emerald-600 dark:text-emerald-400">
          Chave copiada. Cole no começo do Atalho (veja docs/ATALHOS-IPHONE.md).
        </p>
      )}
      {status === 'manual' && (
        <div className="px-4 py-3">
          <label htmlFor="shortcut-key" className="block text-xs text-slate-400 dark:text-slate-500 mb-1">
            Toque e segure para copiar:
          </label>
          <input
            id="shortcut-key"
            readOnly
            value={manualKey}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
          />
        </div>
      )}
      <p className="px-4 py-2.5 text-xs text-slate-400 dark:text-slate-500">
        Quem tiver essa chave acessa os seus dados financeiros. Cole só no seu Atalho e não compartilhe o Atalho com ninguém.
      </p>
    </Group>
  );
}

function BankSyncGroup(props: Pick<SettingsViewProps, 'bankSync' | 'hasGithubToken' | 'onSyncNow' | 'onSaveGithubToken' | 'onClearGithubToken'>) {
  const [tokenDraft, setTokenDraft] = useState('');
  const busy = props.bankSync.status === 'starting' || props.bankSync.status === 'running';
  const statusColor =
    props.bankSync.status === 'error'
      ? 'text-rose-600 dark:text-rose-400'
      : props.bankSync.status === 'done'
      ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-slate-400 dark:text-slate-500';

  return (
    <Group label="Bancos (Open Finance)">
      {SYNC_ACTIONS.map((action) => (
        <button
          key={action.label}
          type="button"
          onClick={() => props.onSyncNow(action.options)}
          disabled={busy}
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
        <p role="status" className={`px-4 py-2.5 text-xs ${statusColor}`}>{props.bankSync.message}</p>
      )}

      {props.hasGithubToken ? (
        <button type="button" onClick={props.onClearGithubToken} className={rowClass}>
          <span>Token do GitHub</span>
          <span className="text-sm text-slate-400 dark:text-slate-500">Configurado · remover</span>
        </button>
      ) : (
        <form
          className="px-4 py-3 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (tokenDraft.trim()) {
              props.onSaveGithubToken(tokenDraft.trim());
              setTokenDraft('');
            }
          }}
        >
          <label htmlFor="github-token" className="block text-[15px] text-slate-900 dark:text-slate-100">
            Token do GitHub
          </label>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Crie um token restrito ao repositório financy, só com a permissão Actions (leitura e escrita). Ele fica salvo apenas neste aparelho.
          </p>
          <div className="flex gap-2">
            <input
              id="github-token"
              type="password"
              autoComplete="off"
              value={tokenDraft}
              onChange={(e) => setTokenDraft(e.target.value)}
              placeholder="github_pat_…"
              className="flex-1 min-w-0 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={!tokenDraft.trim()}
              className="px-4 rounded-xl bg-[#1c1c1e] dark:bg-white text-white dark:text-slate-900 text-sm font-semibold disabled:opacity-40"
            >
              Salvar
            </button>
          </div>
        </form>
      )}
    </Group>
  );
}

export default function SettingsView(props: SettingsViewProps) {
  const initial = (props.userName || props.userEmail || '?').charAt(0).toUpperCase();

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm p-4 flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-[#1c1c1e] dark:bg-white text-white dark:text-slate-900 flex items-center justify-center text-lg font-bold">
          {initial}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">{props.userName || 'Minha conta'}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{props.userEmail}</p>
        </div>
      </div>

      <Group label="Aparência">
        <div className="px-4 py-3 space-y-2">
          <p className="text-[15px] text-slate-900 dark:text-slate-100">Tema</p>
          <div role="radiogroup" aria-label="Tema" className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                role="radio"
                aria-checked={props.theme === opt.key}
                onClick={() => props.onThemeChange(opt.key)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                  props.theme === opt.key
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </Group>

      <Group label="Registro">
        <Row label="Categorias de gasto" value={`${props.expenseCategories} ativas`} onClick={props.onOpenCategories} />
        <Row label="Categorias de receita" value={`${props.incomeCategories} ativas`} onClick={props.onOpenCategories} />
        <Row label="Cartões de crédito" value={`${props.cardsCount} ativos`} onClick={props.onOpenCards} />
        <Row label="Planejamento" value="Dívidas e metas" onClick={props.onOpenPlanning} />
      </Group>

      <BankSyncGroup
        bankSync={props.bankSync}
        hasGithubToken={props.hasGithubToken}
        onSyncNow={props.onSyncNow}
        onSaveGithubToken={props.onSaveGithubToken}
        onClearGithubToken={props.onClearGithubToken}
      />

      <ShortcutKeyGroup getShortcutKey={props.getShortcutKey} />

      <Group label="Seus dados">
        <Row label="Exportar JSON" onClick={props.onExportJSON} />
        <Row label="Exportar CSV" onClick={props.onExportCSV} />
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

      <Group label="Conta">
        <button
          type="button"
          onClick={props.onLogout}
          className={`${rowClass} text-rose-600 dark:text-rose-400 font-semibold`}
        >
          Sair da conta
        </button>
      </Group>
    </div>
  );
}
