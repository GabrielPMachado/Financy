import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * "Sincronizar agora": dispara o workflow de sincronização bancária no GitHub
 * Actions (.github/workflows/sync-pluggy.yml) e acompanha o andamento.
 *
 * O token do GitHub NÃO fica no código nem no APK: o usuário cola um token
 * "fine-grained" (restrito a este repositório, só permissão Actions: read/write)
 * nos Ajustes, e ele fica apenas no armazenamento local do aparelho.
 */
const OWNER = 'GabrielPMachado';
const REPO = 'financy';
const WORKFLOW_FILE = 'sync-pluggy.yml';
const BRANCH = 'main';
const TOKEN_KEY = 'financas_github_token';
const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 6 * 60 * 1000;

export type BankSyncStatus = 'idle' | 'starting' | 'running' | 'done' | 'error';

export interface BankSyncState {
  status: BankSyncStatus;
  message: string;
}

/**
 * Token embutido no build (VITE_GITHUB_SYNC_TOKEN no .env.local, que o git ignora),
 * usado quando não há um token colado nos Ajustes. Fica dentro do APK: use um
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

function githubHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

const WORKFLOW_URL = `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW_FILE}`;

function describeHttpError(status: number): string {
  if (status === 401) return 'Token do GitHub inválido ou expirado.';
  if (status === 403 || status === 404) {
    return 'O token não tem acesso a este repositório (precisa da permissão Actions: leitura e escrita).';
  }
  return `O GitHub respondeu com erro ${status}.`;
}

interface LatestRun {
  id: number;
  status: string;
  conclusion: string | null;
}

async function fetchLatestRun(token: string): Promise<LatestRun | null> {
  const res = await fetch(`${WORKFLOW_URL}/runs?event=workflow_dispatch&per_page=1`, { headers: githubHeaders(token) });
  if (!res.ok) throw new Error(describeHttpError(res.status));
  const data = await res.json();
  return data.workflow_runs?.[0] ?? null;
}

const IDLE: BankSyncState = { status: 'idle', message: '' };

export function useBankSync(): { state: BankSyncState; hasToken: boolean; start: () => Promise<void>; refreshTokenFlag: () => void } {
  const [state, setState] = useState<BankSyncState>(IDLE);
  const [hasToken, setHasToken] = useState<boolean>(() => !!getGithubToken());
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (pollTimer.current) clearTimeout(pollTimer.current);
  }, []);

  const refreshTokenFlag = useCallback(() => setHasToken(!!getGithubToken()), []);

  const poll = useCallback((token: string, previousRunId: number | null, startedAt: number) => {
    pollTimer.current = setTimeout(async () => {
      try {
        const run = await fetchLatestRun(token);
        const isNewRun = run && run.id !== previousRunId;
        if (isNewRun && run.status === 'completed') {
          setState(
            run.conclusion === 'success'
              ? { status: 'done', message: 'Sincronizado. Os lançamentos novos já aparecem no app.' }
              : { status: 'error', message: 'A sincronização terminou com erro. Veja a execução no GitHub Actions.' }
          );
          return;
        }
        if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
          setState({ status: 'error', message: 'Demorou mais que o esperado. Confira o andamento no GitHub Actions.' });
          return;
        }
        setState({ status: 'running', message: 'Atualizando os bancos…' });
        poll(token, previousRunId, startedAt);
      } catch (err) {
        setState({ status: 'error', message: err instanceof Error ? err.message : 'Falha ao acompanhar a sincronização.' });
      }
    }, POLL_INTERVAL_MS);
  }, []);

  const start = useCallback(async () => {
    const token = getGithubToken();
    if (!token) {
      setState({ status: 'error', message: 'Cole o token do GitHub nos Ajustes para usar este botão.' });
      return;
    }
    if (pollTimer.current) clearTimeout(pollTimer.current);
    setState({ status: 'starting', message: 'Iniciando…' });
    try {
      const previous = await fetchLatestRun(token);
      const res = await fetch(`${WORKFLOW_URL}/dispatches`, {
        method: 'POST',
        headers: { ...githubHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: BRANCH }),
      });
      if (!res.ok) throw new Error(describeHttpError(res.status));
      setState({ status: 'running', message: 'Atualizando os bancos…' });
      poll(token, previous?.id ?? null, Date.now());
    } catch (err) {
      setState({ status: 'error', message: err instanceof Error ? err.message : 'Não foi possível iniciar a sincronização.' });
    }
  }, [poll]);

  return { state, hasToken, start, refreshTokenFlag };
}
