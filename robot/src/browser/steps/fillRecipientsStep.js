import logger from "../../utils/logger.js";
import { randomDelay, waitForElementCount, captureDebugScreenshot } from "./stepUtils.js";

/**
 * Normaliza e deduplica uma lista de destinatários.
 * @param {Array<{name: string, email: string}>|Object} recipients - Lista ou objeto individual.
 * @returns {Array<{name: string, email: string}>} Lista deduplicada de destinatários válidos.
 */
export function normalizeRecipientsList(recipients) {
  const list = Array.isArray(recipients) ? recipients : recipients ? [recipients] : [];
  const seen = new Set();
  const result = [];

  for (const item of list) {
    const name = (item.name || item.recipientName || "").trim();
    const email = (item.email || item.recipientEmail || "").trim().toLowerCase();
    if (!name || !email) continue;

    const key = `${name.toLowerCase()}||${email}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push({ name, email });
    }
  }

  return result;
}

/**
 * Executa os Passos 2 a 5: Preenchimento de Destinatários na DocuSign com suporte a múltiplos signatários.
 * @async
 * @param {import('playwright').Page} page - Instância da página Playwright.
 * @param {Array<{name: string, email: string}>|Object} recipientsData - Destinatários a serem preenchidos.
 * @param {Object} sendSel - Seletores de envio da DocuSign.
 * @returns {Promise<void>}
 * @throws {Error} Caso nenhum destinatário seja informado ou falhe o preenchimento.
 */
export async function executeFillRecipientsStep(page, recipientsData, sendSel) {
  const recipients = normalizeRecipientsList(recipientsData);

  if (recipients.length === 0) {
    throw new Error("Nenhum destinatário válido informado para preenchimento no envelope.");
  }

  const nameSelector = sendSel?.recipient_name || "input[data-qa='recipient-name']";
  const emailSelector = sendSel?.recipient_email || "input[data-qa='recipient-email']";
  const deliverySelector = sendSel?.delivery_checkbox || "input[data-qa='delivery-email']";
  const addRecipientSelector = sendSel?.recipients_add || "button[data-qa='recipients-add']";

  const nameLocators = page.locator(nameSelector);
  const emailLocators = page.locator(emailSelector);
  const deliveryLocators = page.locator(deliverySelector);

  logger.step("Browser", `Iniciando preenchimento de ${recipients.length} destinatário(s) no envelope...`);

  for (let i = 0; i < recipients.length; i++) {
    const { name, email } = recipients[i];
    logger.step("Browser", `Preenchendo destinatário ${i + 1}/${recipients.length}: ${name} (${email})...`);

    if (i > 0) {
      logger.step("Browser", `Adicionando novo destinatário (${i + 1})...`);
      const addBtn = page.locator(addRecipientSelector).first();
      await addBtn.waitFor({ state: "visible", timeout: 15000 });
      await addBtn.scrollIntoViewIfNeeded().catch(() => {});
      await addBtn.click();
      await randomDelay(1000, 2000);

      // Aguarda até que a contagem de inputs atinja i + 1
      const countOk = await waitForElementCount(nameLocators, i + 1, 15000);
      if (!countOk) {
        await captureDebugScreenshot(page, `recipient_add_fail_${i}`);
        throw new Error(`Falha ao adicionar novo bloco de destinatário (${i + 1}): tempo limite de 15s excedido.`);
      }
    }

    // 1. Preenchimento de Nome
    const nameField = nameLocators.nth(i);
    await nameField.waitFor({ state: "visible", timeout: 15000 });
    await nameField.fill(name);
    await randomDelay(300, 600);

    // Validação de preenchimento do Nome
    const filledName = await nameField.inputValue().catch(() => "");
    if (filledName.trim() !== name) {
      logger.warn("Browser", `Divergência ao preencher nome do destinatário ${i + 1}. Tentando novamente...`);
      await nameField.fill(name);
      const retryName = await nameField.inputValue().catch(() => "");
      if (retryName.trim() !== name) {
        throw new Error(`Falha ao preencher nome do destinatário ${i + 1}: esperado '${name}', obtido '${retryName}'`);
      }
    }

    // 2. Verificação do Checkbox de Entrega
    try {
      const deliveryCheckbox = deliveryLocators.nth(i);
      const isVisible = await deliveryCheckbox.isVisible({ timeout: 2000 }).catch(() => false);
      if (isVisible) {
        const isChecked = await deliveryCheckbox.isChecked().catch(() => true);
        if (!isChecked) {
          logger.step("Browser", `Marcando checkbox de entrega por e-mail para destinatário ${i + 1}...`);
          await deliveryCheckbox.check().catch(() => deliveryCheckbox.click());
          await randomDelay(300, 600);
        }
      }
    } catch (checkErr) {
      logger.warn("Browser", `Checkbox de entrega do destinatário ${i + 1} não pôde ser verificado: ${checkErr.message}`);
    }

    // 3. Preenchimento de E-mail
    const emailField = emailLocators.nth(i);
    await emailField.waitFor({ state: "visible", timeout: 15000 });
    await emailField.fill(email);
    await randomDelay(300, 600);

    // Validação de preenchimento do E-mail
    const filledEmail = await emailField.inputValue().catch(() => "");
    if (filledEmail.trim().toLowerCase() !== email) {
      logger.warn("Browser", `Divergência ao preencher e-mail do destinatário ${i + 1}. Tentando novamente...`);
      await emailField.fill(email);
      const retryEmail = await emailField.inputValue().catch(() => "");
      if (retryEmail.trim().toLowerCase() !== email) {
        throw new Error(`Falha ao preencher e-mail do destinatário ${i + 1}: esperado '${email}', obtido '${retryEmail}'`);
      }
    }
    // ponytail: Tab commita o campo e dispara a validação inline da DocuSign
    await emailField.press("Tab").catch(() => {});
    await randomDelay(300, 600);

    logger.success("Browser", `Destinatário ${i + 1} (${name}) preenchido e validado com sucesso.`);
  }

  logger.success("Browser", `Todos os ${recipients.length} destinatário(s) foram preenchidos com sucesso.`);
}
