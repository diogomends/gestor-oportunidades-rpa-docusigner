# Espec de Ajuste de Espaçamento e Quebra de Página — Termo de Contratação PDF

## Contexto & Escopo
Ajustar o layout e a estrutura HTML/CSS do PDF do Termo de Contratação para eliminar a lacuna vertical em branco no final da primeira página entre a Seção 2 (Dados da Contratação) e a Seção 3 (Assinaturas).

## Requisitos

- **REQ-001 (Remoção de Duplicação)**: A string `signaturesHtml` em `termoService.js` não deve conter as 14 cláusulas do "O Cliente declara que:". As cláusulas devem ser mantidas unicamente na div `.cliente-declara` (`clausesHtml`).
- **REQ-002 (Redução de Espaçamentos em termoService.js)**: Reduzir `padding-top: 40px` da linha "Aparelho/Chip:" para `10px` e eliminar a margem extra da tag `<p style="margin-top:20px;">Observação:</p>`.
- **REQ-003 (Redução de Espaçamentos em termoTemplate.html)**: Reduzir a margem de `.valor-total-title` (`margin-top: 40px` → `10px`) e da tabela secundária da Seção 2 (`margin-top: 30px` → `10px`).
- **REQ-004 (Flexibilização de Quebra na Seção 3)**: Atualizar a classe `.assinaturas-section` em `termoTemplate.html` removendo `page-break-inside: avoid` do contêiner geral e aplicando `page-break-inside: avoid` individualmente na classe `.sig-block`.

## Critérios de Aceite
1. O PDF gerado pelo comando `make test-pdf-html-generation` não deve apresentar salto de página artificial no meio da primeira página.
2. A Seção 3 (Assinaturas) deve iniciar na primeira página quando houver espaço útil vertical disponível.
3. Nenhum bloco individual de assinatura (`.sig-block`) deve ser cortado horizontalmente ao meio no caso de quebra de página.
4. As 14 cláusulas contratuais não devem aparecer duplicadas no documento final.
