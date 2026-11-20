import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Bell, CheckCircle2, Smartphone, ChevronRight, Landmark, Loader2, LogIn, Orbit, PlugZap, UserRound, XCircle, type LucideIcon } from 'lucide-react';
import { orbitaStatus, testAccount, testOrbita, vistoHa, type OrbitaStatus } from '../../lib/connections';
import { testGithubToken } from '../../lib/githubSync';
import { askNotifPermission, lembretesOn, notifAvailable, notifPermission, setLembretes, testNotification, type NotifPerm } from '../../lib/notifications';
import { connectOrbita, isIOS, openOrbita } from '../../lib/orbitaBridge';
import firebaseConfig from '../../../firebase-applet-config.json';

export type Status = 'ok' | 'warn' | 'off';
export interface Conn {
  id: string;
  name: string;
  icon: LucideIcon;
  color: string;
  status: Status;
  detail: string;
  login?: { label: string; run: () => void | Promise<unknown> };
  test?: () => Promise<string>;
  /** conteúdo extra no painel (formulário, chave) */
  extra?: ReactNode;
}
type Result = { ok: boolean; msg: string };

export interface ConnectionsProps {
  userEmail?: string | null;
  hasGithubToken: boolean;
  onSaveGithubToken: (token: string) => void;
  onClearGithubToken: () => void;
  onLogout: () => void;
  getShortcutKey: () => string;
  /** cartões e dívidas: para reagendar os lembretes quando a permissão mudar */
  onRemindersChanged?: () => void;
}

const BADGE: Record<Status, { label: string; cls: string }> = {
  ok: { label: 'Conectado', cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  warn: { label: 'Atenção', cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  off: { label: 'Desligado', cls: 'bg-slate-500/15 text-slate-500 dark:text-slate-400' },
};

const btn = 'flex-1 inline-flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl text-sm font-semibold transition disabled:opacity-50';
const btnPrimary = `${btn} bg-[#1c1c1e] dark:bg-white text-white dark:text-slate-900`;
const btnSecondary = `${btn} bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100`;

/** Conexões do Financy com o estado de cada uma (usado no menu e na tela de conexões). */
export function useConnections(props: ConnectionsProps): Conn[] {
  const [orbita, setOrbita] = useState<OrbitaStatus | undefined>(undefined);
  const [perm, setPerm] = useState<NotifPerm>('unavailable');
  const [lembretes, setLemb] = useState(lembretesOn());
  const [tokenDraft, setTokenDraft] = useState('');
  const [shortcut, setShortcut] = useState<'idle' | 'copied' | 'manual'>('idle');
  const [manualKey, setManualKey] = useState('');

  const loadOrbita = useCallback(() => {
    orbitaStatus()
      .then(setOrbita)
      .catch(() => setOrbita(null));
  }, []);
  useEffect(() => {
    if (isIOS) loadOrbita();
    notifPermission().then(setPerm).catch(() => {});
    const onVis = () => document.visibilityState === 'visible' && notifPermission().then(setPerm).catch(() => {});
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [loadOrbita]);

  const orbitaRecente = !!orbita && Date.now() - orbita.visto.getTime() < 3 * 864e5;

  const conns: Conn[] = [
    {
      id: 'conta',
      name: 'Conta Financy',
      icon: UserRound,
      color: 'text-sky-500',
      status: 'ok',
      detail: props.userEmail ? `Conectado como ${props.userEmail}` : 'Conectado',
      login: { label: 'Sair e entrar', run: props.onLogout },
      test: testAccount,
    },
    ...(isIOS
      ? [
          {
            id: 'orbita',
            name: 'Órbita',
            icon: Orbit,
            color: 'text-violet-500',
            status: (orbita ? (orbitaRecente ? 'ok' : 'warn') : 'off') as Status,
            detail:
              orbita === undefined
                ? 'Verificando…'
                : orbita
                  ? `${orbitaRecente ? 'Conectado' : 'Sem notícias'} · visto ${vistoHa(orbita.visto)}`
                  : 'Saldo, Apple Pay e aparência no Órbita',
            login: { label: orbita ? 'Reconectar' : 'Conectar', run: () => connectOrbita(props.getShortcutKey()) },
            extra: orbita ? (
              <button type="button" onClick={() => openOrbita('financas')} className="text-sm font-semibold text-violet-600 dark:text-violet-400">
                Abrir o Órbita ›
              </button>
            ) : undefined,
            test: async () => {
              const m = await testOrbita();
              loadOrbita();
              return m;
            },
          },
        ]
      : []),
    {
      id: 'bancos',
      name: 'Bancos (Open Finance)',
      icon: Landmark,
      color: 'text-amber-500',
      status: props.hasGithubToken ? 'ok' : 'off',
      detail: props.hasGithubToken ? 'Token do GitHub salvo · atualização dos bancos' : 'Falta o token do GitHub',
      login: props.hasGithubToken ? { label: 'Trocar token', run: props.onClearGithubToken } : undefined,
      test: props.hasGithubToken ? testGithubToken : undefined,
      extra: props.hasGithubToken ? undefined : (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (tokenDraft.trim()) {
              props.onSaveGithubToken(tokenDraft.trim());
              setTokenDraft('');
            }
          }}
        >
          <div className="flex gap-2">
            <input
              type="password"
              autoComplete="off"
              aria-label="Token do GitHub"
              value={tokenDraft}
              onChange={(e) => setTokenDraft(e.target.value)}
              placeholder="github_pat_…"
              className="flex-1 min-w-0 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-emerald-500"
            />
            <button type="submit" disabled={!tokenDraft.trim()} className={`${btnPrimary} flex-none px-4`}>
              <LogIn className="w-4 h-4" />
              Salvar
            </button>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Token restrito ao repositório financy, só com a permissão Actions (leitura e escrita). Fica salvo apenas neste aparelho.
          </p>
        </form>
      ),
    },
    {
      id: 'atalho',
      name: 'Atalho do iPhone',
      icon: Smartphone,
      color: 'text-indigo-500',
      status: 'ok',
      detail: 'Chave para o Atalho registrar compras no Financy',
      login: {
        label: shortcut === 'copied' ? 'Chave copiada' : 'Copiar chave',
        run: async () => {
          const key = props.getShortcutKey();
          if (!key) return;
          try {
            await navigator.clipboard.writeText(key);
            setShortcut('copied');
          } catch {
            setManualKey(key);
            setShortcut('manual');
          }
        },
      },
      test: async () => {
        const key = props.getShortcutKey();
        if (!key) throw new Error('Sem chave: entre de novo na conta.');
        const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${firebaseConfig.apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(key)}`,
        }).catch(() => null);
        if (!res) throw new Error('Sem resposta do Google. Confira a internet.');
        if (!res.ok) throw new Error('A chave não vale mais: copie de novo e cole no Atalho.');
        return 'A chave funciona: o Atalho consegue registrar compras';
      },
      extra: (
        <div className="space-y-2">
          {shortcut === 'manual' && (
            <input
              readOnly
              aria-label="Chave do Atalho"
              value={manualKey}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
            />
          )}
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {shortcut === 'copied' ? 'Cole no começo do Atalho. ' : ''}Quem tiver essa chave acessa os seus dados financeiros: cole só no seu Atalho e não compartilhe o Atalho.
          </p>
        </div>
      ),
    },
    {
      id: 'notificacoes',
      name: 'Notificações',
      icon: Bell,
      color: 'text-rose-500',
      status: perm === 'granted' ? 'ok' : perm === 'denied' ? 'warn' : 'off',
      detail:
        perm === 'unavailable'
          ? 'Só no app do iPhone (instale o .ipa novo)'
          : perm === 'granted'
            ? lembretes
              ? 'Permitidas · lembrete de faturas e dívidas'
              : 'Permitidas · lembretes desligados'
            : perm === 'denied'
              ? 'Bloqueadas nos Ajustes do iPhone'
              : 'Ainda não permitidas',
      login:
        perm === 'prompt'
          ? {
              label: 'Permitir',
              run: async () => {
                setPerm(await askNotifPermission());
                props.onRemindersChanged?.();
              },
            }
          : undefined,
      test: notifAvailable && perm !== 'denied' ? testNotification : undefined,
      extra:
        perm === 'denied' ? (
          <p className="text-xs text-slate-400 dark:text-slate-500">Para ligar: Ajustes do iPhone › Notificações › Financy.</p>
        ) : perm === 'granted' ? (
          <button
            type="button"
            role="switch"
            aria-checked={lembretes}
            onClick={() => {
              setLembretes(!lembretes);
              setLemb(!lembretes);
              props.onRemindersChanged?.();
            }}
            className="w-full flex items-center justify-between gap-3 text-left text-[15px] text-slate-900 dark:text-slate-100"
          >
            <span>
              Lembrar vencimentos
              <span className="block text-xs text-slate-400 dark:text-slate-500">Um dia antes da fatura de cada cartão e das dívidas, às 9h</span>
            </span>
            <span className={`flex-none w-10 h-6 rounded-full p-0.5 transition ${lembretes ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
              <span className={`block w-5 h-5 rounded-full bg-white transition ${lembretes ? 'translate-x-4' : ''}`} />
            </span>
          </button>
        ) : undefined,
    },
  ];

  return conns;
}

export default function ConnectionsGroup(props: ConnectionsProps) {
  const [open, setOpen] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, Result>>({});
  const conns = useConnections(props);

  const testar = async (c: Conn) => {
    if (!c.test || testing) return;
    setTesting(c.id);
    try {
      const msg = await c.test();
      setResults((r) => ({ ...r, [c.id]: { ok: true, msg } }));
    } catch (e) {
      setResults((r) => ({ ...r, [c.id]: { ok: false, msg: e instanceof Error ? e.message : 'Falhou' } }));
    } finally {
      setTesting(null);
    }
  };

  return (
    <section className="space-y-2">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
        {conns.map((c) => {
          const Icon = c.icon;
          const isOpen = open === c.id;
          const r = results[c.id];
          const busy = testing === c.id;
          return (
            <div key={c.id}>
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : c.id)}
                className="w-full flex items-center gap-3 px-4 min-h-[60px] py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
              >
                <span className={`flex-none w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center ${c.status === 'off' ? 'text-slate-400' : c.color}`}>
                  <Icon className="w-[18px] h-[18px]" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] text-slate-900 dark:text-slate-100">{c.name}</span>
                  <span className={`block text-xs truncate ${c.status === 'warn' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'}`}>
                    {c.detail}
                  </span>
                </span>
                <span className={`flex-none px-2 py-0.5 rounded-full text-[11px] font-semibold ${BADGE[c.status].cls}`}>{BADGE[c.status].label}</span>
                <ChevronRight className={`flex-none w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
              </button>
              {isOpen && (
                <div className="px-4 pb-4 space-y-3">
                  {c.extra}
                  {(c.login || c.test) && (
                    <div className="flex gap-2">
                      {c.login && (
                        <button type="button" onClick={() => void c.login!.run()} className={c.status === 'ok' ? btnSecondary : btnPrimary}>
                          <LogIn className="w-4 h-4" />
                          {c.login.label}
                        </button>
                      )}
                      {c.test && (
                        <button type="button" onClick={() => testar(c)} disabled={!!testing} className={c.status === 'ok' ? btnPrimary : btnSecondary}>
                          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlugZap className="w-4 h-4" />}
                          {busy ? 'Testando…' : 'Testar conexão'}
                        </button>
                      )}
                    </div>
                  )}
                  {r && !busy && (
                    <p role="status" className={`flex items-start gap-1.5 text-xs ${r.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {r.ok ? <CheckCircle2 className="w-4 h-4 flex-none" /> : <XCircle className="w-4 h-4 flex-none" />}
                      {r.msg}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="px-2 text-xs text-slate-400 dark:text-slate-500">Toque numa conexão para entrar ou testar. Senhas de banco nunca passam pelo Financy.</p>
    </section>
  );
}
