import { assertPage, isLoginUrl } from "./stepUtils.js";

/**
 * Extrai ou resolve o identificador único do envelope após a submissão.
 *
 * @param {Object} page - Instância de página do Playwright.
 * @param {Object} [sendSel={}] - Seletores da tela de envio.
 * @param {string} [fallbackEnvelopeId] - ID pré-existente fornecido ou fallback.
 * @returns {Promise<string>} Identificador do envelope extraído.
 * @throws {Error} Lança erro descritivo se não for possível extrair o ID do envelope.
 */
export async function extractEnvelopeId(page, sendSel = {}, fallbackEnvelopeId) {
  assertPage(page);

  const currentUrl = page.url();
  if (isLoginUrl(currentUrl)) {
    throw new Error(`Não foi possível extrair envelopeId: o navegador foi redirecionado para a tela de autenticação (${currentUrl}).`);
  }

  // Regex estrita de UUID v4 de 36 caracteres (ex: 12345678-1234-1234-1234-123456789abc)
  const UUID_REGEX = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i;

  // Nível 1: Extração via URL atual pós-redirecionamento com múltiplos padrões
  let extractedId = null;
  const urlMatches = [
    currentUrl.match(/\/envelopes\/([a-f0-9-]{36})/i),
    currentUrl.match(/details\/([a-f0-9-]{36})/i),
    currentUrl.match(/envelopeId=([a-f0-9-]{36})/i),
    currentUrl.match(/documents\/([a-f0-9-]{36})/i),
  ];

  for (const m of urlMatches) {
    if (m && m[1] && UUID_REGEX.test(m[1])) {
      extractedId = m[1];
      break;
    }
  }

  // Nível 2: Leitura da 1ª linha da tabela de documentos na UI
  if (!extractedId && typeof page.locator === "function") {
    try {
      const firstRowLink = page.locator("tbody tr a[href*='details/'], [data-qa='manage-envelopes-list.table'] tr a").first();
      const isVisible = await firstRowLink.isVisible({ timeout: 4000 }).catch(() => false);
      if (isVisible) {
        const href = await firstRowLink.getAttribute("href").catch(() => "");
        const match = href.match(UUID_REGEX);
        if (match && match[0]) {
          extractedId = match[0];
        }
      }
    } catch {
      // Falha no Nível 2 tratada pelo Nível 3 / erro
    }
  }

  if (extractedId && typeof extractedId === "string" && UUID_REGEX.test(extractedId)) {
    return extractedId.trim();
  }

  // Nível 3: Fallback para ID pré-existente válido fornecido pelo chamador
  if (typeof fallbackEnvelopeId === "string" && UUID_REGEX.test(fallbackEnvelopeId.trim())) {
    return fallbackEnvelopeId.trim();
  }

  throw new Error(
    `Não foi possível extrair o envelopeId após submissão no DocuSign. URL atual: '${currentUrl}'. Verifique se o envelope foi criado ou se necessita confirmação de status.`
  );
}
