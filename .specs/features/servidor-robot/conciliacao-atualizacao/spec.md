# Cruzamento e Atualizacao no Banco — Match, Status Irreversivel, Download e SSE

## Problem Statement
Cruzar envelopes obtidos na DocuSign com contratos ativos no MongoDB e atualizar Contract uma unica vez para status irreversiveis, baixando PDF quando concluido.

## Requisitos

### REQ-CRUZ-01 — Busca de contratos ativos
- Buscar `Contract` com `status in [enviado, gerado]` (ou elegivel por contractEligibility) e `envelopeId` ou email/nome representando.
- Query via `getContractsConnection()` no database `crm_contracts`.

### REQ-CRUZ-02 — Cruzamento
- Match primario por `envelopeId` (UUID da linha); fallback por `email`/`nome` do representante (case-insensitive, trim, sem acento).
- Ignorar `envelopeId:null` (AD-042 fix).

### REQ-CRUZ-03 — Atualizacao irreversivel
- Atualizar `Contract.status` uma unica vez para finais (assinado/recusado); nao rebaixar. `envelopeId` e `docusign_envelope_id` persistidos (AD-048 schema strict).
- Mapeamento `mapEnvelopeStatusToContractStatus` retorna null para desconhecido/vazio/draft (AD-046 anti-phantom) — nao forcar `enviado`.

### REQ-CRUZ-04 — Download e SSE
- Quando status muda para concluido/assinado, baixar PDF via `downloadStep` para `uploads/{cnpj}_{razao}/contrato_assinado_{envelopeId}.pdf`, validar `stat.size>0` (AD-049), atualizar `RobotJob.signedDocPath`.
- Emitir evento SSE via `GET /jobs/:jobId/stream` (job-async-sse).

## Criterios (EARS)
- WHEN envelopes coletados THEN SHALL buscar contratos ativos enviado|gerado.
- WHEN match por envelopeId ou email THEN SHALL cruzar e atualizar status uma vez.
- WHEN status desconhecido/draft THEN SHALL retornar null e nao alterar Contract (AD-046).
- WHEN status -> concluido THEN SHALL baixar PDF e emitir SSE.

## Trace
AD-041 parte 2, AD-046, AD-048, AD-049, statusSyncScheduler.js syncContractStatus.
