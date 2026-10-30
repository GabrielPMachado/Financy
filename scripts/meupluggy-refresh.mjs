#!/usr/bin/env node
/**
 * Clica em "Atualizar" no site do Meu Pluggy (meu.pluggy.ai), porque a API da
 * Pluggy recusa atualizar itens do MeuPluggy ("MeuPluggy item cant be updated").
 *
 *   node scripts/meupluggy-refresh.mjs login                 -> abre o Chrome para você entrar
 *                                                               uma vez e salva a sessão em .auth/
 *   node scripts/meupluggy-refresh.mjs refresh "Mercado Pago" "Nubank"
 *                                                            -> atualiza os bancos citados
 *
 * Sessão, em ordem de preferência:
 *   1. .auth/meupluggy.json  (a mais recente: no Actions vem do cache entre execuções)
 *   2. secret MEUPLUGGY_STORAGE_STATE (o mesmo arquivo, em base64)
 *   3. login automático quando a sessão expira (dura ~1 dia e meio) ou não existe:
 *      MEUPLUGGY_EMAIL + GMAIL_APP_PASSWORD (pede o e-mail de acesso e lê o código ou
 *      o link no Gmail) ou MEUPLUGGY_EMAIL + MEUPLUGGY_PASSWORD. Nada disso é impresso. MEUPLUGGY_FORCE_LOGIN=1 força esse caminho (teste).
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const SITE = 'https://meu.pluggy.ai';
const STATE_FILE = '.auth/meupluggy.json';
const [mode, ...banks] = process.argv.slice(2);

/**
 * Abre um navegador VISÍVEL para o login manual. Prefere um navegador já
 * instalado (logins do Google costumam bloquear navegadores "de teste").
 * Ordem: BROWSER_PATH (caminho do .exe do seu navegador) > Chrome > Edge >
 * Chromium do Playwright (instale com: npx playwright install chromium).
 */
async function launchVisibleBrowser() {
  const options = { headless: false, args: ['--disable-blink-features=AutomationControlled'] };
  const attempts = [
    ...(process.env.BROWSER_PATH ? [{ executablePath: process.env.BROWSER_PATH }] : []),
    { channel: 'chrome' },
    { channel: 'msedge' },
    {},
  ];
  for (const attempt of attempts) {
    try {
      return await chromium.launch({ ...options, ...attempt });
    } catch {
      // tenta o próximo
    }
  }
  throw new Error(
    'Nenhum navegador encontrado. Rode "npx playwright install chromium" ou defina BROWSER_PATH com o caminho do .exe do seu navegador.'
  );
}

async function login() {
  const browser = await launchVisibleBrowser();
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(SITE, { waitUntil: 'commit', timeout: 120_000 });
  console.log('Faça login na janela que abriu. Aguardando (até 5 min)…');
  await page.waitForURL(/meu\.pluggy\.ai\/(overview|connections|flow|assets)/, { timeout: 300_000 });
  await page.waitForTimeout(3000);
  mkdirSync('.auth', { recursive: true });
  await context.storageState({ path: STATE_FILE });
  await browser.close();
  console.log(`Sessão salva em ${STATE_FILE}. Esse arquivo é um segredo: não commite nem compartilhe.`);
}

/** Erro com um código curto; o workflow o repassa ao app (uma mensagem diferente por causa). */
class RefreshError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

class SessionExpiredError extends RefreshError {
  constructor() {
    super('sessao-expirada', 'Sessão do Meu Pluggy expirada.');
  }
}

function codeOf(err) {
  if (err instanceof RefreshError) return err.code;
  return err?.name === 'TimeoutError' ? 'meupluggy-fora' : 'atualizar-outro';
}

/** Grava o motivo da falha como saída da etapa do GitHub Actions (`reason`). */
function reportReason(code) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `reason=${code}\n`);
}

/** Sessão salva (arquivo mais recente > secret), ou undefined se não houver. */
function loadSavedState() {
  if (process.env.MEUPLUGGY_FORCE_LOGIN === '1') return undefined;
  if (existsSync(STATE_FILE)) return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  if (process.env.MEUPLUGGY_STORAGE_STATE) {
    return JSON.parse(Buffer.from(process.env.MEUPLUGGY_STORAGE_STATE, 'base64').toString('utf8'));
  }
  return undefined;
}

/**
 * Entra no Meu Pluggy sozinho. Com MEUPLUGGY_PASSWORD, digita a senha; com
 * GMAIL_APP_PASSWORD, pede o e-mail de acesso e usa o código ou o link que chega
 * no Gmail (senha de app do Google, só para ler a caixa por IMAP).
 */
async function loginWithCredentials(page, missingCredentialsCode) {
  const email = process.env.MEUPLUGGY_EMAIL;
  const password = process.env.MEUPLUGGY_PASSWORD;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;
  if (!email || (!password && !gmailAppPassword)) {
    throw new RefreshError(missingCredentialsCode, 'Sem sessão válida e sem MEUPLUGGY_EMAIL + GMAIL_APP_PASSWORD (ou MEUPLUGGY_PASSWORD) para entrar sozinho.');
  }

  await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const enter = page.getByRole('link', { name: /entrar|login|sign in/i }).or(page.getByRole('button', { name: /entrar|login|sign in/i }));
  if (await enter.first().isVisible({ timeout: 8_000 }).catch(() => false)) await enter.first().click();

  // Botão principal do formulário (ignora "Continuar com Google" e similares).
  const submit = page
    .locator('button[type="submit"]')
    .filter({ hasNotText: /google|apple|microsoft|facebook|github/i })
    .first();

  const emailField = page.locator('input[name="username"], input[name="email"], input[type="email"]').first();
  await emailField.waitFor({ timeout: 45_000 });
  await emailField.fill(email);

  if (password) {
    const passwordField = page.locator('input[type="password"]').first();
    if (!(await passwordField.isVisible().catch(() => false))) {
      await submit.click(); // formulário em duas etapas (e-mail, depois senha)
      await passwordField.waitFor({ timeout: 45_000 });
    }
    await passwordField.fill(password);
    await submit.click();
  } else {
    await loginWithEmailCode(page, submit, email, gmailAppPassword);
  }

  try {
    await page.waitForURL(/meu\.pluggy\.ai\/(overview|connections|flow|assets)/, { timeout: 60_000 });
  } catch {
    throw new RefreshError('login-falhou', 'O login automático não chegou ao painel (código/link não aceito, verificação extra ou captcha?).');
  }
  console.log('Login automático no Meu Pluggy concluído.');
}

/** Pede o e-mail de acesso e entra com o código (digitado) ou o link (aberto). */
async function loginWithEmailCode(page, submit, email, gmailAppPassword) {
  const requestedAt = Date.now() - 60_000; // folga para o relógio do servidor de e-mail
  await submit.click();
  console.log('E-mail de acesso pedido ao Meu Pluggy; aguardando no Gmail…');
  const { code, link } = await waitForAccessEmail(email, gmailAppPassword, requestedAt);

  const codeInputs = page.locator(
    'input[autocomplete="one-time-code"], input[inputmode="numeric"], input[name*="code" i], input[name*="otp" i], input[name*="token" i]'
  );
  const hasCodeField = await codeInputs.first().isVisible({ timeout: 5_000 }).catch(() => false);
  if (code && hasCodeField) {
    console.log('Código recebido; digitando.');
    if ((await codeInputs.count()) > 1) {
      // Uma caixa por dígito: o site passa para a próxima sozinho.
      await codeInputs.first().click();
      await page.keyboard.type(code, { delay: 80 });
    } else {
      await codeInputs.first().fill(code);
    }
    if (await submit.isVisible().catch(() => false)) await submit.click().catch(() => {});
  } else if (link) {
    console.log('Link de acesso recebido; abrindo.');
    await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  } else {
    throw new RefreshError('login-falhou', 'O e-mail do Meu Pluggy chegou, mas sem código nem link reconhecível.');
  }
}

/** Lê o Gmail (IMAP) até chegar um e-mail do Pluggy depois de `since`; devolve código e/ou link. */
async function waitForAccessEmail(user, pass, since) {
  const { ImapFlow } = await import('imapflow');
  const { simpleParser } = await import('mailparser');
  const client = new ImapFlow({ host: 'imap.gmail.com', port: 993, secure: true, auth: { user, pass }, logger: false });
  try {
    await client.connect();
  } catch {
    throw new RefreshError('login-falhou', 'O Gmail recusou a senha de app (confira GMAIL_APP_PASSWORD).');
  }
  try {
    for (let attempt = 0; attempt < 24; attempt++) { // até ~2 min
      const lock = await client.getMailboxLock('INBOX');
      try {
        const uids = await client.search({ since: new Date(since - 86_400_000), from: 'pluggy' }, { uid: true });
        for (const uid of [...(uids || [])].reverse()) {
          const msg = await client.fetchOne(String(uid), { internalDate: true, source: true }, { uid: true });
          if (!msg || new Date(msg.internalDate).getTime() < since) continue;
          const found = extractAccess(await simpleParser(msg.source));
          if (found.code || found.link) return found;
        }
      } finally {
        lock.release();
      }
      await new Promise((r) => setTimeout(r, 5_000));
    }
  } finally {
    await client.logout().catch(() => {});
  }
  throw new RefreshError('login-falhou', 'O e-mail de acesso do Meu Pluggy não chegou ao Gmail em 2 minutos.');
}

function extractAccess(mail) {
  const text = `${mail.subject || ''}\n${mail.text || ''}`;
  // Número solto (não parte de data, hora ou valor): prefere 6 dígitos.
  const loose = (n) => new RegExp(`(?<![\\d/.,:-]|[\\d][/.,:-])\\d{${n}}(?!\\d|[/.,:-]\\d)`);
  const code = (text.match(loose('6')) || text.match(loose('4,8')))?.[0];
  const hrefs = [...String(mail.html || '').matchAll(/href="([^"]+)"/g)].map((m) => m[1].replaceAll('&amp;', '&'));
  const link = hrefs.find((h) => /^https:\/\/[^/]*pluggy\.ai\//.test(h) && /token|code|magic|verify|login|auth|callback/i.test(h) && !/unsubscribe|descadastr/i.test(h));
  return { code, link };
}

async function refreshBank(page, bank) {
  await page.goto(`${SITE}/connections`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
  const here = new URL(page.url());
  if (/login|signin|sign-in|auth/i.test(here.pathname) || /auth0/i.test(here.hostname)) {
    throw new SessionExpiredError();
  }

  const card = page.getByText(bank, { exact: true }).first();
  try {
    await card.waitFor({ timeout: 30_000 });
  } catch {
    // Sem o card: ou a sessão caiu (tela de login) ou a conexão realmente não existe.
    if (await page.locator('input[type="password"], input[type="email"], input[name="username"]').first().isVisible().catch(() => false)) {
      throw new SessionExpiredError();
    }
    if (await page.getByText(/não conseguimos carregar/i).first().isVisible().catch(() => false)) {
      throw new RefreshError('meupluggy-fora', 'O Meu Pluggy não conseguiu carregar as conexões (instabilidade do serviço).');
    }
    throw new RefreshError('banco-nao-encontrado', `Conexão "${bank}" não encontrada na tela de Conexões.`);
  }
  await card.click();
  await page.waitForURL(/\/connections\/[0-9a-f-]{36}/, { timeout: 20_000 });

  const button = page.getByRole('button', { name: /atualizar/i });
  await button.waitFor({ timeout: 20_000 });
  await button.click();

  // Espera começar (botão desabilita) e terminar (volta a habilitar).
  await page.waitForTimeout(1500);
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (await button.isEnabled().catch(() => true)) break;
    await page.waitForTimeout(2000);
  }
  console.log(`${bank}: atualização pedida e concluída.`);
}

async function refresh() {
  if (banks.length === 0) throw new Error('Informe ao menos um banco, ex: "Mercado Pago".');
  // channel 'chromium' = Chromium completo no novo modo headless. Evita o
  // "chrome-headless-shell", executável à parte que antivírus costumam bloquear.
  const browser = await chromium.launch({ headless: true, channel: 'chromium' }).catch(() => chromium.launch({ headless: true }));
  const savedState = loadSavedState();
  const context = await browser.newContext({ ...(savedState ? { storageState: savedState } : {}), locale: 'pt-BR' });
  const page = await context.newPage();

  let loggedInThisRun = false;
  const autoLogin = async (missingCredentialsCode) => {
    await loginWithCredentials(page, missingCredentialsCode);
    loggedInThisRun = true;
  };

  const failures = [];
  const reasons = [];
  try {
    if (!savedState) await autoLogin('sem-sessao');
    for (const bank of banks) {
      try {
        try {
          await refreshBank(page, bank);
        } catch (err) {
          if (!(err instanceof SessionExpiredError) || loggedInThisRun) throw err;
          console.log('Sessão expirada: entrando sozinho…');
          await autoLogin('sessao-expirada');
          await refreshBank(page, bank);
        }
      } catch (err) {
        failures.push(err.message);
        reasons.push(codeOf(err));
        console.error(`${bank}: ${err.message}`);
      }
    }
  } catch (err) {
    failures.push(err.message);
    reasons.push(codeOf(err));
    console.error(err.message);
  }

  // Guarda a sessão (renovada ou não) para as próximas execuções (cache do Actions).
  if (failures.length === 0) {
    mkdirSync('.auth', { recursive: true });
    await context.storageState({ path: STATE_FILE });
  }
  await browser.close();
  if (failures.length > 0) {
    reportReason(reasons[0]);
    process.exit(1);
  }
}

(mode === 'login' ? login() : mode === 'refresh' ? refresh() : Promise.reject(new Error('Use: login | refresh <banco…>')))
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
