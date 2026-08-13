# Lista de Tarefas (Tasks) - Integração DocuSigner

Este documento contém a divisão em tarefas atômicas de desenvolvimento para a implementação da Integração DocuSigner. Cada tarefa inclui critérios claros de aceitação e de verificação.

## Fase 1: Infraestrutura e Configuração (Docker & Nginx)

### T-01: Atualização do Docker Compose para 3 Containers (AD-001)
- [x] **Descrição**: Configurar o container `client-server` (portal público) e o volume compartilhado `/uploads` nos ambientes dev e prod.
- [x] **Critérios de Aceitação**:
  - `docker-compose.yml` e `docker-compose.prod.yml` atualizados.
  - Pasta `./uploads` compartilhada entre `app_funil` e `client-server`.
- [x] **Verificação**: `docker compose config` passa sem erros e ambos os containers sobem simultaneamente.

### T-02: Configuração de Roteamento Nginx (AD-006)
- [x] **Descrição**: Adicionar regras de roteamento no arquivo `default.conf` do Nginx para mapear `/cliente/` e `/api/client/` ao container `client-server`.
- [x] **Critérios de Aceitação**:
  - Nginx configurado com limite `client_max_body_size 10M` para a rota de upload.
- [x] **Verificação**: Acessar `http://localhost:9000/cliente/` redireciona requisições para o `client-server`.

---

## Fase 2: Banco de Dados e Modelos (Mongoose)

### T-03: Implementação do Schema de Contratos (AD-002)
- [x] **Descrição**: Criar o schema e modelo Mongoose para `Contract` conectando-se ao banco `crm_contracts`.
- [x] **Critérios de Aceitação**:
  - Schema definido de acordo com o `design.md`.
  - Importado e registrado em `server.js` na inicialização.
- [x] **Verificação**: Conexão com o banco secundário `crm_contracts` estabelecida com sucesso no log de startup.

---

## Fase 3: APIs do Backend CRM (`app_funil`)

### T-04: API CRUD de Contratos com ACL (AD-004)
- [x] **Descrição**: Criar endpoints GET, POST, PUT, DELETE sob `/api/integracao-docusigner` no CRM.
- [x] **Critérios de Aceitação**:
  - Validação de payload usando Zod.
  - Implementação de regras ACL por cargo (vendedor vê apenas seus contratos correspondentes ao CNPJ de suas oportunidades).
- [x] **Verificação**: Executar testes locais com diferentes tokens JWT (admin vs vendedor) e certificar HTTP 403 para acessos não autorizados.

### T-05: Integração com a API DocuSign (Envio de Envelopes)
- [x] **Descrição**: Implementar envio de documentos em PDF para assinatura usando o token JWT Grant ou SDK da DocuSign.
- [x] **Critérios de Aceitação**:
  - Geração dos PDFs dinâmicos com `pdfkit`.
  - Envio do envelope e retorno do `envelopeId`.
- [x] **Verificação**: Mockar chamadas DocuSign e rodar testes de envio validando o fluxo de dados.

### T-06: Webhook do DocuSign
- [x] **Descrição**: Rota `/api/docusign/webhook` para atualizar o status do contrato para `signed`, `expired` ou `cancelled`.
- [x] **Critérios de Aceitação**:
  - Rota pública com validação de payload do DocuSign.
  - Download automático do documento final assinado ao receber o status `completed`.
- [x] **Verificação**: Enviar payload mockado para o webhook e confirmar mudança de status no banco.

---

## Fase 4: Portal do Cliente (`client-server`)

### T-07: API Pública do Cliente (Upload e Downloads)
- [x] **Descrição**: APIs para obter status do contrato via hash, fazer upload de documentos e fazer download do assinado.
- [x] **Critérios de Aceitação**:
  - Verificação de hash de acesso seguro.
  - Limite de 10MB por arquivo (Multer).
- [x] **Verificação**: Tentar enviar arquivos maiores de 10MB e verificar retorno HTTP 400.

### T-08: Interface Pública do Cliente (Frontend)
- [x] **Descrição**: Interface web responsiva em HTML/CSS/JS para o cliente visualizar a lista de documentos necessários, fazer o upload e fazer o download do contrato assinado.
- [x] **Critérios de Aceitação**:
  - Sem placeholders.
  - UX premium e fluida com mensagens claras de sucesso/erro.
- [x] **Verificação**: Validar visualização em diferentes tamanhos de tela.

---

## Fase 5: Frontend do Operador CRM

### T-09: Tela de Contratos 5 Etapas no CRM
- [x] **Descrição**: Interface `/integracao-docusigner.html` integrada ao sidebar do CRM contendo o wizard de 5 etapas para preenchimento de dados e envio.
- [x] **Critérios de Aceitação**:
  - Uso de Vanilla JS (`addEventListener` em módulos ES6).
  - Validações antes de passar para a próxima etapa.
- [x] **Verificação**: Testar fluxo completo do operador gerando contrato fictício.

---

## Fase 6: Hardening e Correções de Segurança

### T-10: Tratar CastError nos controllers de contrato (Média)
- [x] **Descrição**: Nenhum controller trata `mongoose.Error.CastError` para ObjectId malformado nos parâmetros de rota. Isso faz a API retornar 500 em vez de 400 quando um ID inválido é passado.
- [x] **Critérios de Aceitação**:
  - `getContractById`, `updateContract` e `deleteContract` em `contractController.js` capturam `CastError` e retornam HTTP 400 com mensagem "ID de contrato inválido".
  - `sendContractToDocuSign`, `getEnvelopeStatus`, `getSigningUrl` e `downloadSignedDocuments` em `docusignController.js` capturam `CastError` e retornam HTTP 400.
- [x] **Verificação**: Chamar cada endpoint com `:id` = "abc" (ObjectId inválido) e confirmar retorno HTTP 400 em vez de 500.

### T-11: Sanitizar caminho de arquivos do cliente contra path traversal (Média)
- [x] **Descrição**: Em `client-server/server.js`, os campos `clientDocs.filePath` e `docusign.signedDocPath` vindos do banco são usados in `path.resolve()` sem sanitização, permitindo path traversal se o dado for adulterado.
- [x] **Critérios de Aceitação**:
  - `path.resolve()` em `/download/:hash/docusign` (linha 222) valida que o resolved path está dentro de `UPLOADS_BASE`.
  - `path.resolve()` em `/upload/:hash` (linha 178) valida que o resolved path está dentro de `UPLOADS_BASE`.
  - Paths com `..` que escapam de `UPLOADS_BASE` retornam HTTP 400.
- [x] **Verificação**: Testar com hash válido e `signedDocPath` contendo `../../etc/passwd` no banco — servidor retorna 400 sem ler arquivo fora do diretório.

### T-12: Tornar verificação HMAC do webhook obrigatória (Média)
- [x] **Descrição**: Em `docusignController.js`, se a env var `DOCUSIGN_HMAC_KEY` não estiver configurada, `verifyWebhookSignature` retorna `false` em vez de `true`, bloqueando webhooks não assinados.
- [x] **Critérios de Aceitação**:
  - Se `DOCUSIGN_HMAC_KEY` não estiver definida, `verifyWebhookSignature` retorna `false`.
  - Webhook sem HMAC configurado retorna HTTP 401.
- [x] **Verificação**: Remover `DOCUSIGN_HMAC_KEY` do ambiente, enviar webhook mockado sem cabeçalho de assinatura e confirmar retorno HTTP 401.

---

## Fase 7: Funcionalidades P3 (Pós-MVP)

### T-13: Implementar histórico de pedidos (P3)
- [x] **Descrição**: Implementar a funcionalidade da página "Pedidos Realizados" (HIST-01, HIST-02) exibindo contratos com status "assinado" ou "cancelado", com detalhes e link para download. Adicionar método `getContracts` no `ApiClient` (api.js) e lógica de carregamento ao navegar para `page-pedidos` em contratos.js.
- [x] **Critérios de Aceitação**:
  - `window.api.getContracts(filter)` busca contratos do backend com suporte a filtro por status.
  - Ao navegar para `page-pedidos`, a UI carrega e exibe a lista de contratos finalizados.
  - Cada item exibe: cliente, CNPJ, data, status formatado.
  - Ao clicar em um contrato, exibe detalhes (signatário, documentos, datas) e botão de download do PDF assinado.
  - Role-based ACL respeitada (vendedor vê só seus contratos).
- [x] **Verificação**: Criar contratos com status "assinado" e "cancelado" via webhook, navegar até "Pedidos Realizados" e confirmar listagem, clique e download.

### T-14: Implementar notificação ao cliente e operador (P3)
- [x] **Descrição**: Finalizar a notificação de upload completo (`NOTIF-02`). O envio do e-mail do link ao cliente (`NOTIF-01`) e do e-mail de assinatura concluída ao operador já foram implementados e verificados. Resta implementar o alerta ao operador quando todos os documentos obrigatórios forem carregados pelo cliente.
- [x] **Critérios de Aceitação (Já Implementados - NOTIF-01)**:
  - `sendContractToDocuSign` envia email ao cliente com link do portal (`DOCUSIGN_EMAIL_LINK_BASE_URL`) após criação do envelope.
  - Webhook `completed` envia e-mail ao operador (`createdBy`) informando que os documentos foram assinados.
- [x] **NOTIF-02 cancelado (Obsolete)**: A spec marcou `NOTIF-02` como Obsolete — email de contrato é exclusivo DocuSign (ver `.specs/features/contratos/spec.md`). Os critérios abaixo (rota `POST /api/contracts/internal/notify-docs-received`, status `documentos_completos`, AuditLog e e-mail ao vendedor) **não foram implementados** e não serão, por decisão de arquitetura.
- [x] **Verificação**: N/A — critérios de NOTIF-02 removidos do escopo; sem implementação necessária.

---

## Fase 8: Ajustes de UI e Alinhamento com Spec

### T-15: Corrigir stepper para exibir 5 círculos (Mínima)
- [x] **Descrição**: O wizard de contratos tem 5 páginas (page-cliente, page-negociacao, page-resumo, page-docusign, page-pedidos), mas `ui.js:7` define `stepPages` com apenas 4 entradas, e o HTML stepper só renderiza 4 círculos. A página "Pedidos" fica sem representação visual no stepper.
- [x] **Critérios de Aceitação**:
  - O array `stepPages` em `ui.js` includes `'page-pedidos'` como 5º elemento.
  - O HTML stepper tem um 5º círculo com conector para "Pedidos".
  - `navigation.js` (`updateStepper`) processa corretamente 5 steps sem quebrar.
- [x] **Verificação**: Navegar até a etapa "Pedidos" e confirmar que o 5º círculo aparece ativo no stepper.

### T-16: Alinhar mensagem de hash inválido com a spec (Mínima)
- [x] **Descrição**: A spec PORTAL-06 especifica que hash inválido/expirado deve retornar `"Link inválido ou expirado"`. Atualmente `client-server/server.js:118` retorna `"Contrato não encontrado"` ao não encontrar o contrato pelo hash.
- [x] **Critérios de Aceitação**:
  - A mensagem de erro em `server.js:118` muda de `'Contrato não encontrado'` para `'Link inválido ou expirado'`.
  - O código HTTP 404 permanece inalterado.
- [x] **Verificação**: Fazer GET `/contract/:hash` com hash inexistente e verificar `response.data.error === 'Link inválido ou expirado'`.
