import logger from "../../utils/logger.js";
import { randomDelay, captureDebugScreenshot } from "./stepUtils.js";

/**
 * Executa o Passo 6 do envio: Avançar na tela de preparação para a etapa de envio.
 * @async
 * @param {import('playwright').Page} page - Instância da página Playwright.
 * @param {Object} sendSel - Seletores de envio da DocuSign.
 * @returns {Promise<void>}
 * @throws {Error} Caso o botão de avançar não esteja acessível.
 */
export async function executeAdvancePrepareStep(page, sendSel) {
  const nextButtonSelector = sendSel?.next_button || "button[data-qa='footer-add-fields-link-correct']";

  logger.step("Browser", "Avançando para a etapa de finalização e envio do envelope...");
  const nextBtn = page.locator(nextButtonSelector).first();

  try {
    await nextBtn.waitFor({ state: "visible", timeout: 20000 });
    await nextBtn.click();
    await randomDelay(2000, 4000);
  } catch (err) {
    await captureDebugScreenshot(page, "advance_fail");
    throw new Error(`Falha ao clicar no botão de avançar (${nextButtonSelector}): ${err.message}`);
  }

  logger.success("Browser", "Transição para tela de envio realizada com sucesso.");
}
