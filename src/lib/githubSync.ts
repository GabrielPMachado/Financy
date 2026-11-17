import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MISSING_TOKEN_MESSAGE,
  NETWORK_MESSAGE,
  POLL_TIMEOUT_MESSAGE,
  describeHttpError,
  describeRunConclusion,
  describeWorkflowFailure,
  type GithubAction,
  type SyncFailure,
  type WorkflowStep,
} from './syncErrors';

/**
 * "Sincronizar agora": dispara o workflow de sincronização bancária no GitHub
 * Actions (.github/workflows/sync-pluggy.yml) e acompanha o andamento.
 *
 * O token do GitHub NÃO fica no código nem no build: o usuário cola um token
 * "fine-grained" (restrito a este repositório, só permissão Actions: read/write)
 * nos Ajustes, e ele fica apenas no armazenamento local do aparelho.
 */
const OWNER = 'GabrielPMachado';
const REPO = 'financy';
const WORKFLOW_FILE = 'sync-pluggy.yml';
const BRANCH = 'main';
const TOKEN_KEY = 'financas_github_token';
const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 6 * 60 * 1000;

export type BankSyncStatus = 'idle' | 'starting' | 'running' | 'done' | 'error';

export interface BankSyncState {
  status: BankSyncStatus;
  message: string;
  /** Causa do erro (ex: 'sessao-expirada', 'token-invalido'); só quando status = 'error'. */
  code?: string;
}

export type SyncBank = 'todos' | 'Mercado Pago' | 'Nubank';

export interface SyncOptions {
  /** true: pede ao Meu Pluggy para atualizar o banco antes (1 a 3 min). false: só busca (cerca de 30 s). */
  refresh: boolean;
  /** Banco a atualizar quando `refresh` é true. */
  bank: SyncBank;
}

/** Botão do cabeçalho: atualiza os dois bancos. */
export const DEFAULT_SYNC_OPTIONS: SyncOptions = { refresh: true, bank: 'todos' };

/**
 * Token embutido no build (VITE_GITHUB_SYNC_TOKEN no .env.local, que o git ignora),
 * usado quando não há um token colado nos Ajustes. Fica dentro do bundle do app: use um
 * token fine-grained restrito a este repositório, só com Actions (leitura/escrita).
 */
const BUILD_TOKEN: string = (import.meta.env.VITE_GITHUB_SYNC_TOKEN as string | undefined) || '';

export function getGithubToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) || BUILD_TOKEN;
  } catch {
    return BUILD_TOKEN;
  }
}

export function setGithubToken(token: string): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token.trim());
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // armazenamento indisponível: ignora
  }
}

/** Erro com causa identificada: a mensagem já é a que o usuário vê. */
class SyncFailureError extends Error {
  readonly code: string;

  constructor(failure: SyncFailure) {
    super(failure.message);
    this.code = failure.code;
  }
}

function githubHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

const REPO_API = `https://api.github.com/repos/${OWNER}/${REPO}/actions`;
const WORKFLOW_URL = `${REPO_API}/workflows/${WORKFLOW_FILE}`;

/** fetch ao GitHub que já traduz falhas de rede e respostas de erro em SyncFailureError. */
async function githubFetch(url: string, token: string, action: GithubAction, init: RequestInit = {}): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: { ...githubHeaders(token), ...init.headers } });
  } catch {
    throw new SyncFailureError({ code: 'rede', message: NETWORK_MESSAGE });
  }
  if (!res.ok) {
    throw new SyncFailureError(describeHttpError(res.status, action, res.headers.get('x-ratelimit-remaining') === '0'));
  }
  return res;
}

interface LatestRun {
  id: number;
  status: string;
  conclusion: string | null;
}

async function fetchLatestRun(token: string): Promise<LatestRun | null> {
  const res = await githubFetch(`${WORKFLOW_URL}/runs?event=workflow_dispatch&per_page=1`, token, 'ler');
  const data = await res.json();
  return data.workflow_runs?.[0] ?? null;
}

/** Por que a execução falhou: lê as etapas do job e traduz a que acusou o motivo. */
async function explainFailedRun(token: string, run: LatestRun): Promise<SyncFailure> {
  if (run.conclusion !== 'failure') return describeRunConclusion(run.conclusion);
  try {
    const res = await githubFetch(`${REPO_API}/runs/${run.id}/jobs`, token, 'ler');
    const data = await res.json();
    const steps: WorkflowStep[] = (data.jobs ?? []).flatMap((job: { steps?: WorkflowStep[] }) => job.steps ?? []);
    return describeWorkflowFailure(steps);
  } catch {
    return { code: 'falhou', message: 'A sincronização terminou com erro. Veja a execução no GitHub Actions.' };
  }
}

function describeError(err: unknown, fallback: string): { message: string; code: string } {
  if (err instanceof SyncFailureError) return { message: err.message, code: err.code };
  return { message: fallback, code: 'desconhecida' };
}

function runningMessage(options: SyncOptions): string {
  if (!options.refresh) return 'Buscando os lançamentos…';
  return options.bank === 'todos' ? 'Atualizando os bancos…' : `Atualizando ${options.bank}…`;
}

const IDLE: BankSyncState = { status: 'idle', message: '' };

export function useBankSync(): {
  state: BankSyncState;
  hasToken: boolean;
  start: (options?: SyncOptions) => Promise<void>;
  refreshTokenFlag: () => void;
} {
  const [state, setState] = useState<BankSyncState>(IDLE);
  const [hasToken, setHasToken] = useState<boolean>(() => !!getGithubToken());
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (pollTimer.current) clearTimeout(pollTimer.current);
  }, []);

  const refreshTokenFlag = useCallback(() => setHasToken(!!getGithubToken()), []);

  const poll = useCallback((token: string, previousRunId: number | null, startedAt: number, options: SyncOptions) => {
    pollTimer.current = setTimeout(async () => {
      try {
        const run = await fetchLatestRun(token);
        const isNewRun = run && run.id !== previousRunId;
        if (isNewRun && run.status === 'completed') {
          if (run.conclusion === 'success') {
            setState({ status: 'done', message: 'Sincronizado. Os lançamentos novos já aparecem no app.' });
          } else {
            const failure = await explainFailedRun(token, run);
            setState({ status: 'error', message: failure.message, code: failure.code });
          }
          return;
        }
        if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
          setState({ status: 'error', message: POLL_TIMEOUT_MESSAGE, code: 'tempo-esgotado-app' });
          return;
        }
        setState({ status: 'running', message: runningMessage(options) });
        poll(token, previousRunId, startedAt, options);
      } catch (err) {
        const { message, code } = describeError(err, 'Falha ao acompanhar a sincronização.');
        const lostConnection = code === 'rede';
        setState({
          status: 'error',
          message: lostConnection ? 'Perdi a conexão ao acompanhar a sincronização. Ela pode ter terminado: confira o app em instantes.' : message,
          code,
        });
      }
    }, POLL_INTERVAL_MS);
  }, []);

  const start = useCallback(async (options: SyncOptions = DEFAULT_SYNC_OPTIONS) => {
    const token = getGithubToken();
    if (!token) {
      setState({ status: 'error', message: MISSING_TOKEN_MESSAGE, code: 'sem-token' });
      return;
    }
    if (pollTimer.current) clearTimeout(pollTimer.current);
    setState({ status: 'starting', message: 'Iniciando…' });
    try {
      const previous = await fetchLatestRun(token);
      await githubFetch(`${WORKFLOW_URL}/dispatches`, token, 'iniciar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: BRANCH, inputs: { refresh: String(options.refresh), banks: options.bank } }),
      });
      setState({ status: 'running', message: runningMessage(options) });
      poll(token, previous?.id ?? null, Date.now(), options);
    } catch (err) {
      const { message, code } = describeError(err, 'Não foi possível iniciar a sincronização.');
      setState({ status: 'error', message, code });
    }
  }, [poll]);

  return { state, hasToken, start, refreshTokenFlag };
}
