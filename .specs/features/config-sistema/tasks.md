# Tasks: Módulo Exibir / Ocultar Elementos de Interface

## Overview
Implementação do controle de visibilidade para a seção `.contracts-section` e criação do submódulo `exibir-ocultar` na Central de Configurações do Sistema.

---

## Tasks

### Task 1: Backend - Rotas e Controller para Configuração de Visibilidade UI
- **Description**: Adicionar endpoints e lógica de controlador para gerenciar a chave `ui_visibility` no MongoDB (suportando `contracts_section` e `watermark_enabled`).
- **Files**:
  - `src/modules/config-sistema/controllers/systemConfigController.js`
  - `src/modules/config-sistema/routes.js`
- **AC Alignment**: `SYSTEM-CONFIG-VISIBILITY-01`, `SYSTEM-CONFIG-VISIBILITY-02`, `SYSTEM-CONFIG-VISIBILITY-03`, `SYSTEM-CONFIG-VISIBILITY-04`

### Task 2: Frontend - Módulo Exibir / Ocultar e Card na Central de Configurações
- **Description**: Criar a interface visual `exibir-ocultar.html`, `exibir-ocultar.js`, `exibir-ocultar.css` e adicionar o novo card em `config-sistema.html`, incluindo os switches de visibilidade de seções e controle global de marca d'água (`watermark_enabled`).
- **Files**:
  - `public/modules/config-sistema/config-sistema.html`
  - `public/modules/config-sistema/exibir-ocultar/exibir-ocultar.html`
  - `public/modules/config-sistema/exibir-ocultar/exibir-ocultar.js`
  - `public/modules/config-sistema/exibir-ocultar/exibir-ocultar.css`
- **AC Alignment**: `SYSTEM-CONFIG-VISIBILITY-05`, `SYSTEM-CONFIG-VISIBILITY-06`, `SYSTEM-CONFIG-VISIBILITY-07`, `SYSTEM-CONFIG-VISIBILITY-10`

### Task 3: Frontend Enforcement - Remoção Estrita do HTML no Módulo de Contratos
- **Description**: Adicionar verificação de visibilidade no carregamento de `contratos.js` e remover `.contracts-section` do DOM quando desativado.
- **Files**:
  - `public/modules/contratos/contratos.js`
- **AC Alignment**: `SYSTEM-CONFIG-VISIBILITY-08`, `SYSTEM-CONFIG-VISIBILITY-09`

### Task 4: Integração do Switch Watermark com o WatermarkService
- **Description**: Garantir que o `WatermarkService` consulte `watermark_enabled` em `SystemConfig` antes de realizar a injeção em PDFs e imagens.
- **Files**:
  - `src/modules/watermark/services/watermarkService.js`
  - `src/modules/config-sistema/controllers/systemConfigController.js`
- **AC Alignment**: `SYSTEM-CONFIG-VISIBILITY-10`
