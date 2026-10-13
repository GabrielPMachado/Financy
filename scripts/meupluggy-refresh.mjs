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
 *   3. login automático com MEUPLUGGY_EMAIL e MEUPLUGGY_PASSWORD, quando a sessão
 *      expira (dura ~1 dia e meio) ou não existe. A senha só é digitada no site do
 *      Meu Pluggy e nunca é impressa. MEUPLUGGY_FORCE_LOGIN=1 força esse caminho (teste).
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
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

class SessionExpiredError extends Error {}

/** Sessão salva (arquivo mais recente > secret), ou undefined se não houver. */
function loadSavedState() {
  if (process.env.MEUPLUGGY_FORCE_LOGIN === '1') return undefined;
  if (existsSync(STATE_FILE)) return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  if (process.env.MEUPLUGGY_STORAGE_STATE) {
    return JSON.parse(Buffer.from(process.env.MEUPLUGGY_STORAGE_STATE, 'base64').toString('utf8'));
  }
  return undefined;
}

/** Entra no Meu Pluggy com e-mail e senha (login por formulário, sem Google). */
async function loginWithCredentials(page) {
  const email = process.env.MEUPLUGGY_EMAIL;
  const password = process.env.MEUPLUGGY_PASSWORD;
  if (!email || !password) {
    throw new Error('Sem sessão válida e sem MEUPLUGGY_EMAIL/MEUPLUGGY_PASSWORD para entrar sozinho.');
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

  const passwordField = page.locator('input[type="password"]').first();
  if (!(await passwordField.isVisible().catch(() => false))) {
    await submit.click(); // formulário em duas etapas (e-mail, depois senha)
    await passwordField.waitFor({ timeout: 45_000 });
  }
  await passwordField.fill(password);
  await submit.click();

  try {
    await page.waitForURL(/meu\.pluggy\.ai\/(overview|connections|flow|assets)/, { timeout: 60_000 });
  } catch {
    throw new Error('O login automático não chegou ao painel (senha incorreta, verificação extra ou captcha?).');
  }
  console.log('Login automático no Meu Pluggy concluído.');
}

async function refreshBank(page, bank) {
  await page.goto(`${SITE}/connections`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
  const here = new URL(page.url());
  if (/login|signin|sign-in|auth/i.test(here.pathname) || /auth0/i.test(here.hostname)) {
    throw new SessionExpiredError('Sessão do Meu Pluggy expirada.');
  }

  const card = page.getByText(bank, { exact: true }).first();
  try {
    await card.waitFor({ timeout: 30_000 });
  } catch {
    // Sem o card: ou a sessão caiu (tela de login) ou a conexão realmente não existe.
    if (await page.locator('input[type="password"], input[type="email"], input[name="username"]').first().isVisible().catch(() => false)) {
      throw new SessionExpiredError('Sessão do Meu Pluggy expirada.');
    }
    throw new Error(`Conexão "${bank}" não encontrada na tela de Conexões.`);
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
  const autoLogin = async () => {
    await loginWithCredentials(page);
    loggedInThisRun = true;
  };

  const failures = [];
  try {
    if (!savedState) await autoLogin();
    for (const bank of banks) {
      try {
        try {
          await refreshBank(page, bank);
        } catch (err) {
          if (!(err instanceof SessionExpiredError) || loggedInThisRun) throw err;
          console.log('Sessão expirada: entrando com e-mail e senha…');
          await autoLogin();
          await refreshBank(page, bank);
        }
      } catch (err) {
        failures.push(err.message);
        console.error(`${bank}: ${err.message}`);
      }
    }
  } catch (err) {
    failures.push(err.message);
    console.error(err.message);
  }

  // Guarda a sessão (renovada ou não) para as próximas execuções (cache do Actions).
  if (failures.length === 0) {
    mkdirSync('.auth', { recursive: true });
    await context.storageState({ path: STATE_FILE });
  }
  await browser.close();
  if (failures.length > 0) process.exit(1);
}

(mode === 'login' ? login() : mode === 'refresh' ? refresh() : Promise.reject(new Error('Use: login | refresh <banco…>')))
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
