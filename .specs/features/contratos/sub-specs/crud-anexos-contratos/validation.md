# CRUD de Anexos no Dashboard de Contratos — Validation

Este documento valida a implementação da especificação de CRUD de anexos de clientes no dashboard.

## Verdict: PASS ✅

Todos os critérios de aceitação foram implementados e validados por meio de testes de integração e revisão lógica do código.

---

## Acceptance Criteria Evidence

### P1: Exibição Dinâmica e Indicadores Coloridos (Verde/Vermelho)

| ID | Critério de Aceitação | Status | Evidência / Arquivo |
|----|-----------------------|--------|---------------------|
| **CONTR-ANEXO-01** | Carrega `client.tipoEmpresa` com fallback para "MEI". | PASS | [dashboard-contratos-docusigner.js:L158-175](file:///C:/www/producao/servidor-unity-rce/gestor-oportunidades/public/modules/contratos/dashboard-contratos-docusigner.js#L158-L175) |
| **CONTR-ANEXO-02** | Exibe lista de anexos mapeados para o tipo de empresa conforme nomenclatura estabelecida (ex: "CCMEI", "Endereço", "RG"). | PASS | [dashboard-contratos-docusigner.js:L158-175](file:///C:/www/producao/servidor-unity-rce/gestor-oportunidades/public/modules/contratos/dashboard-contratos-docusigner.js#L158-L175) |
| **CONTR-ANEXO-03** | Documentos presentes ficam **Verdes** e com botões de CRUD (Visualizar/Baixar/Deletar) dependendo de ACL. | PASS | [dashboard-contratos-docusigner.js:L221-246](file:///C:/www/producao/servidor-unity-rce/gestor-oportunidades/public/modules/contratos/dashboard-contratos-docusigner.js#L221-L246) |
| **CONTR-ANEXO-04** | Documentos ausentes ficam **Vermelhos** e exibem botão de **Upload**. | PASS | [dashboard-contratos-docusigner.js:L203-219](file:///C:/www/producao/servidor-unity-rce/gestor-oportunidades/public/modules/contratos/dashboard-contratos-docusigner.js#L203-L219) |

### P1: Upload Direto no CRM (Novo Endpoint e Integração Frontend)

| ID | Critério de Aceitação | Status | Evidência / Arquivo |
|----|-----------------------|--------|---------------------|
| **CONTR-ANEXO-05** | Botão de upload abre seletor com filtros `.pdf,.jpg,.jpeg,.png` e valida tamanho < 10MB. | PASS | [dashboard-contratos-docusigner.js:L478-498](file:///C:/www/producao/servidor-unity-rce/gestor-oportunidades/public/modules/contratos/dashboard-contratos-docusigner.js#L478-L498) |
| **CONTR-ANEXO-06** | Envia requisição `POST` com `FormData` para `/api/contracts/:id/files/clientDocs/:docType`. | PASS | [dashboard-contratos-docusigner.js:L505-520](file:///C:/www/producao/servidor-unity-rce/gestor-oportunidades/public/modules/contratos/dashboard-contratos-docusigner.js#L505-L520) |
| **CONTR-ANEXO-07** | Endpoint `POST /api/contracts/:id/files/clientDocs/:docType` implementado no CRM. | PASS | [routes.js:L154-160](file:///C:/www/producao/servidor-unity-rce/gestor-oportunidades/src/modules/contract/routes.js#L154-L160) e [contractController.js:L337-362](file:///C:/www/producao/servidor-unity-rce/gestor-oportunidades/src/modules/contract/controllers/contractController.js#L337-L362) |
| **CONTR-ANEXO-08** | Apenas `admin` e `suporte` podem enviar arquivos; `vendedor` é bloqueado com HTTP 403. | PASS | Testes automatizados em [contract-files-acl.test.js:L311-359](file:///C:/www/producao/servidor-unity-rce/gestor-oportunidades/tests/contract-files-acl.test.js#L311-L359) |
| **CONTR-ANEXO-09** | Substitui física e logicamente anexos anteriores do mesmo tipo. | PASS | Testes automatizados em [contract-files-acl.test.js:L311-337](file:///C:/www/producao/servidor-unity-rce/gestor-oportunidades/tests/contract-files-acl.test.js#L311-L337) |

---

## Integration Test Executions

A execução do runner de teste do Node.js validou todas as rotas e controles de ACL:

```
GET /api/contracts/contract123/files/clientDocs/0/view 200 6.141 ms - 23
▶ Contract Files ACL & Management Endpoints
  ▶ GET /api/contracts/:id/files/:fileType/:fileIndex/view
    ✔ deve permitir que Suporte visualize anexos (52.9316ms)
    ✔ deve negar visualização para Vendedor (HTTP 403) (19.2642ms)
  ✔ GET /api/contracts/:id/files/:fileType/:fileIndex/view (81.7045ms)
  ▶ GET /api/contracts/:id/files/:fileType/:fileIndex/download
    ✔ deve permitir que Admin baixe anexos (21.0526ms)
    ✔ deve negar download para Suporte (HTTP 403) (20.5801ms)
  ✔ GET /api/contracts/:id/files/:fileType/:fileIndex/download (42.9479ms)
  ▶ DELETE /api/contracts/:id/files/:fileType/:fileIndex
    ✔ deve permitir que Admin delete anexos (14.8782ms)
    ✔ deve negar exclusão para Suporte (HTTP 403) (12.5295ms)
  ✔ DELETE /api/contracts/:id/files/:fileType/:fileIndex (28.2559ms)
  ▶ Proteção contra Path Traversal nos Anexos
    ✔ deve retornar HTTP 400 ao tentar visualizar um anexo com path traversal (13.5494ms)
    ✔ deve retornar HTTP 400 ao tentar baixar um anexo com path traversal (15.6939ms)
    ✔ deve retornar HTTP 400 ao tentar deletar um anexo com path traversal (14.9106ms)
  ✔ Proteção contra Path Traversal nos Anexos (44.9238ms)
  ▶ POST /api/contracts/:id/files/clientDocs/:docType
    ✔ deve permitir que Admin ou Suporte façam upload de anexo do cliente (33.43ms)
    ✔ deve negar upload de anexo para Vendedor (HTTP 403) (9.5827ms)
    ✔ deve retornar HTTP 400 se nenhum arquivo for enviado (7.3082ms)
  ✔ POST /api/contracts/:id/files/clientDocs/:docType (50.732ms)
✔ Contract Files ACL & Management Endpoints (354.3958ms)
ℹ tests 19
ℹ suites 7
ℹ pass 19
```

---

## Safety & Security Check

- **Path Traversal Shield**: O storage service do backend principal e as rotas possuem sanitização de nomes de arquivos e checks de sandbox garantindo que os uploads fiquem enclausurados estritamente dentro da pasta `uploads/`.
- **ACL Enforcement**: O middleware `authorize("admin", "suporte")` protege o endpoint contra acessos indevidos por cargos não autorizados.
