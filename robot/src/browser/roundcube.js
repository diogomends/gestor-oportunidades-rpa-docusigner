import selectors from "./selectors.js";

/**
 * Aplica um delay de espera assíncrono.
 * @param {number} ms - Milissegundos a aguardar.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Acessa o cPanel Webmail Roundcube, autentica e extrai o código MFA de 6 dígitos
 * enviado pela DocuSign com o assunto "Verificar um novo dispositivo".
 *
 * @param {import("playwright").BrowserContext} context - Contexto do navegador Playwright.
 * @param {Object} mailCredentials - Credenciais { email, password }.
 * @param {Object} [options] - Opções adicionais de timeout e retry.
 * @returns {Promise<string|null>} Código de 6 dígitos ou null se não encontrado.
 */
export async function fetchMfaCodeFromRoundcube(context, mailCredentials, options = {}) {
  const email = mailCredentials?.email;
  const password = mailCredentials?.password;

  if (!email || !password) {
    console.warn("[Roundcube] Credenciais de e-mail de notificação não informadas para consulta MFA.");
    return null;
  }

  const roundcubeSel = selectors.roundcube || {};
  const loginUrl = roundcubeSel.login_url || "https://unitynordeste.com.br:2096/";
  const maxWaitMs = options.maxWaitMs || 45000;
  const pollIntervalMs = options.pollIntervalMs || 5000;

  console.log(`[Roundcube] Abrindo aba para verificar e-mail de segurança em ${loginUrl}...`);
  let page = null;

  try {
    page = await context.newPage();
    await page.goto(loginUrl, { waitUntil: "networkidle", timeout: 30000 });
    await sleep(1000);

    // 1. Autenticação no cPanel Webmail se necessário
    const isLoginScreen =
      (await page.$(roundcubeSel.user_input).catch(() => null)) !== null ||
      page.url().includes(":2096") ||
      page.url().includes("/login");

    if (isLoginScreen) {
      console.log(`[Roundcube] Efetuando login no webmail (${email})...`);
      await page.waitForSelector(roundcubeSel.user_input, { timeout: 10000 });
      await page.fill(roundcubeSel.user_input, email);
      await sleep(500);

      await page.waitForSelector(roundcubeSel.pass_input, { timeout: 10000 });
      await page.fill(roundcubeSel.pass_input, password);
      await sleep(500);

      await page.click(roundcubeSel.login_button);
      await page.waitForNavigation({ waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
      await sleep(2000);
    }

    // 2. Se cair na tela de escolha de cliente Webmail (cPanel), clicar no Roundcube
    const roundcubeBtn = await page.$(roundcubeSel.roundcube_app_btn).catch(() => null);
    if (roundcubeBtn) {
      console.log("[Roundcube] Selecionando cliente Roundcube no painel do cPanel...");
      await roundcubeBtn.click();
      await page.waitForNavigation({ waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
      await sleep(2000);
    }

    // 3. Polling da Caixa de Entrada para localizar a mensagem mais recente da DocuSign
    console.log("[Roundcube] Buscando mensagem de verificação da DocuSign na Caixa de Entrada...");
    const startedAt = Date.now();
    let mfaCode = null;

    while (Date.now() - startedAt < maxWaitMs) {
      // Clica no botão de atualizar mensagens se disponível
      const refreshBtn = await page.$(roundcubeSel.refresh_button).catch(() => null);
      if (refreshBtn) {
        await refreshBtn.click().catch(() => {});
        await sleep(1500);
      }

      // Procura linha de mensagem correspondente à DocuSign
      const rows = await page.$$(roundcubeSel.message_row).catch(() => []);
      let targetRow = null;

      for (const row of rows) {
        const rowText = (await row.innerText().catch(() => "")).toLowerCase();
        if (
          rowText.includes("docusign") ||
          rowText.includes("verificar um novo dispositivo") ||
          rowText.includes("código de verificação") ||
          rowText.includes("codigo de verificacao") ||
          rowText.includes("verify your")
        ) {
          targetRow = row;
          break;
        }
      }

      if (targetRow) {
        console.log("[Roundcube] Mensagem de verificação da DocuSign encontrada! Abrindo e-mail...");
        await targetRow.click();
        await sleep(2000);

        // Ler corpo da mensagem (direto ou via iframe)
        let bodyText = "";
        const iframeEl = await page.$("iframe#messagecontframe, iframe[name='messagecontframe']").catch(() => null);
        if (iframeEl) {
          const frame = await iframeEl.contentFrame();
          if (frame) {
            bodyText = await frame.evaluate(() => document.body?.innerText || "");
          }
        }

        if (!bodyText) {
          const bodyEl = await page.$(roundcubeSel.message_body).catch(() => null);
          if (bodyEl) {
            bodyText = await bodyEl.innerText().catch(() => "");
          }
        }

        if (!bodyText) {
          bodyText = await page.evaluate(() => document.body?.innerText || "");
        }

        // Regex para extração do código de 6 dígitos
        const regexPatterns = [
          /Seu c[oó]digo de verifica[cç][aã]o da Docusign [eé]:\s*(\d{6})/i,
          /c[oó]digo de verifica[cç][aã]o[^0-9]{1,30}(\d{6})/i,
          /verification code[^0-9]{1,30}(\d{6})/i,
          /\b(\d{6})\b/,
        ];

        for (const regex of regexPatterns) {
          const match = bodyText.match(regex);
          if (match && match[1]) {
            mfaCode = match[1];
            console.log(`[Roundcube] Código MFA extraído com sucesso: ${mfaCode}`);
            break;
          }
        }

        if (mfaCode) {
          break;
        }
      }

      console.log(`[Roundcube] E-mail ainda não recebido. Aguardando ${pollIntervalMs / 1000}s...`);
      await sleep(pollIntervalMs);
    }

    return mfaCode;
  } catch (error) {
    console.error("[Roundcube] Erro ao extrair código MFA do Webmail:", error.message);
    return null;
  } finally {
    if (page && !page.isClosed()) {
      await page.close().catch(() => {});
    }
  }
}

/**
 * Exportação padrão do fallback Roundcube.
 * @type {{fetchMfaCodeFromRoundcube: function}}
 */
export default {
  fetchMfaCodeFromRoundcube,
};
