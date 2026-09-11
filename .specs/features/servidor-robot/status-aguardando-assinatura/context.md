# Contexto e Decisões do Usuário — Status Aguardando Assinatura de [Nome]

## Resumo das Decisões do Usuário

1. **Campos no Banco de Dados (Schema)**:
   - Criar novos campos para armazenar o detalhe completo do status DocuSign e o nome de quem falta assinar (`pendingSigner: String`, `docusignStatusDetail: String`, `rawDocusignStatus: String`), mantendo o enum base de status canônico compatível (`status: "enviado"` ou novo status se aplicável).

2. **Formatos de Mensagem do DocuSign**:
   - O robô deve capturar e registrar com precisão mensagens como `"Aguardando ZE CEDENTE"`, `"Aguardando 2 outros"`, `"Aguardando terceiros"`, `"Anulado"`, etc.

3. **Status de Cancelamento/Anulação e Histórico**:
   - O rótulo em português do DocuSign é **"Anulado"** (não apenas "Cancelado").
   - O histórico e os detalhes do último status/signatário devem ser mantidos no documento mesmo após conclusão ou anulação para fins de auditoria.

4. **Tratamento e Normalização**:
   - Normalizar textos e limpar prefixos ("Aguardando", "Waiting for", "Needs to sign"), mantendo o valor bruto e o nome extraído.
   - Fallback resiliente: se a mensagem não for padronizada, capturar e registrar exatamente a informação textual presente no DocuSign.

5. **Notificação em Tempo Real (SSE)**:
   - Emitir eventos SSE (`robotEvents.emit("job:progress")`) informando o status detalhado e o signatário pendente para atualização instantânea na interface do CRM Funil.

6. **Apresentação Visual no CRM Funil**:
   - No card de contratos, exibir no badge o texto detalhado (ex: `AGUARDANDO ZE CEDENTE` ou `ANULADO`).
   - Nomes extensos (> 25 caracteres) devem ter truncamento com reticências e tooltip no hover.
   - Filtros de status no Dashboard do CRM devem suportar busca e filtragem por contratos aguardando assinatura.
