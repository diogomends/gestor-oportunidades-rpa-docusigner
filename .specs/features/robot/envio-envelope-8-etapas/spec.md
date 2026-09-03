# Feature Spec: Envio de Envelope DocuSign em 8 Etapas & Modularização de Steps

## 1. Visão Geral
Implementar o pipeline sequencial de 8 etapas para o envio de contratos na interface web DocuSign (`https://apps.docusign.com/send/prepare/`), modularizando o robô standalone em steps atômicos (`robot/src/browser/steps/`) e provendo suporte a múltiplos destinatários com identificadores dinâmicos, deduplicação de signatários e captura resiliente de `envelopeId`.

---

## 2. Requisitos (EARS)

- **REQ-001 (Upload)**: Quando o robô iniciar o envio de um contrato, ele DEVE navegar para `https://apps.docusign.com/send/prepare/` e anexar o arquivo PDF via `input[type='file']`.
- **REQ-002 (Múltiplos Destinatários & Checkbox)**: Quando houver um ou mais destinatários, o robô DEVE preencher `nome` e `email` sequencialmente usando indexação posicional ordinal (`.nth(i)`), verificar o checkbox de entrega (`delivery-email`) marcando-o se desmarcado, e clicar em `button[data-qa='recipients-add']` para cada destinatário adicional.
- **REQ-003 (Deduplicação de Signatários)**: Quando o responsável pela portabilidade possuir o mesmo nome/e-mail do representante legal ou já constar na lista de destinatários, o sistema DEVE adicioná-lo apenas uma vez.
- **REQ-004 (Avançar)**: Quando os destinatários forem preenchidos e validados, o robô DEVE clicar em `button[data-qa='footer-add-fields-link-correct']` ("Avançar").
- **REQ-005 (Enviar e Confirmação Sem Campos)**: Quando a tela de envio for carregada, o robô DEVE clicar em `button[data-qa='footer-send-button']` ("Enviar") e monitorar ativamente por até 15 segundos o botão `button[data-qa='send-without-fields']` ("Enviar sem campos"), clicando imediatamente assim que visível.
- **REQ-006 (Captura de Envelope ID)**: Quando o envio for concluído, o robô DEVE tentar capturar o `envelopeId` via URL pós-redirecionamento, primeira linha da listagem de documentos ou fallback do job.
- **REQ-007 (Payload Backend)**: O endpoint `GET /instance/next-job` DEVE entregar a lista `recipients: [{ name, email, role }]` montada a partir do representante legal e linhas de portabilidade válidas.
