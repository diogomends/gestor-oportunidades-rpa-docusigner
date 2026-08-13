# Módulo Watermark — Especificação Funcional

## Problem Statement
Documentos contratuais e anexos de oportunidades contêm informações confidenciais de clientes e negociações. O compartilhamento indevido ou vazamento de capturas de tela e PDFs baixados por usuários internos representa um risco de segurança e conformidade.

Para mitigar esse risco, o sistema exige uma solução de rastreabilidade visual dinâmica que aplique marca d'água (contendo Nome do Usuário, Email/CPF e Timestamp) em tempo de execução nos arquivos PDF e imagens durante a visualização ou download no CRM. Além disso, o controle dessa funcionalidade deve ser centralizado no painel de configurações do sistema (`watermark_enabled`), permitindo que administradores ativem ou desativem a injeção globalmente de forma instantânea.

---

## Goals
- Encapsular a lógica de marca d'água em um módulo desacoplado e coeso sob `src/modules/watermark/`.
- Fornecer o serviço centralizado `WatermarkService` com métodos para injeção de carimbo visual em arquivos PDF (`pdf-lib`) e imagens (`sharp`).
- Integrar a execução do serviço à flag global `ui_visibility.watermark_enabled` mantida pelo `SystemConfig`.
- Garantir comportamento *fail-safe*: se a flag estiver desativada (`false`) ou se o arquivo não for suportado/estiver corrompido, o serviço deve retornar o buffer original sem interromper a exibição do documento.
- Oferecer alta performance processando arquivos em memória (Buffer) sem criar arquivos temporários em disco.

---

## Out of Scope
- Alteração permanente dos arquivos originais armazenados no sistema de arquivos do servidor.
- Injeção de marca d me d'água em visualizações feitas por clientes externos no Portal do Cliente público (`/cliente/`).
- Suporte a marca d'água em arquivos de formatos editáveis (.docx, .xlsx, .zip).

---

## Requisitos e Critérios de Aceitação (Acceptance Criteria)

### Arquitetura e Estrutura Modular
- `WATERMARK-01`: O módulo de marca d'água deve residir exclusivamente no diretório `src/modules/watermark/` e expor a classe/serviço `WatermarkService` em `services/watermarkService.js`.
- `WATERMARK-02`: As demais áreas do sistema (módulo de contratos, módulo de oportunidades, rotas de anexos) devem obrigatoriamente importar o `WatermarkService` a partir de `src/modules/watermark/services/watermarkService.js`.

### Integração com Configuração do Sistema
- `WATERMARK-03`: Antes de processar qualquer buffer de documento, o `WatermarkService` deve consultar a configuração de visibilidade `ui_visibility.watermark_enabled` no `SystemConfig`.
- `WATERMARK-04`: Quando `watermark_enabled` for `false`, o `WatermarkService` deve imediatamente retornar o buffer original intacto, ignorando qualquer processamento pesado de CPU.

### Processamento de PDF
- `WATERMARK-05`: Para arquivos com MIME type `application/pdf`, o `WatermarkService` deve utilizar a biblioteca `pdf-lib` para carimbar todas as páginas do documento.
- `WATERMARK-06`: O texto da marca d'água em PDFs deve conter o Nome do Usuário autenticado, Email ou CPF, e a Data/Hora atual formatada na timezone `America/Sao_Paulo`.
- `WATERMARK-07`: O texto do carimbo visual em PDF deve ser renderizado em ângulo diagonal (~45 graus) com opacidade reduzida (~0.25 - 0.3) para garantir legibilidade do conteúdo subjacente.

### Processamento de Imagens
- `WATERMARK-08`: Para arquivos de imagem (`image/jpeg`, `image/png`, `image/webp`), o `WatermarkService` deve utilizar a biblioteca `sharp` para sobrepor uma camada SVG contendo o texto formatado do usuário.
- `WATERMARK-09`: O overlay de imagem deve ser dimensionado proporcionalmente às dimensões do arquivo original.

### Resiliência e Fallback (Fail-Safe)
- `WATERMARK-10`: Se o processamento de marca d'água falhar (ex: PDF criptografado/protegido por senha ou imagem corrompida), o `WatermarkService` deve capturar a exceção, registrar um log de aviso (`logger.warn`) e retornar o buffer original sem lançar erro `500`.

---

## Traceabilidade de Requisitos

| Requirement ID | Categoria | Descrição | Status |
| -------------- | --------- | --------- | ------ |
| `WATERMARK-01` | Arquitetura | Estrutura modular em `src/modules/watermark/` | ✅ PASS |
| `WATERMARK-02` | Integração | Centralização de importações no novo módulo | ✅ PASS |
| `WATERMARK-03` | Configuração | Consulta da flag `watermark_enabled` | ✅ PASS |
| `WATERMARK-04` | Performance | Bypass instantâneo quando `watermark_enabled === false` | ✅ PASS |
| `WATERMARK-05` | PDF Engine | Processamento de PDF via `pdf-lib` | ✅ PASS |
| `WATERMARK-06` | Dados | Injeção de Nome, Email/CPF e Timestamp | ✅ PASS |
| `WATERMARK-07` | Estética | Transparência e rotação diagonal em PDF | ✅ PASS |
| `WATERMARK-08` | Image Engine | Processamento de Imagem via `sharp` | ✅ PASS |
| `WATERMARK-09` | Estética | Overlay proporcional em Imagens | ✅ PASS |
| `WATERMARK-10` | Resiliência | Fallback seguro para o buffer original | ✅ PASS |
