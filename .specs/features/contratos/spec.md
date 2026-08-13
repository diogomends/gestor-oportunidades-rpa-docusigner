# Módulo de Contratos — Specification

> **Nota de Arquitetura (AD-022)**: Esta especificação cobre o escopo funcional do **Módulo de Contratos** (`src/modules/contract/`) e do **Portal do Cliente**. A extração da API e envelopes DocuSign para um módulo/collection isolado é tratada separadamente na especificação [`modulo-docusign-extracao`](file:///C:/www/producao/servidor-unity-rce/gestor-oportunidades/.specs/features/modulo-docusign-extracao/spec.md).

## Problem Statement

O CRM Funil de Vendas não possui funcionalidade de gestão de contratos. O processo de geração de PDFs preenchidos, envio para assinatura digital DocuSign e coleta de documentos dos clientes é feito em uma ferramenta separada (docusigner). Isso obriga o operador a alternar entre sistemas e não há vínculo entre o contrato e a oportunidade no CRM. Precisamos trazer essa funcionalidade como módulo nativo do CRM, mantendo o portal público para upload de clientes em container isolado.

## Goals

- [ ] Operador do CRM acessa a tela de contratos (5 etapas) dentro do próprio CRM, autenticado via JWT
- [ ] Contrato gerado fica vinculado à Opportunity do CRM via referência simples (opportunityId)
- [ ] Cliente recebe link público para upload de documentos e download do contrato assinado
- [ ] Permissões por cargo respeitadas (admin/suporte = full, vendedor = só seus contratos)
- [ ] Tudo rodando no mesmo docker-compose com 3 containers (app_funil, client-server, nginx)

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Gestão de templates PDF | Templates são fixos (base64 no pdf_data.js); não há UI para editar |
| Assinatura eletrônica alternativa ao DocuSign | DocuSign é o único provedor; se mudar, será outro módulo |
| Notificações push/email transacional | Email de assinatura enviado exclusivamente pelo DocuSign (nativo) |
| App mobile | Apenas web responsivo |
| Faturamento/NF vinculado | Faturamento é processo separado pós-contrato |
| Injeção de Marca d'Água em Documentos | A injeção de marca d'água dinâmica em PDFs e imagens pertence ao novo módulo isolado `modulo-watermark` (`src/modules/watermark/`). |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Client-server manterá estrutura própria (Express + Multer + MongoDB) | Manter como está, apenas converter para ESM e ajustar rotas | Isolamento do portal público | y |
| Documentos do cliente salvos em volume compartilhado (./uploads) | Mesmo volume montado nos 2 containers | Client-server salva, app_funil pode consultar se necessário | y |
| Nginx fará proxy dos uploads (client_max_body_size) | 10MB por arquivo (mantido do client-server atual) | Consistência com o limite atual | y |
| Operador pode gerar contrato sem opportunityId (avulso) | Sim, opportunityId é opcional | Contratos podem ser criados antes da oportunidade no CRM | y |
| Vendedor vê apenas contratos onde o CNPJ corresponde a oportunidades da sua equipe | Filtro por CNPJ + equipe do vendedor logado | Impede que vendedor veja contratos de outras equipes | n |

**Open questions:** Nenhuma — resolvidas ou registradas como assumptions acima.

---

## User Stories

### P1: Módulo Backend de Contratos

**User Story**: Como operador do CRM, quero que as APIs de contrato estejam integradas ao backend do CRM com autenticação JWT para que eu possa gerenciar contratos sem sair do sistema.

**Why P1**: Base para todas as outras funcionalidades.

**Acceptance Criteria**:

1. WHEN um usuário autenticado (admin/suporte) faz POST `/api/integracao-docusigner` THEN o sistema SHALL criar um contrato com status "rascunho" e retornar 201
2. WHEN um usuário não autenticado faz qualquer requisição a `/api/integracao-docusigner` THEN o sistema SHALL retornar 401
3. WHEN um usuário com cargo "vendedor" faz GET `/api/integracao-docusigner` THEN o sistema SHALL retornar apenas contratos vinculados a oportunidades da equipe dele (pelo CNPJ)
4. WHEN um usuário admin/suporte faz GET `/api/integracao-docusigner` THEN o sistema SHALL retornar todos os contratos sem filtro
5. WHEN a requisição POST contém opportunityId THEN o sistema SHALL armazenar o ID sem validar existência na collection Opportunity

**Independent Test**: Autenticar como admin, criar contrato via POST, listar via GET, confirmar retorno 201 e contrato na lista.

---

### P1: Tela do Operador (5 Etapas)

**User Story**: Como operador do CRM, quero uma página de contratos acessível pelo sidebar do CRM para preencher dados do cliente, negociar, gerar PDFs e enviar para assinatura.

**Why P1**: Interface principal do operador para gestão de contratos.

**Acceptance Criteria**:

1. WHEN o usuário admin/suporte acessa /integracao-docusigner.html THEN o sistema SHALL exibir a tela de 5 etapas (Dados do Cliente → Negociação → Resumo → Assinatura → Pedidos)
2. WHEN o usuário vendedor acessa /integracao-docusigner.html THEN o sistema SHALL exibir apenas contratos vinculados às oportunidades dele
3. WHEN o usuário clica em "Salvar e Avançar" na etapa 1 THEN o sistema SHALL validar campos obrigatórios e avançar para etapa 2
4. WHEN o usuário clica em "Gerar Contratos" na etapa 3 THEN o sistema SHALL gerar os 3 PDFs (Termo, Proposta, Permanência) preenchidos com os dados do formulário
5. WHEN o usuário clica em "Enviar para DocuSign" na etapa 4 THEN o sistema SHALL enviar os PDFs como envelope e salvar o envelopeId
6. WHEN o contrato é enviado com sucesso THEN o sistema SHALL gerar um hash único de acesso para o cliente
7. WHEN o usuário seleciona a Etapa 3 (Resumo e Contratos) sem ter preenchido e validado as Etapas 1 (Dados do Cliente) e 2 (Negociação) THEN o sistema SHALL ocultar o conteúdo da Etapa 3 e exibir um card de alerta indicando que as Etapas 1 e 2 precisam ser preenchidas primeiro

**Independent Test**: Navegar pelas 5 etapas preenchendo dados, gerar PDFs, confirmar que os botões de avanço funcionam, que os dados persistem entre etapas e que a Etapa 3 permanece oculta com alerta se as Etapas 1 e 2 estiverem incompletas.

---

### P1: Portal do Cliente

**User Story**: Como cliente, quero receber um link seguro para fazer upload dos documentos solicitados e baixar o contrato assinado.

**Why P1**: Interface pública essencial para o fluxo de contratação.

**Acceptance Criteria**:

1. WHEN o cliente acessa /cliente/{cnpj}_{hash}_docs THEN o sistema SHALL exibir a página de upload com os documentos necessários para o tipo de empresa dele
2. WHEN o cliente faz upload de um arquivo PDF/JPG/PNG até 10MB THEN o sistema SHALL salvar o arquivo e marcar o documento como "Enviado"
3. WHEN o cliente tenta fazer upload de um arquivo > 10MB THEN o sistema SHALL rejeitar com erro 400
4. WHEN o cliente tenta upload de formato não permitido THEN o sistema SHALL rejeitar com erro 400
5. WHEN o contrato está com status "assinado" THEN o sistema SHALL exibir botão de download do contrato assinado
6. WHEN o cliente acessa um hash inválido/expirado THEN o sistema SHALL exibir mensagem "Link inválido ou expirado"

**Independent Test**: Gerar contrato no CRM, capturar hash, acessar URL pública, fazer upload de PDF, confirmar que aparece como "Enviado".

---

### P2: Permissões por Cargo

**User Story**: Como coordenador, quero ver apenas contratos da minha equipe para manter o foco nos resultados do meu time.

**Why P2**: Segurança e organização por hierarquia.

**Acceptance Criteria**:

1. WHEN um coordenador lista contratos THEN o sistema SHALL retornar apenas contratos de oportunidades da equipe dele
2. WHEN um supervisor lista contratos THEN o sistema SHALL retornar apenas contratos dos vendedores que ele supervisiona
3. WHEN um vendedor tenta baixar documentos enviados pelo cliente THEN o sistema SHALL negar (apenas admin/suporte podem)
4. WHEN um vendedor acessa a tela de contratos THEN o sistema SHALL exibir apenas contratos vinculados às oportunidades dele (ou onde o CNPJ bate com oportunidades que ele criou)

**Independent Test**: Criar contrato como admin, logar como vendedor de outra equipe, confirmar que o contrato não aparece na listagem.

---

### P2: Atualização de Status via Webhook

**User Story**: Como operador, quero que o status do contrato seja atualizado automaticamente quando o cliente assinar no DocuSign.

**Why P2**: Evita atualização manual e garante rastreabilidade.

**Acceptance Criteria**:

1. WHEN o DocuSign envia webhook de conclusão para POST `/api/docusign/webhook` THEN o sistema SHALL atualizar o status do contrato para "assinado"
2. WHEN o status é atualizado para "assinado" THEN o sistema SHALL salvar o path do documento assinado retornado pelo webhook
3. WHEN o webhook falha (timeout/erro) THEN o sistema SHALL registrar o erro em log e manter o status anterior

**Independent Test**: Simular webhook com payload de conclusão, confirmar que status do contrato mudou.

---

### P3: Histórico de Pedidos

**User Story**: Como operador, quero visualizar o histórico de contratos finalizados para consulta futura.

**Why P3**: Consulta, não essencial para o MVP.

**Acceptance Criteria**:

1. WHEN o usuário acessa a etapa "Pedidos Realizados" THEN o sistema SHALL exibir contratos com status "assinado" ou "cancelado"
2. WHEN o usuário clica em um contrato finalizado THEN o sistema SHALL exibir os detalhes e link para download

---

### UI-11: Indicativo Visual do Campo de E-mail

**User Story**: Como operador, quero saber no formulário qual e-mail será usado para enviar a documentação ao cliente via DocuSign, para evitar enviar para o endereço errado.

**Acceptance Criteria**:

1. WHEN o operador visualiza o campo "E-mail" do 1º Representante Legal na página "Dados do Cliente" THEN o sistema SHALL exibir o texto "usado para envio da documentação" junto ao label do campo
2. WHEN o operador acessa a etapa "Assinatura" (DocuSign) THEN o campo de e-mail do signatário principal SHALL exibir o mesmo valor preenchido no campo rep-email

**Independent Test**: Preencher o campo rep-email com "teste@exemplo.com", avançar até a etapa 4 de assinatura, confirmar que o campo ds-email exibe o mesmo valor.

---

### P3: Notificação ao Cliente

**User Story**: Como cliente, quero receber um email quando meu contrato estiver pronto para assinatura.

**Why P3**: Melhoria de experiência, o DocuSign já envia email de assinatura nativamente.

**Acceptance Criteria**:

1. WHEN o contrato é enviado para DocuSign com status `sent` THEN o DocuSign SHALL enviar o email de assinatura ao signatário com `emailSubject` e `emailBlurb` configurados no envelope
2. WHEN o signatário recebe o email THEN o sistema SHALL conter o link do portal do cliente no corpo (`emailBlurb`)
3. WHEN o contrato é assinado THEN o sistema SHALL atualizar o status via webhook (sem envio de email SMTP do CRM)

---

## Edge Cases

- WHEN o MongoDB cai durante a criação de um contrato THEN o sistema SHALL retornar 500 e não criar contrato parcial
- WHEN o upload do cliente é interrompido (rede) THEN o sistema SHALL notificar o cliente e permitir retentativa
- WHEN o mesmo cliente tenta enviar o mesmo documento 2x THEN o sistema SHALL substituir o arquivo anterior
- WHEN o envelope DocuSign expira sem assinatura THEN o sistema SHALL atualizar status para "expirado" (via webhook)
- WHEN o operador fecha o browser durante a geração de PDFs THEN o sistema SHALL não criar contrato (geração é no client-side)
- WHEN o hash de acesso é usado em requisição concorrente THEN o sistema SHALL processar cada requisição independentemente

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| CONT-01 | P1: Módulo Backend | Implementation | ✅ Verified |
| CONT-02 | P1: Módulo Backend | Implementation | ✅ Verified |
| CONT-03 | P1: Módulo Backend | Implementation | ✅ Verified |
| CONT-04 | P1: Módulo Backend | Implementation | ✅ Verified |
| CONT-05 | P1: Módulo Backend | Implementation | ✅ Verified |
| CONT-06 | P1: Módulo Backend - Novos campos Sócio | Implementation | ✅ Verified |
| UI-01 | P1: Tela do Operador | Implementation | ✅ Verified |
| UI-02 | P1: Tela do Operador | Implementation | ✅ Verified |
| UI-03 | P1: Tela do Operador | Implementation | ✅ Verified |
| UI-04 | P1: Tela do Operador | Implementation | ✅ Verified |
| UI-05 | P1: Tela do Operador | Implementation | ✅ Verified |
| UI-06 | P1: Tela do Operador | Implementation | ✅ Verified |
| UI-07 | P1: Tela do Operador - Campos Sócio | Implementation | ✅ Verified |
| UI-08 | P1: Tela do Operador - Tipo Contratação Select | Implementation | ✅ Verified |
| UI-09 | P1: Tela do Operador - Tipo Contratação Layout | Implementation | ✅ Verified |
| UI-10 | P1: Tela do Operador - Remoção Campos Negociação | Implementation | ✅ Verified |
| UI-11 | P1: Tela do Operador - Indicativo campo email | Implementation | ✅ Verified |
| PORTAL-01 | P1: Portal do Cliente | Implementation | ✅ Verified |
| PORTAL-02 | P1: Portal do Cliente | Implementation | ✅ Verified |
| PORTAL-03 | P1: Portal do Cliente | Implementation | ✅ Verified |
| PORTAL-04 | P1: Portal do Cliente | Implementation | ✅ Verified |
| PORTAL-05 | P1: Portal do Cliente | Implementation | ✅ Verified |
| PORTAL-06 | P1: Portal do Cliente | Implementation | ✅ Verified |
| AUTH-01 | P2: Permissões | Implementation | ✅ Verified |
| AUTH-02 | P2: Permissões | Implementation | ✅ Verified |
| AUTH-03 | P2: Permissões | Implementation | ✅ Verified |
| AUTH-04 | P2: Permissões | Implementation | ✅ Verified |
| WEBH-01 | P2: Webhook | Implementation | ✅ Verified |
| WEBH-02 | P2: Webhook | Implementation | ✅ Verified |
| WEBH-03 | P2: Webhook | Implementation | ✅ Verified |
| HIST-01 | P3: Histórico | Design | Pending |
| HIST-02 | P3: Histórico | Design | Pending |
| NOTIF-01 | P3: Notificação - E-mail de Assinatura | Implementation | ✅ DocuSign nativo |
| NOTIF-02 | P3: Notificação - Notificação ao Operador | Obsolete | ❌ Removido — email de contrato é exclusivo DocuSign |

**Coverage:** 34 total, 31 verified, 2 pending, 1 obsolete.

---

## Success Criteria

- [ ] Operador completa o fluxo de 5 etapas em < 5 minutos (gerando PDFs + enviando DocuSign)
- [ ] Cliente acessa link, faz upload de 3 documentos e conclui assinatura sem suporte manual
- [ ] Contrato criado no CRM reflete status em tempo real (webhook)
- [ ] Nenhuma regressão nas funcionalidades existentes do CRM (login, kanban, metas)
