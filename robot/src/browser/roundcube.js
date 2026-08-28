import selectors from "./selectors.js";
import logger from "../utils/logger.js";

/** @constant {number} */ export const DEFAULT_MFA_MAX_AGE_MS = 10 * 60 * 1000;
/** @constant {number} */ export const DEFAULT_MFA_MAX_WAIT_MS = 90000;

/**
 * Aplica um delay de espera assíncrono.
 * @param {number} ms - Milissegundos a aguardar.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Tenta converter uma string de data exibida na UI do Roundcube para um objeto Date.
 * Suporta formatos de hora ("14:25"), relativo ("Hoje 14:25", "Ontem 14:25") e formatos de data ("28/08/2026 14:25", "2026-08-28").
 *
 * @param {string} dateStr - String de data extraída da tabela do Roundcube.
 * @returns {Date|null} Objeto Date ou null se não puder ser parseado com precisão.
 */
export function parseRoundcubeDate(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  const str = dateStr.trim();
  if (!str) return null;

  // Formato apenas hora: "14:25" ou "14:25:30"
  const timeOnlyMatch = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (timeOnlyMatch) {
    const now = new Date();
    const hours = parseInt(timeOnlyMatch[1], 10);
    const minutes = parseInt(timeOnlyMatch[2], 10);
    const seconds = timeOnlyMatch[3] ? parseInt(timeOnlyMatch[3], 10) : 0;
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, seconds);
  }

  // Formato "Hoje 14:25" ou "Today 14:25"
  const todayTimeMatch = str.match(/(?:hoje|today)[^\d]*(\d{1,2}):(\d{2})(?::(\d{2}))?/i);
  if (todayTimeMatch) {
    const now = new Date();
    const hours = parseInt(todayTimeMatch[1], 10);
    const minutes = parseInt(todayTimeMatch[2], 10);
    const seconds = todayTimeMatch[3] ? parseInt(todayTimeMatch[3], 10) : 0;
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, seconds);
  }

  // Formato "Ontem 14:25" ou "Yesterday 14:25"
  const yesterdayMatch = str.match(/(?:ontem|yesterday)[^\d]*(\d{1,2}):(\d{2})(?::(\d{2}))?/i);
  if (yesterdayMatch) {
    const yesterday = new Date(Date.now() - 86400000);
    const hours = parseInt(yesterdayMatch[1], 10);
    const minutes = parseInt(yesterdayMatch[2], 10);
    const seconds = yesterdayMatch[3] ? parseInt(yesterdayMatch[3], 10) : 0;
    return new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), hours, minutes, seconds);
  }

  // Formato com data DD/MM/YYYY ou YYYY-MM-DD
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  return null;
}

/**
 * Acessa o cPanel Webmail Roundcube, autentica e extrai o código MFA de 6 dígitos
 * enviado pela DocuSign com o assunto "Verificar um novo dispositivo".
 *
 * @param {import("playwright").BrowserContext} context - Contexto do navegador Playwright.
 * @param {Object} mailCredentials - Credenciais { email, password }.
 * @param {Object} [options] - Opções adicionais de timeout, retry e filtros.
 * @param {number} [options.maxWaitMs=90000] - Tempo máximo de espera total em ms.
 * @param {number} [options.pollIntervalMs=5000] - Intervalo de polling em ms.
 * @param {number} [options.mfaTriggerTime] - Timestamp (ms) em que o MFA foi disparado na tela.
 * @param {string[]} [options.excludedCodes=[]] - Códigos já testados e inválidos a ignorar.
 * @param {string} [options.subjectFilter="Verificar um novo dispositivo"] - Texto esperado no assunto (string vazia desabilita o filtro).
 * @returns {Promise<string|null>} Código de 6 dígitos ou null se não encontrado.
 */
export async function fetchMfaCodeFromRoundcube(context, mailCredentials, options = {}) {
  const email = mailCredentials?.email;
  const password = mailCredentials?.password;

  if (!email || !password) {
    logger.warn("Roundcube", "Credenciais de e-mail de notificação não informadas para consulta MFA.");
    return null;
  }

  const roundcubeSel = selectors.roundcube || {};
  const loginUrl = roundcubeSel.login_url || "https://unitynordeste.com.br:2096/";
  const maxWaitMs = typeof options.maxWaitMs === "number" ? options.maxWaitMs : DEFAULT_MFA_MAX_WAIT_MS;
  const pollIntervalMs = options.pollIntervalMs || 5000;
  const mfaTriggerTime = typeof options.mfaTriggerTime === "number" ? options.mfaTriggerTime : null;
  const mfaMaxAgeMs =
    typeof options.mfaMaxAgeMs === "number"
      ? options.mfaMaxAgeMs
      : typeof options.maxAgeMs === "number"
        ? options.maxAgeMs
        : DEFAULT_MFA_MAX_AGE_MS;
  const excludedCodes = Array.isArray(options.excludedCodes) ? options.excludedCodes : [];
  const expectedSubject = typeof options.subjectFilter === "string" ? options.subjectFilter : "Verificar um novo dispositivo";

  logger.step("Roundcube", `Abrindo aba para verificar e-mail de segurança em ${loginUrl}...`);
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
      logger.step("Roundcube", `Efetuando login no webmail (${email})...`);
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
      logger.step("Roundcube", "Selecionando cliente Roundcube no painel do cPanel...");
      await roundcubeBtn.click();
      await page.waitForNavigation({ waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
      await sleep(2000);
    }

    // 3. Polling da Caixa de Entrada para localizar a mensagem mais recente da DocuSign
    logger.step("Roundcube", "Buscando mensagem de verificação da DocuSign na Caixa de Entrada...");
    const startedAt = Date.now();
    let mfaCode = null;

    // Padrões estritos de extração (regex genérica expurgada)
    const regexPatterns = [
      /Seu c[oó]digo de verifica[cç][aã]o da Docusign [eé]:\s*(\d{6})/i,
      /c[oó]digo de verifica[cç][aã]o[^0-9]{1,30}(\d{6})/i,
      /verification code[^0-9]{1,30}(\d{6})/i,
      /security code[^0-9]{1,30}(\d{6})/i,
    ];

    while (Date.now() - startedAt < maxWaitMs) {
      // Clica no botão de atualizar mensagens se disponível
      const refreshBtn = await page.$(roundcubeSel.refresh_button).catch(() => null);
      if (refreshBtn) {
        await refreshBtn.click().catch(() => {});
        await sleep(1500);
      }

      // Procura linhas de mensagens correspondentes à DocuSign
      const rows = await page.$$(roundcubeSel.message_row).catch(() => []);

      for (const row of rows) {
        const rowText = (await row.innerText().catch(() => "")).toLowerCase();
        const subjectMatches =
          !expectedSubject ||
          rowText.includes(expectedSubject.toLowerCase()) ||
          (rowText.includes("docusign") &&
            (rowText.includes("código de verificação") ||
              rowText.includes("codigo de verificacao") ||
              rowText.includes("verify your")));

        if (!subjectMatches) {
          continue;
        }

        // ponytail: parse falho => aceita (fallback precisa tentar extrair; bloquear perde código válido no reinício)
        // Recomendação: não descartar quando Roundcube exibe "agora/há X min" não-parseável; confiabilidade > falso positivo aqui.
        if (mfaTriggerTime) {
          const dateEl = await row.$("td.date, span.date, .date").catch(() => null);
          const dateStr = dateEl ? await dateEl.innerText().catch(() => "") : "";
          const parsedDate = parseRoundcubeDate(dateStr);
          if (!parsedDate) {
            logger.warn("Roundcube", `Data não reconhecível ("${dateStr}") — tratando como recente para não bloquear fallback.`);
          } else if (parsedDate.getTime() < mfaTriggerTime - mfaMaxAgeMs) {
            logger.step(
              "Roundcube",
              `Mensagem ignorada: data ${parsedDate.toISOString()} expirada (anterior a 10 min do disparo ${new Date(mfaTriggerTime).toISOString()}).`
            );
            continue;
          }
        }

        logger.step("Roundcube", "Mensagem de verificação da DocuSign encontrada! Abrindo e-mail...");
        await row.click();
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

        // Extrai código e filtra excludedCodes dentro do loop
        for (const regex of regexPatterns) {
          const match = bodyText.match(regex);
          if (match && match[1]) {
            const candidateCode = match[1];
            if (excludedCodes.includes(candidateCode)) {
              logger.step("Roundcube", `Código ${candidateCode} já foi rejeitado anteriormente. Buscando próximo...`);
              continue;
            }
            mfaCode = candidateCode;
            logger.success("Roundcube", `Código MFA extraído com sucesso: ${mfaCode}`);
            break;
          }
        }

        if (mfaCode) {
          break;
        }
      }

      if (mfaCode) {
        break;
      }

      logger.step("Roundcube", `E-mail ainda não recebido. Aguardando ${pollIntervalMs / 1000}s...`);
      await sleep(pollIntervalMs);
    }

    return mfaCode;
  } catch (error) {
    logger.error("Roundcube", `Erro ao extrair código MFA do Webmail: ${error.message}`);
    return null;
  } finally {
    if (page && !page.isClosed()) {
      await page.close().catch(() => {});
    }
  }
}

/**
 * Exportação padrão do fallback Roundcube.
 * @type {{fetchMfaCodeFromRoundcube: function, parseRoundcubeDate: function}}
 */
export default {
  fetchMfaCodeFromRoundcube,
  parseRoundcubeDate,
};
