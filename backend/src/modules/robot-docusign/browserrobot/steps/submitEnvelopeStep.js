import { assertPage, guardedAction } from "./stepUtils.js";

/**
 * Aciona o clique no botão de envio do envelope no DocuSign e aguarda a conclusão da submissão.
 *
 * @param {Object} page - Instância de página do Playwright.
 * @param {Object} [sendSel={}] - Seletores da tela de envio.
 * @param {string} [email] - E-mail de autenticação para controle de sessão.
 * @returns {Promise<void>}
 * @throws {Error} Se o seletor de envio não estiver configurado ou o clique falhar.
 */
export async function submitEnvelope(page, sendSel = {}, email) {
  assertPage(page);

  const buttonSelector = sendSel?.send_button;
  if (!buttonSelector) {
    throw new Error("Seletor do botão de envio (send_button) não configurado na definição de seletores.");
  }

  await guardedAction(
    async () => {
      if (typeof page.locator === "function") {
        await page.locator(buttonSelector).first().click();
      } else if (typeof page.click === "function") {
        await page.click(buttonSelector);
      }
    },
    page,
    email
  );

  // Confirmação condicional do modal "Enviar sem campos"
  const sendWithoutFieldsSelector = sendSel?.send_without_fields || "button[data-qa='send-without-fields'], button:has-text('Enviar sem campos'), button:has-text('Send without fields')";
  if (typeof page.locator === "function") {
    try {
      const withoutFieldsBtn = page.locator(sendWithoutFieldsSelector).first();
      const isVisible = await withoutFieldsBtn.waitFor({ state: "visible", timeout: 8000 }).then(() => true).catch(() => false);
      if (isVisible) {
        await guardedAction(() => withoutFieldsBtn.click(), page, email);
      }
    } catch {
      // Modal opcional, segue o fluxo
    }
  }

  if (typeof page.waitForLoadState === "function") {
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  }
}
