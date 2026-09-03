import { assertPage, guardedAction } from "./stepUtils.js";

/**
 * Candidatos de fallback para o botão "Avançar" na interface DocuSign.
 * @constant
 * @type {string[]}
 */
const NEXT_BUTTON_FALLBACKS = [
  "button[data-qa='footer-add-fields-link-correct']",
  "[data-qa='footer-prepare-next-action'] button",
  "[data-callout='footer-prepare-next-action'] button",
  "button:has-text('Avançar')",
];

/**
 * Constrói lista de candidatos para o botão Avançar sem duplicatas.
 *
 * @param {Object} [sendSel={}] - Seletores da tela de envio.
 * @returns {string[]} Lista ordenada de seletores candidatos.
 */
export function buildNextButtonCandidates(sendSel = {}) {
  const configured = String(sendSel?.next_button || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...configured, ...NEXT_BUTTON_FALLBACKS.filter((s) => !configured.includes(s))];
}

/**
 * Avança da etapa de preparação de campos para a tela de envio final no DocuSign.
 *
 * @param {Object} page - Instância de página do Playwright.
 * @param {Object} [sendSel={}] - Seletores da tela de envio.
 * @param {string} [email] - E-mail de autenticação para controle de sessão.
 * @returns {Promise<void>}
 * @throws {Error} Se não for possível acionar o botão de avançar.
 * @async
 */
export async function advancePrepare(page, sendSel = {}, email) {
  assertPage(page);

  const candidates = buildNextButtonCandidates(sendSel);
  const sendButtonSelector = sendSel?.send_button || "button[data-qa='footer-send-button'], button[data-testid='send-button'], button[data-action='send']";

  if (page.keyboard && typeof page.keyboard.press === "function") {
    await page.keyboard.press("Tab").catch(() => {});
  }

  let advanced = false;
  const errors = [];

  for (const selector of candidates) {
    try {
      await guardedAction(
        async () => {
          if (typeof page.locator === "function") {
            const btn = page.locator(selector).first();
            await btn.waitFor({ state: "visible", timeout: 5000 });
            if (typeof btn.scrollIntoViewIfNeeded === "function") {
              await btn.scrollIntoViewIfNeeded().catch(() => {});
            }
            await btn.click();
          } else if (typeof page.click === "function") {
            await page.click(selector);
          }
        },
        page,
        email
      );

      // Confirmação de transição (send_button visível ou botão avançar oculto)
      if (typeof page.locator === "function") {
        const transitioned = await Promise.race([
          page.locator(sendButtonSelector).first().waitFor({ state: "visible", timeout: 10000 }).then(() => true).catch(() => false),
          page.locator(selector).first().waitFor({ state: "hidden", timeout: 10000 }).then(() => true).catch(() => false),
        ]);
        if (transitioned) {
          advanced = true;
          break;
        }
      } else {
        advanced = true;
        break;
      }
    } catch (err) {
      errors.push(`${selector}: ${err.message?.split("\n")[0] || err.message}`);
    }
  }

  if (!advanced) {
    throw new Error(`Falha ao avançar tela de preparação no DocuSign. Tentativas: ${errors.join(" | ")}`);
  }
}
