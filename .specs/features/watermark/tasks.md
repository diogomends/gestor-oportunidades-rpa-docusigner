# Lista de Tarefas (Tasks) — Módulo Watermark

Este documento descreve as tarefas atômicas de implementação, refatoração e migração necessárias para o Módulo Watermark.

---

## Tasks

### WM-01: Criação da Estrutura Modular `src/modules/watermark/`
- [x] **Descrição**: Criar a estrutura física de diretórios e arquivos base para o módulo isolado `watermark`.
- [x] **Arquivos**:
  - `src/modules/watermark/index.js`
  - `src/modules/watermark/services/watermarkService.js`
  - `src/modules/watermark/controllers/watermarkController.js`
  - `src/modules/watermark/routes/watermarkRoutes.js`
- [x] **Critérios de Aceitação**: Módulo estruturado em conformidade com o padrão ES Modules do projeto.
- [x] **AC Alignment**: `WATERMARK-01`

### WM-02: Implementação dos Motores de Injeção (PDF e Imagens)
- [x] **Descrição**: Implementar o `WatermarkService` com suporte a injeção em PDFs via `pdf-lib` e imagens via `sharp`.
- [x] **Arquivos**:
  - `src/modules/watermark/services/watermarkService.js`
- [x] **Critérios de Aceitação**:
  - PDF recebe carimbo diagonal com dados formatados do usuário e opacidade.
  - Imagem recebe overlay SVG proporcional.
- [x] **AC Alignment**: `WATERMARK-05`, `WATERMARK-06`, `WATERMARK-07`, `WATERMARK-08`, `WATERMARK-09`

### WM-03: Integração com a Flag `watermark_enabled` do SystemConfig
- [x] **Descrição**: Adicionar verificação de `ui_visibility.watermark_enabled` no início da execução de `applyWatermark`.
- [x] **Arquivos**:
  - `src/modules/watermark/services/watermarkService.js`
- [x] **Critérios de Aceitação**: Se a flag estiver `false`, o serviço ignora a injeção e retorna o buffer original.
- [x] **AC Alignment**: `WATERMARK-03`, `WATERMARK-04`

### WM-04: Implementação da Estratégia de Fallback (Fail-Safe)
- [x] **Descrição**: Envolver a execução em `try/catch` para garantir que falhas em PDFs protegidos ou imagens corrompidas resultem na devolução do buffer original.
- [x] **Arquivos**:
  - `src/modules/watermark/services/watermarkService.js`
- [x] **Critérios de Aceitação**: Falhas são capturadas e logadas sem interromper o fluxo com erro HTTP 500.
- [x] **AC Alignment**: `WATERMARK-10`

### WM-05: Refatoração das Referências Legadas (Migração Módulo Contratos)
- [x] **Descrição**: Atualizar todas as chamadas no código do CRM e módulo de contratos que utilizavam `watermarkService` antigo para importar exclusivamente de `src/modules/watermark/services/watermarkService.js`.
- [x] **Arquivos**:
  - `src/modules/contract/services/docusignService.js`
  - `src/modules/contract/controllers/contractController.js`
- [x] **Critérios de Aceitação**: Nenhuma referência a `watermarkService` legada permanece em `contract/`.
- [x] **AC Alignment**: `WATERMARK-02`

### WM-06: Suíte de Testes Nativos do Módulo Watermark
- [x] **Descrição**: Criar testes automatizados para verificar a injeção em PDFs, imagens, bypass por flag e fallback em caso de erro.
- [x] **Arquivos**:
  - `tests/watermark.test.js`
- [x] **Critérios de Aceitação**: Todos os testes passam com `node --test`.
- [x] **AC Alignment**: `WATERMARK-03`, `WATERMARK-04`, `WATERMARK-05`, `WATERMARK-08`, `WATERMARK-10`
