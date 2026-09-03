import logger from "../../utils/logger.js";
import { randomDelay, captureDebugScreenshot } from "./stepUtils.js";

/**
 * Candidatos de fallback para o botão "Avançar" (o data-qa muda entre releases).
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
 * Monta a lista de candidatos sem duplicar o que já veio no seletor configurado.
 * @param {Object} sendSel - Seletores de envio da DocuSign.
 * @returns {string[]} Candidatos na ordem de tentativa.
 */
export function buildNextButtonCandidates(sendSel) {
  const configured = String(sendSel?.next_button || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...configured, ...NEXT_BUTTON_FALLBACKS.filter((s) => !configured.includes(s))];
}

/**
 * Coleta diagnóstico do rodapé (botões visíveis + estado disabled) para o erro.
 * @async
 * @param {import('playwright').Page} page - Instância da página Playwright.
 * @returns {Promise<string>} Resumo dos botões do rodapé.
 */
async function dumpFooterButtons(page) {
  try {
    return await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("footer button, [data-callout*='footer'] button, button"));
      return btns
        .slice(-12)
        .map((b) => `${(b.textContent || b.innerText || "").trim().slice(0, 30)}|qa=${b.getAttribute("data-qa") || "-"}|dis=${b.disabled || b.getAttribute("aria-disabled")}`)
        .join(" ; ");
    });
  } catch {
    return "indisponível";
  }
}

/**
 * Executa o Passo 6 do envio: Avançar na tela de preparação para a etapa de envio.
 * @async
 * @param {import('playwright').Page} page - Instância da página Playwright.
 * @param {Object} sendSel - Seletores de envio da DocuSign.
 * @returns {Promise<void>}
 * @throws {Error} Caso o botão de avançar não esteja acessível ou a transição falhe.
 */
export async function executeAdvancePrepareStep(page, sendSel) {
  const candidates = buildNextButtonCandidates(sendSel);

  logger.step("Browser", "Avançando para a etapa de finalização e envio do envelope...");
  // ponytail: commita o campo focado (screenshot mostrava foco no e-mail) p/ liberar validação do footer
  await page.keyboard.press("Tab").catch(() => {});
  await randomDelay(800, 1500);

  const perCandidateTimeout = Math.max(4000, Math.floor(20000 / candidates.length));
  const errors = [];
  const sendButtonSelector = sendSel?.send_button || "button[data-qa='footer-send-button'], button[data-testid='send-button'], button[data-action='send']";

  for (const selector of candidates) {
    const nextBtn = page.locator(selector).first();
    try {
      await nextBtn.waitFor({ state: "visible", timeout: perCandidateTimeout });
      await nextBtn.scrollIntoViewIfNeeded().catch(() => {});
      await nextBtn.click();

      // Anti-phantom success: confirma transição de tela aguardando send_button ou ocultação do botão avançar
      const transitioned = await Promise.race([
        page.locator(sendButtonSelector).first().waitFor({ state: "visible", timeout: 15000 }).then(() => true).catch(() => false),
        nextBtn.waitFor({ state: "hidden", timeout: 15000 }).then(() => true).catch(() => false),
      ]);

      if (transitioned) {
        await randomDelay(1500, 3000);
        logger.success("Browser", "Transição para tela de envio realizada com sucesso.");
        return;
      }
      errors.push(`${selector}: transição não confirmada após clique`);
    } catch (err) {
      errors.push(`${selector}: ${err.message?.split("\n")[0] || err.message}`);
    }
  }

  await captureDebugScreenshot(page, "advance_fail");
  const footer = await dumpFooterButtons(page);
  throw new Error(`Falha ao clicar no botão de avançar. Tentativas: ${errors.join(" | ")}. Rodapé: ${footer}`);
}
