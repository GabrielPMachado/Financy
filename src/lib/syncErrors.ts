/**
 * Mensagens de erro do "Sincronizar agora": uma diferente para cada causa.
 *
 * Duas fontes:
 *  1. Chamadas à API do GitHub (token, permissão, limite, rede...): por status HTTP.
 *  2. Execução do workflow que terminou com erro: o workflow tem uma etapa
 *     chamada "Falha [codigo]" para cada causa (ver .github/workflows/sync-pluggy.yml),
 *     e o código entre colchetes é traduzido aqui.
 */

const REFRESH_FAILURES: Record<string, string> = {
  'sem-sessao': 'Meu Pluggy: não há sessão salva. No PC, rode "npm run meupluggy:setup".',
  'sessao-expirada': 'Meu Pluggy: a sessão expirou. No PC, rode "npm run meupluggy:renew" (ou o setup).',
  'login-falhou': 'Meu Pluggy: o login automático falhou (senha incorreta, verificação extra ou captcha).',
  'banco-nao-encontrado': 'Meu Pluggy: o banco não aparece em Conexões. Reconecte-o em meu.pluggy.ai.',
  'meupluggy-fora': 'O Meu Pluggy está fora do ar ou lento. Tente de novo em alguns minutos.',
  'atualizar-outro': 'A atualização no Meu Pluggy falhou por outro motivo. Veja o log no GitHub Actions.',
};

const SYNC_FAILURES: Record<string, string> = {
  'sync-config': 'Faltam secrets no repositório do GitHub (Pluggy ou Firebase). Confira em Settings > Secrets.',
  'pluggy-auth': 'A Pluggy recusou o Client ID/Secret. Confira os secrets PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET.',
  'pluggy-api': 'A API da Pluggy falhou ou não respondeu. Tente de novo em instantes.',
  firebase: 'Os dados vieram da Pluggy, mas não foi possível gravar no Firestore. Confira a conta de serviço.',
  'sync-outro': 'A sincronização falhou por outro motivo. Veja o log no GitHub Actions.',
};

const UNKNOWN_FAILURE = 'Uma etapa da sincronização falhou sem informar o motivo. Veja o log no GitHub Actions.';
const REFRESH_ONLY_SUFFIX = ' Os dados que o Meu Pluggy já tinha foram sincronizados.';
const FAILURE_STEP_CODE = /^Falha \[([a-z-]+)\]$/;

export interface WorkflowStep {
  name: string;
  conclusion: string | null;
}

export interface SyncFailure {
  code: string;
  message: string;
}

/** Código entre colchetes de uma etapa "Falha [codigo]", ou null se for outra etapa. */
function failureCodeOf(stepName: string): string | null {
  return FAILURE_STEP_CODE.exec(stepName)?.[1] ?? null;
}

/**
 * Traduz as etapas de uma execução com erro. Falha de sincronização tem
 * prioridade sobre falha de atualização (esta ainda deixa o sync rodar).
 */
export function describeWorkflowFailure(steps: readonly WorkflowStep[]): SyncFailure {
  const failed = steps.filter((s) => s.conclusion === 'failure');
  const codes = failed.map((s) => failureCodeOf(s.name)).filter((c): c is string => c !== null);

  const syncCode = codes.find((c) => c in SYNC_FAILURES);
  if (syncCode) return { code: syncCode, message: SYNC_FAILURES[syncCode] };

  const refreshCode = codes.find((c) => c in REFRESH_FAILURES);
  if (refreshCode) return { code: refreshCode, message: REFRESH_FAILURES[refreshCode] + REFRESH_ONLY_SUFFIX };

  if (codes.length > 0) return { code: 'desconhecida', message: UNKNOWN_FAILURE };

  const other = failed[0];
  if (other) {
    return { code: 'etapa', message: `Falhou na etapa "${other.name}" do GitHub Actions. Veja o log.` };
  }
  return { code: 'desconhecida', message: UNKNOWN_FAILURE };
}

/** Execução que não terminou com sucesso nem com falha de etapa (cancelada, tempo esgotado...). */
export function describeRunConclusion(conclusion: string | null): SyncFailure {
  switch (conclusion) {
    case 'cancelled':
      return { code: 'cancelada', message: 'A execução foi cancelada no GitHub.' };
    case 'timed_out':
      return { code: 'tempo-esgotado', message: 'A execução passou do tempo limite no GitHub.' };
    case 'action_required':
    case 'startup_failure':
      return { code: 'nao-iniciou', message: 'O GitHub não conseguiu iniciar a execução. Confira o repositório em Actions.' };
    default:
      return { code: 'desconhecida', message: UNKNOWN_FAILURE };
  }
}

export const POLL_TIMEOUT_MESSAGE =
  'Demorou mais que o esperado (6 min). O GitHub pode estar com fila: confira o andamento em Actions.';

export const MISSING_TOKEN_MESSAGE = 'Cole o token do GitHub nos Ajustes para usar este botão.';

/** Falha de rede antes de obter qualquer resposta (sem internet, DNS, bloqueio). */
export const NETWORK_MESSAGE = 'Sem conexão com o GitHub. Verifique a internet do aparelho e tente de novo.';

export type GithubAction = 'ler' | 'iniciar';

/** Mensagem para uma resposta de erro da API do GitHub. */
export function describeHttpError(status: number, action: GithubAction, rateLimitExhausted = false): SyncFailure {
  if (status === 401) {
    return { code: 'token-invalido', message: 'Token do GitHub inválido ou expirado. Gere outro e cole nos Ajustes.' };
  }
  if (status === 429 || (status === 403 && rateLimitExhausted)) {
    return { code: 'limite', message: 'Limite de requisições do GitHub atingido. Tente de novo em alguns minutos.' };
  }
  if (status === 403) {
    return {
      code: 'sem-permissao',
      message: 'O token não tem a permissão Actions (leitura e escrita) neste repositório. Gere outro token.',
    };
  }
  if (status === 404) {
    return {
      code: 'nao-encontrado',
      message: 'O GitHub não achou o repositório ou o workflow. Confira se o token é do repositório financy e se o projeto foi enviado (git push).',
    };
  }
  if (status === 422) {
    return {
      code: 'workflow-desatualizado',
      message: 'O GitHub recusou o pedido: o workflow publicado está desatualizado. Rode "git push origin main" no PC.',
    };
  }
  if (status >= 500) {
    return { code: 'github-fora', message: `O GitHub está instável (erro ${status}). Tente de novo em instantes.` };
  }
  return { code: 'http', message: `Não foi possível ${action} a sincronização (o GitHub respondeu ${status}).` };
}
