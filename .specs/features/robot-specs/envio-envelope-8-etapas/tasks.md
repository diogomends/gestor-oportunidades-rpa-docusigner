# Tasks: Envio de Envelope DocuSign em 8 Etapas & Modularização de Steps

## Phase 1: Seletores & Utilitários
- [x] **Task 1.1**: Atualizar seletores de envio em `robot/src/browser/selectors.js`, `backend/src/modules/robot-docusign/selectors/docusign-ui.json` e `backend/src/modules/robot-docusign/browserrobot/robotSelectors.js`.
- [x] **Task 1.2**: Criar `robot/src/browser/steps/stepUtils.js` com helpers de espera ativa, delays aleatórios, contagem de elementos, screenshot de depuração e interceptador de rede `attachNetworkEnvelopeInterceptor` com cleanup seguro.

## Phase 2: Steps Modulares de Envio (Robô Standalone)
- [x] **Task 2.1**: Implementar `robot/src/browser/steps/uploadStep.js` com navegação para `https://apps.docusign.com/send/prepare/` e upload via `input[type='file']`.
- [x] **Task 2.2**: Implementar `robot/src/browser/steps/fillRecipientsStep.js` com preenchimento ordinal (`.nth(i)`), checkbox de entrega, loop de `recipients-add` e validação de digitação.
- [x] **Task 2.3**: Implementar `robot/src/browser/steps/advancePrepareStep.js` para avançar após preenchimento dos destinatários.
- [x] **Task 2.4**: Implementar `robot/src/browser/steps/submitEnvelopeStep.js` com clique no botão de envio e espera ativa de 15s para "Enviar sem campos".
- [x] **Task 2.5**: Implementar `robot/src/browser/steps/extractEnvelopeIdStep.js` com cascata de 4 níveis para captura de Envelope ID (URL, rede, DOM com `waitForSelector`, fallback).

## Phase 3: Orquestração e Integração Backend
- [x] **Task 3.1**: Atualizar `robot/src/browser/envelopes.js` e `robot/src/browser/docusign.js` para orquestrar o pipeline sequencial de steps com garantia de limpeza via `try...finally`.
- [x] **Task 3.2**: Atualizar `backend/src/modules/robot-docusign/controllers/robotInstanceController.js` para compor `recipients` com representante e linhas de portabilidade deduplicadas no `GET /instance/next-job`.
- [x] **Task 3.3**: Atualizar `robot/src/job-runner.js` para passar `recipients` para `sendEnvelope` e registrar debug screenshot em falhas.

## Phase 4: Validação & Documentação
- [x] **Task 4.1**: Criar/atualizar `.specs/features/robot-specs/envio-envelope-8-etapas/validation.md` e atualizar `.specs/STATE.md` com os registros de decisão (AD-064 e AD-069) e débito técnico (DT-001).
