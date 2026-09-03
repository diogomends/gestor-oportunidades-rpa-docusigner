import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { selectors, buildAgreementsUrl } from "../../../robot/src/browser/selectors.js";

describe("Robot Browser Selectors - Agreements Query", () => {
  it("deve conter os seletores corretos para consulta de acordos e paginação", () => {
    assert.ok(selectors.agreements, "Chave agreements deve existir nos seletores");
    assert.equal(selectors.agreements.url, "https://apps.docusign.com/send/documents");
    assert.equal(selectors.agreements.table, "[data-qa='manage-envelopes-list.table']");
    assert.equal(
      selectors.agreements.row,
      "tbody[data-qa='manage-envelopes-list.body'] tr, [data-qa='manage-envelopes-list.table'] tr, tr[data-qa^='manage-envelopes-list.row.']"
    );
    assert.equal(selectors.agreements.from_recipient, "[data-qa$='-mobile-from']");
    assert.ok(selectors.agreements.status.includes("-status-status"));
    assert.equal(
      selectors.agreements.pagination_next,
      "button[data-qa='manage-envelopes-list.footer.pagination-pagination-next']"
    );
  });

  it("buildAgreementsUrl deve gerar URL com data dinâmica de 5 dias atrás e pageSize=50", () => {
    const url = buildAgreementsUrl(5);
    const parsed = new URL(url);

    assert.equal(parsed.origin, "https://apps.docusign.com");
    assert.equal(parsed.pathname, "/send/documents");
    assert.equal(parsed.searchParams.get("view"), "agreements");
    assert.equal(parsed.searchParams.get("pageSize"), "50");

    const fromParam = parsed.searchParams.get("from");
    const toParam = parsed.searchParams.get("to");

    assert.match(fromParam, /^\d{4}-\d{2}-\d{2}$/, "from deve estar no formato YYYY-MM-DD");
    assert.match(toParam, /^\d{4}-\d{2}-\d{2}$/, "to deve estar no formato YYYY-MM-DD");

    const fromDate = new Date(fromParam);
    const toDate = new Date(toParam);
    const diffDays = Math.round((toDate - fromDate) / (1000 * 60 * 60 * 24));
    assert.equal(diffDays, 5, "Diferença deve ser de 5 dias");
  });

  it("buildAgreementsUrl deve aceitar dias customizados e URL base personalizada", () => {
    const customBase = "https://app.docusign.com/custom-path";
    const url = buildAgreementsUrl(10, customBase);
    const parsed = new URL(url);

    assert.equal(parsed.origin, "https://app.docusign.com");
    assert.equal(parsed.pathname, "/custom-path");
    assert.equal(parsed.searchParams.get("pageSize"), "50");

    const fromDate = new Date(parsed.searchParams.get("from"));
    const toDate = new Date(parsed.searchParams.get("to"));
    const diffDays = Math.round((toDate - fromDate) / (1000 * 60 * 60 * 24));
    assert.equal(diffDays, 10);
  });
});
