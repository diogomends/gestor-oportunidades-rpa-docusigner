Quase todas ficam em dois pontos: o módulo Docusign do backend e o proxy do Nginx pro projeto externo do robô.  
Rotas principais
Rota (prefixo) O que controla
/api/docusign/_ API DocuSign oficial (backend Node)
/api/system-config/robot-docusign Configurações salvas do robô (habilitar, modo, credenciais, agendamento)
/api/robot-docusign/_ Robô externo (porta 3111)
Endpoints-chave do robô

- GET /api/robot-docusign/config — lê config atual
- POST /api/robot-docusign/test-login — testa login
- POST /api/robot-docusign/trigger — dispara job
- GET /api/robot-docusign/status/{jobId} — status do job
- GET /api/robot-docusign/jobs/{jobId}/stream — SSE em tempo real
  Onde fica o painel de configuração
- Backend de persistência: GET/PUT /api/system-config/robot-docusign
- Frontend do painel: módulo em public/modules/config-sistema/robot-docusign/
  Ponto importante
  O Node não chama a porta 3111 direto. O Nginx é quem faz o proxy para o robô externo.
  Para efeito de exposição externa via Nginx, ficam assim:
  Conjunto de rotas Acessível externamente? Observação
  /api/docusign/portal/:hash (GET/upload/download) Sim públicas por design (link de assinatura)
  /api/docusign/webhook Sim callback público do DocuSign
  /api/system-config/robot-docusign Sim (Nginx encaminha) exigem auth + role admin no backend
  /api/robot-docusign/\*\* (config, trigger, status, stream, test-login) Sim (Nginx proxy direto) sem auth no Nginx — depende do que o serviço 3111 validate por conta própria
  Pontos de atenção
- /api/robot-docusign/\* está inteiramente aberto na borda; se o rpa_docusigner:3111 não exigir autenticação, qualquer origin externa pode atingir esses endpoints.
- /api/docusign/portal/:hash é público por convenção (link de assinatura), mas o hash atua como segredo.
- /api/docusign/webhook também é público, mas protegido por assinatura HMAC no controller.
