import logger from "../../utils/logger.js";
import { randomDelay, captureDebugScreenshot } from "./stepUtils.js";

/**
 * Executa os Passos 7 e 8: Disparo do Envio e Confirmação de "Enviar sem campos".
 * @async
 * @param {import('playwright').Page} page - Instância da página Playwright.
 * @param {Object} sendSel - Seletores de envio da DocuSign.
 * @returns {Promise<void>}
 * @throws {Error} Caso falhe o envio do envelope.
 */
export async function executeSubmitEnvelopeStep(page, sendSel) {
  const sendButtonSelector = sendSel?.send_button || "button[data-qa='footer-send-button'], button[data-testid='send-button'], button[data-action='send']";
  const sendWithoutFieldsSelector = sendSel?.send_without_fields || "button[data-qa='send-without-fields'], button:has-text('Enviar sem campos'), button:has-text('Send without fields')";

  logger.step("Browser", "Clicando no botão de envio do envelope...");
  const sendBtn = page.locator(sendButtonSelector).first();

  try {
    await sendBtn.waitFor({ state: "visible", timeout: 25000 });
    await sendBtn.click();
    await randomDelay(1000, 2000);
  } catch (err) {
    await captureDebugScreenshot(page, "submit_click_fail");
    throw new Error(`Falha ao clicar no botão de envio (${sendButtonSelector}): ${err.message}`);
  }

  // Passo 8: Confirmação condicional de "Enviar sem campos" (espera ativa até 15s)
  logger.step("Browser", "Aguardando confirmação de envio (modal 'Enviar sem campos')...");
  const withoutFieldsBtn = page.locator(sendWithoutFieldsSelector).first();

  try {
    const isVisible = await withoutFieldsBtn.waitFor({ state: "visible", timeout: 15000 }).then(() => true).catch(() => false);
    if (isVisible) {
      logger.step("Browser", "Modal 'Enviar sem campos' detectado. Confirmando envio imediatamente...");
      await withoutFieldsBtn.click();
      await randomDelay(2000, 4000);
      logger.success("Browser", "Confirmação 'Enviar sem campos' submetida com sucesso.");
    } else {
      logger.info("Browser", "Modal 'Enviar sem campos' não foi exibido. Envio processado diretamente.");
    }
  } catch (modalErr) {
    logger.warn("Browser", `Tratamento do modal 'Enviar sem campos': ${modalErr.message}`);
  }

  logger.success("Browser", "Disparo do envelope concluído na DocuSign.");
}
