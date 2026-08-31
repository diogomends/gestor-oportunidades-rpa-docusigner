# Feature Specification: DocuSign Agreements Query RPA

## Problem Statement

O robô RPA DocuSigner precisa consultar o status de envelopes e acordos diretamente na interface web do DocuSign (`https://apps.docusign.com/send/documents?view=agreements&from={FROM}&to={TO}&pageSize=50`), filtrando pelo intervalo de 5 dias atrás até hoje. O robô deve identificar envelopes destinados a um representante específico (obtido a partir do `rep-nome` do Gestor de Oportunidades no campo `Para:` da listagem), extrair os status de cada recebedor (como `Concluído`, `Aguardando outros`, `Anulado`, `Falha na entrega`), navegar por todas as páginas da tabela até a última página (quando o botão de paginação estiver desabilitado) e alertar caso surja algum status novo não catalogado, preservando o texto original encontrado.

## Out of Scope

- Disparo de novas assinaturas ou modificação de envelopes existentes (escopo de envio/resend já implementado).
- Download em lote de PDFs nesta etapa de consulta (o fluxo apenas coleta metadados e status).
- Alteração no fluxo de autenticação DocuSign ou resolução de MFA via IMAP/Roundcube.

## Assumptions & Open Questions

| Assumption / Decision | Chosen default | Rationale |
| :--- | :--- | :--- |
| Formato de data na URL | `YYYY-MM-DD` com 5 dias de recuo dinâmico | Compatibilidade com o formato aceito pelo parâmetro `from` e `to` do DocuSign. |
| Comparação de nome do representante | Case-insensitive e tolerante a acentos/espaços | Evita falsos negativos devido a variações de digitação ou formatação do nome no DocuSign. |
| Tratamento de status desconhecido | Log de aviso + captura do texto literal | Permite registrar novos status da DocuSign sem quebrar o pipeline de dados. |
| Identificação do término de paginação | Detecção do atributo `disabled` no botão de próxima página | Segue o comportamento padrão do componente de paginação Web do DocuSign. |

## User Stories

### US-01: Consulta Paginada de Acordos por Período
As an automated RPA robot  
I want to navigate to DocuSign agreements view with a dynamic 5-day date range and pageSize=50  
So that I can retrieve all relevant envelopes efficiently across all available pages.

#### Acceptance Criteria
- **AC-01.1**: When the robot starts an agreements query, the system SHALL calculate `from` (current date minus 5 days) and `to` (current date) in `YYYY-MM-DD` format and navigate to the target DocuSign URL.
- **AC-01.2**: While the next page button is enabled (`button[data-qa="manage-envelopes-list.footer.pagination-pagination-next"]` without `disabled`), the robot SHALL click next and process subsequent rows until the button becomes disabled.

### US-02: Filtro por Representante e Extração de Status
As an integration service  
I want to identify envelopes addressed to a specific representative name and extract recipient statuses  
So that the Opportunity Manager (Gestor de Oportunidades) receives accurate agreement statuses.

#### Acceptance Criteria
- **AC-02.1**: When scanning rows in `[data-qa="manage-envelopes-list.table"]`, the robot SHALL inspect `[data-qa$="-mobile-from"]` and verify if it contains the representative name.
- **AC-02.2**: When a matching representative is found, the robot SHALL extract the envelope status from `[data-qa$="-status-status"]` (or fallback to `[data-qa$="-mobile-status"]`).
- **AC-02.3**: If the extracted status does not match known values (`Concluído`, `Aguardando outros`, `Aguardando`, `Anulado`, `Falha na entrega`), the system SHALL emit a warning alert and preserve the exact raw status text.

## Requirement Traceability

| Requirement ID | Description | Status |
| :--- | :--- | :--- |
| REQ-AGR-01 | Montagem de URL e parâmetros de data dinâmica (5 dias) | implemented |
| REQ-AGR-02 | Extração de linhas da tabela `manage-envelopes-list.table` e filtro por `Para:` | implemented |
| REQ-AGR-03 | Extração e normalização de status dos recebedores | implemented |
| REQ-AGR-04 | Navegação paginada contínua até o botão `pagination-next` desabilitado | implemented |
| REQ-AGR-05 | Detecção e alerta estruturado para status não mapeados | implemented |
