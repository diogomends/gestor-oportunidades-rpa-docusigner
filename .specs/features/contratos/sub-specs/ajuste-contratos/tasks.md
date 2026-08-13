# Ajuste de Contratos e Ofertas — Tasks

## Phase 1: Database and Backend Support

- [x] **Task 1: Update Mongoose Schema in Contract Model**
  - **Description**: Modify `src/modules/contract/models/Contract.js` to change `negotiation` from a single object to an array of objects representing negotiation sections. Each section will support `tipoLinha` and `portabilityLines` arrays.
  - **Verification**: Run `npm test` or a validation script to ensure schema can load.

- [x] **Task 2: Support Retrocompatibility in Controller and Service**
  - **Description**: Update `src/modules/contract/controllers/contractController.js` and services to convert older single-object `negotiation` formats to array-of-objects dynamically when retrieved from the DB, and handle it gracefully on writes/updates.
  - **Verification**: Add check logic or run integration tests ensuring contract objects return `negotiation` as an array.

- [x] **Task 3: Refactor Backend Validation Service**
  - **Description**: Update `src/modules/contract/validation/validationService.js` to validate array items inside `negotiation`. Validate the presence of `tipoLinha`, and if "port-in", validate the list of portability lines (cpf/cnpj, phone format, name, operator).
  - **Verification**: Run mock validations against nested array items in contract payloads.

## Phase 2: Frontend Layout and Base Dynamic Logic

- [x] **Task 4: Update contrats.html Layout for Compact Grid**
  - **Description**: Adjust layout of `neg-plano`, `neg-oferta`, and `neg-valor-mensal` inside `public/modules/contratos/contratos.html` to be col-4/col-4/col-4, aligning them on the same line.
  - **Verification**: Open frontend page in browser to visually confirm alignment.

- [x] **Task 5: Implement Dynamic Section Template and Add Section Button**
  - **Description**: Update HTML structure of `section-opcoes-oferta` to support dynamic cloning. Add an "Adicionar Nova Oferta" button that replicates this section, assigning unique dynamic IDs/data attributes to nested fields.
  - **Verification**: Click "Adicionar Nova Oferta" and check if a new section with duplicate inputs is appended.

## Phase 3: Portability Sub-fields and Interaction Logic

- [x] **Task 6: Implement Port-in vs Linha Nova Rádio Buttons**
  - **Description**: Add "Port in" and "Linha Nova" radio buttons inside the offer section. Show/hide portability sub-fields (Tipo Cedente, Operadora, Nome Cedente, CPF/CNPJ, Telefone) when Port-in is selected.
  - **Verification**: Select "Port in" and verify the sub-fields display. Select "Linha Nova" and verify they are hidden.

- [x] **Task 7: Add Portability Lines Addition Logic**
  - **Description**: Implement a button "Adicionar mais números portados" inside each Port-in section, which appends a group of name/document/phone/operator inputs within that section.
  - **Verification**: Click the button and check if a new input group for a phone number is appended.

- [x] **Task 8: Mask and Validate Dynamic Fields in Frontend**
  - **Description**: Register input listeners on dynamically added fields to apply CPF/CNPJ dynamic masks (depending on PF/PJ select) and Telephone masks.
  - **Verification**: Type documents and phone numbers in dynamically added fields and verify masks apply.

## Phase 4: Frontend Data Collection and Summary Sync

- [x] **Task 9: Refactor collectFormData() and syncSummary()**
  - **Description**: Refactor `public/modules/contratos/contratos.js` to build a structured payload where `negotiation` is an array of objects. Update `syncSummary()` to show a summary list of all plans/lines, keeping fallback root properties for PDF generation.
  - **Verification**: Fill multiple sections, click advance, and inspect console to verify correct JSON format.

- [x] **Task 10: Run Verifier and Final Regression check**
  - **Description**: Perform full end-to-end tests (manual and native unit tests if any) to confirm that the new contract structure is correctly saved, updated, and does not break existing contracts.
  - **Verification**: Validate schema, controller endpoints, and frontend submit pipeline.
