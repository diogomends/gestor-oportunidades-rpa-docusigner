# ~~Criador de Contratos PDF~~ — DEPRECATED / REPLACED

> ⚠️ **Este módulo foi substituído pelo `gerador-pdf-html` e seu código-fonte foi removido.**
> O novo módulo gera PDFs a partir de HTML + Playwright, eliminando a complexidade da renderização procedural com `pdf-lib`.
> - **Substituto**: `src/modules/gerador-pdf-html/`
> - **Spec**: `.specs/features/gerador-pdf-html/spec.md`
> - **Migração concluída em**: Julho/2026
>
> Os layouts e templates foram copiados para o novo módulo. A logo permanece em `src/modules/criador-contratos-pdf/assets/logo.png` e é lida pelo `gerador-pdf-html/submodules/permanencia/permanenciaService.js`.

## Problem Statement

O mecanismo legado de geração de PDFs operava no frontend (`public/modules/contratos/pdf/`) dependendo de modelos Base64 estáticos e retângulos de máscara brancos. A migração para um módulo dedicado no backend (`src/modules/criador-contratos-pdf/`) permite gerar PDFs 100% dinâmicos no servidor, aliviando o cliente, aumentando a segurança e facilitando o envio para o DocuSign e salvamento no MongoDB.

## Goals

- [x] Criar o módulo backend desacoplado em `src/modules/criador-contratos-pdf/` para geração dinâmica de PDFs de contrato.
- [x] Implementar a renderização limpa de cabeçalho, logomarca (PNG/JPG), cláusulas e campos via `pdf-lib` no servidor.
- [x] Expor endpoints de geração/download (`/api/contracts/generate-pdf`) reaproveitáveis por todo o sistema.
- [x] Manter total retrocompatibilidade com a interface de Contratos no frontend e integração DocuSign.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Alteração nas rotas de autenticação/usuários | O módulo utilizará o `authMiddleware` padrão do sistema. |
| Alteração na estrutura da collection `contracts` | O schema Mongoose continuará compatível com o banco `crm_contracts`. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Localização do Módulo | Backend (`src/modules/criador-contratos-pdf/`) | Processamento no servidor reduz carga no cliente e unifica envio ao DocuSign | Sim |
| Formato de Resposta HTTP | Binary Buffer / Application PDF | Permite download direto ou exibição em iFrame no frontend | Sim |
| Gerenciamento de Logomarca | Arquivo estático em `src/modules/criador-contratos-pdf/assets/` | Facilidade de substituição e carregamento direto pelo Node | Sim |

---

## User Stories

### P1: Módulo Backend de Geração de PDF (`src/modules/criador-contratos-pdf`) ⭐ MVP

**User Story**: Como desenvolvedor e usuário do sistema, quero solicitar a geração de PDFs de contrato ao backend para obter documentos dinâmicos com logomarca e sem resquícios de modelos antigos.

**Why P1**: Move a responsabilidade de geração de PDF para o servidor, garantindo performance e isolamento de código.

**Acceptance Criteria**:

1. WHEN o frontend enviar uma requisição `POST /api/contracts/generate-pdf` com os dados do contrato THEN o servidor SHALL renderizar o PDF limpo com a logomarca no cabeçalho e cláusulas formatadas.
2. WHEN o PDF for gerado no backend THEN o servidor SHALL retornar o buffer binário do PDF e/o URL de armazenamento.
3. WHEN a opção de envio para o DocuSign for acionada THEN o backend SHALL transmitir o buffer do novo PDF diretamente para o serviço do DocuSign.

**Independent Test**: Executar requisição HTTP para a rota de geração do PDF no backend e validar que o buffer retornado é um PDF válido com a logo e cláusulas preenchidas.

---

### P2: Retrocompatibilidade da Interface Frontend

**User Story**: Como usuário do CRM, quero clicar no botão de gerar/emitir contrato no frontend e receber o documento novo sem perceber alterações no meu fluxo de trabalho.

**Why P2**: Preserva a experiência do usuário ajustando apenas os imports/chamadas de API no frontend.

**Acceptance Criteria**:

1. WHEN o usuário clicar em emitir contrato na tela THEN a aplicação frontend SHALL chamar a API backend em `src/modules/criador-contratos-pdf/`.
2. WHEN o contrato for gerado THEN a tela SHALL disponibilizar o download ou a pré-visualização sem erros.

**Independent Test**: Testar a emissão na interface e validar a substituição transparente do gerador legado pelo novo módulo backend.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| PDFMODULE-01 | P1: Módulo Backend `criador-contratos-pdf` | Verified | Deprecated |
| PDFMODULE-02 | P1: Endpoint HTTP `/api/contracts/generate-pdf` | Verified | Deprecated |
| PDFMODULE-03 | P2: Integração Frontend & DocuSign | Verified | Deprecated |

---

## Success Criteria

- [x] Módulo backend criado em `src/modules/criador-contratos-pdf/` seguindo SOLID.
- [x] Geração dinâmica de PDF funcionando via `pdf-lib` no Node.js.
- [x] Frontend adaptado para consumir o novo módulo backend.
