#!/usr/bin/env node
/**
 * Clica em "Atualizar" no site do Meu Pluggy (meu.pluggy.ai), porque a API da
 * Pluggy recusa atualizar itens do MeuPluggy ("MeuPluggy item cant be updated").
 *
 *   node scripts/meupluggy-refresh.mjs refresh "Mercado Pago" "Nubank"
 *                                                            -> atualiza os bancos citados
 *
 * Sessão: .auth/meupluggy.json (no Actions vem do cache entre execuções). Quando ela
 * expira (dura ~1 dia e meio) ou não existe, entra sozinho: MEUPLUGGY_EMAIL +
 * GMAIL_APP_PASSWORD (pede o e-mail de acesso e abre o link ou digita o código que
 * chega no Gmail) ou MEUPLUGGY_EMAIL + MEUPLUGGY_PASSWORD. Nada disso é impresso.
 * MEUPLUGGY_FORCE_LOGIN=1 força o login (teste).
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const SITE = 'https://meu.pluggy.ai';
const STATE_FILE = '.auth/meupluggy.json';
const [mode, ...banks] = process.argv.slice(2);

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

/** Sessão salva pela execução anterior (cache do Actions), ou undefined se não houver. */
function loadSavedState() {
  if (process.env.MEUPLUGGY_FORCE_LOGIN === '1') return undefined;
  if (existsSync(STATE_FILE)) return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
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
  let access;
  try {
    access = await waitForAccessEmail(email, gmailAppPassword, requestedAt);
  } catch (err) {
    // Mostra no log como ficou a tela depois do pedido (sem valores digitados), para saber se o
    // Meu Pluggy mudou o login (captcha, senha, outro botão) ou se só não mandou o e-mail.
    await describePage(page);
    throw err;
  }
  const { code, link } = access;

  if (link) {
    console.log('Link de acesso recebido; abrindo.');
    await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    return;
  }
  const codeInputs = await findCodeInputs(page);
  if (code && codeInputs) {
    console.log('Código recebido; digitando.');
    const boxes = await codeInputs.count();
    if (boxes === code.length) {
      // Uma caixa por dígito.
      for (let i = 0; i < boxes; i++) await codeInputs.nth(i).fill(code[i]);
    } else if (boxes > 1) {
      // Caixas que se preenchem em sequência: o site passa para a próxima sozinho.
      await codeInputs.first().click();
      await page.keyboard.type(code, { delay: 80 });
    } else {
      await codeInputs.first().fill(code);
    }
    const confirm = page.getByRole('button', { name: /continuar|confirmar|verificar|entrar|acessar|enviar|validar/i });
    if (await confirm.first().isVisible().catch(() => false)) await confirm.first().click().catch(() => {});
  } else {
    await describePage(page);
    throw new RefreshError('login-falhou', `Recebi ${code ? 'o código' : 'o e-mail'}, mas não achei onde digitá-lo na página do Meu Pluggy.`);
  }
}

/**
 * Campo(s) do código: primeiro pelos atributos usuais; senão, qualquer caixa de
 * texto visível que não seja a do e-mail (o formulário troca o e-mail pelo código).
 */
async function findCodeInputs(page) {
  const specific = page.locator(
    'input[autocomplete="one-time-code"], input[inputmode="numeric"], input[name*="code" i], input[name*="otp" i], input[name*="token" i], input[name*="codigo" i], input[placeholder*="código" i], input[placeholder*="code" i]'
  );
  if (await specific.first().isVisible({ timeout: 10_000 }).catch(() => false)) return specific.filter({ visible: true });
  const generic = page
    .locator('input:not([type="hidden"]):not([type="email"]):not([type="checkbox"]):not([type="radio"]):not([type="submit"]):not([name="email"]):not([name="username"])')
    .filter({ visible: true });
  return (await generic.count()) > 0 ? generic : undefined;
}

/** Mostra no log a estrutura da página (sem valores digitados), para ajustar os seletores. */
async function describePage(page) {
  const info = await page.evaluate(() => ({
    url: location.origin + location.pathname,
    titles: [...document.querySelectorAll('h1,h2,h3,label,p')].map((e) => e.innerText.trim()).filter(Boolean).slice(0, 12),
    inputs: [...document.querySelectorAll('input')].map((e) => ({ type: e.type, name: e.name, id: e.id, autocomplete: e.autocomplete, inputmode: e.inputMode, placeholder: e.placeholder, maxlength: e.maxLength, visible: !!e.offsetParent })),
    buttons: [...document.querySelectorAll('button')].map((e) => e.innerText.trim()).filter(Boolean),
  })).catch(() => undefined);
  console.log('Página do login (diagnóstico):', JSON.stringify(info));
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
    // Procura na caixa de entrada e também em "Todos os e-mails" e no spam: o Gmail às vezes
    // arquiva ou marca como spam o e-mail do Pluggy, e o IMAP de INBOX não o vê.
    const boxes = ['INBOX'];
    for (const box of await client.list().catch(() => [])) {
      if (box.specialUse === '\\All' || box.specialUse === '\\Junk') boxes.push(box.path);
    }
    for (let attempt = 0; attempt < 60; attempt++) { // até ~5 min (o e-mail às vezes demora mais de 2)
      for (const box of boxes) {
        const lock = await client.getMailboxLock(box).catch(() => undefined);
        if (!lock) continue;
        try {
          const uids = await client.search({ since: new Date(since - 86_400_000), from: 'pluggy' }, { uid: true });
          for (const uid of [...(uids || [])].reverse()) {
            const msg = await client.fetchOne(String(uid), { internalDate: true, source: true }, { uid: true });
            if (!msg || new Date(msg.internalDate).getTime() < since) continue;
            const found = extractAccess(await simpleParser(msg.source));
            if (found.code || found.link) {
              if (box !== 'INBOX') console.log(`E-mail de acesso achado fora da caixa de entrada (${box}).`);
              return found;
            }
          }
        } finally {
          lock.release();
        }
      }
      await new Promise((r) => setTimeout(r, 5_000));
    }
  } finally {
    await client.logout().catch(() => {});
  }
  throw new RefreshError('login-falhou', 'O e-mail de acesso do Meu Pluggy não chegou ao Gmail em 5 minutos (procurei na caixa de entrada, em Todos os e-mails e no spam).');
}

function extractAccess(mail) {
  // O Meu Pluggy manda um link mágico do Auth0 (my-pluggy.us.auth0.com/passwordless/verify_redirect…).
  const urls = [
    ...[...String(mail.html || '').matchAll(/href="([^"]+)"/g)].map((m) => m[1].replaceAll('&amp;', '&')),
    ...(String(mail.text || '').match(/https:\/\/\S+/g) || []),
  ];
  const link = urls.find((u) => /^https:\/\/[^/]*pluggy[^/]*\//.test(u) && /passwordless|verify|token|magic|login|callback/i.test(u) && !/unsubscribe|descadastr/i.test(u));
  // Número solto (não parte de link, data, hora ou valor): prefere 6 dígitos.
  const text = `${mail.subject || ''}\n${mail.text || ''}`.replace(/https?:\/\/\S+/g, ' ');
  const loose = (n) => new RegExp(`(?<![\\d/.,:-]|[\\d][/.,:-])\\d{${n}}(?!\\d|[/.,:-]\\d)`);
  const code = (text.match(loose('6')) || text.match(loose('4,8')))?.[0];
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
  let loginError;
  const autoLogin = async (missingCredentialsCode) => {
    // Um login que falhou não é repetido para o próximo banco: cada tentativa pede outro
    // e-mail de acesso (o novo invalida o anterior) e esperaria mais 5 minutos.
    if (loginError) throw loginError;
    try {
      await loginWithCredentials(page, missingCredentialsCode);
    } catch (err) {
      loginError = err;
      throw err;
    }
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

  // Guarda a sessão para as próximas execuções (cache do Actions): sempre que deu certo ou
  // que o login foi refeito agora, mesmo se outro banco falhou depois.
  if (failures.length === 0 || loggedInThisRun) {
    mkdirSync('.auth', { recursive: true });
    await context.storageState({ path: STATE_FILE });
  }
  await browser.close();
  if (failures.length > 0) {
    reportReason(reasons[0]);
    process.exit(1);
  }
}

(mode === 'refresh' ? refresh() : Promise.reject(new Error('Use: refresh <banco…>')))
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
