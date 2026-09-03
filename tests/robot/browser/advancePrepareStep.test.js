import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { executeAdvancePrepareStep, buildNextButtonCandidates } from "../../../robot/src/browser/steps/advancePrepareStep.js";
import { selectors } from "../../../robot/src/browser/selectors.js";

/**
 * Monta um mock mínimo de Page com visibilidade controlada por seletor.
 * @param {string|null} visibleSelector - Seletor que deve responder como visível.
 * @param {string} footerDump - Retorno simulado do dump do rodapé.
 * @param {Object} [options] - Opções extras de simulação.
 * @param {boolean} [options.sendButtonVisible=true] - Se o send_button deve ficar visível na transição.
 * @returns {Object} Mock de página Playwright.
 */
function mockPage(visibleSelector, footerDump = "Avançar|qa=-|dis=false", options = {}) {
  const { sendButtonVisible = true } = options;
  return {
    keyboard: { press: async () => {} },
    locator: (sel) => ({
      first: () => ({
        waitFor: async ({ state } = {}) => {
          if (state === "hidden") {
            if (sel === visibleSelector) return;
            throw new Error("Element not hidden");
          }
          if (sel === visibleSelector) return;
          if (sendButtonVisible && sel && (sel.includes("send-button") || sel.includes("footer-send-button"))) return;
          throw new Error("Timeout 4000ms exceeded");
        },
        scrollIntoViewIfNeeded: async () => {},
        click: async () => {},
      }),
    }),
    evaluate: async () => footerDump,
    isClosed: () => true,
  };
}

describe("advancePrepareStep - fallback do botão Avançar", () => {
  it("seletor canônico deve conter fallback por texto", () => {
    assert.ok(selectors.send.next_button.includes("Avançar"));
  });

  it("buildNextButtonCandidates deve deduplicar e manter fallbacks", () => {
    const list = buildNextButtonCandidates({ next_button: "button[data-qa='footer-add-fields-link-correct']" });
    assert.ok(list.includes("button:has-text('Avançar')"));
    assert.equal(new Set(list).size, list.length);
  });

  it("deve clicar no fallback quando o data-qa antigo está invisível", async () => {
    const page = mockPage("button:has-text('Avançar')");
    await executeAdvancePrepareStep(page, { next_button: "button[data-qa='footer-add-fields-link-correct']" });
  });

  it("deve incluir dump do rodapé no erro quando nada está visível", async () => {
    const page = mockPage(null, "Enviar agora|qa=-|dis=false");
    await assert.rejects(() => executeAdvancePrepareStep(page, {}), /Rodapé: Enviar agora/);
  });
});
