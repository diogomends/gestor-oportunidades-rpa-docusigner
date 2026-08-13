# Spec: Bordas Completas em Quadros Divididos por Quebra de Página (Termo PDF)

## Visão Geral
Quando uma seção ou quadro (box) no template HTML do Termo de Contratação (`termoTemplate.html`) for cortado devido ao limite de altura da página no PDF, todos os fragmentos resultantes da divisão em ambas as páginas devem possuir todas as bordas (superior, inferior, esquerda e direita) renderizadas completamente.
Além disso, o container final `.cliente-declara` deve ser configurado para evitar microestouro de margem inferior na área imprimível A4, prevenindo a duplicação indesejada da borda no rodapé do documento sem remover as propriedades de clonagem de bordas.

## Requisitos Rastreáveis

### REQ-001: Bordas Completas em Fragmentos Cortados por Quebra de Página
Qualquer bloco/quadro (`.section`, `.clausulas-box`, `.assinaturas-section`, `.cliente-declara`) dividido por uma quebra de página deve manter o contorno de bordas completo (4 lados: superior, inferior, esquerda e direita) no fragmento da página anterior e no fragmento da página seguinte.

### REQ-002: Aplicação de CSS `box-decoration-break: clone`
Inclusão das propriedades CSS `-webkit-box-decoration-break: clone;` e `box-decoration-break: clone;` nas seleções de classe de quadros e seções em `termoTemplate.html`.

### REQ-003: Preservação de Escopo e Retrocompatibilidade
- **Escopo Estrito:** Alterações restritas aos arquivos do gerador de PDF HTML do Termo (`termoTemplate.html` e `termoService.js`).
- **Intocados:** `proposta`, `permanencia`, contratos de API e demais componentes da aplicação.

### REQ-004: Prevenção de Microestouro e Borda Duplicada Fantasma no Rodapé
1. O elemento container final `.cliente-declara` deve possuir `margin-bottom: 0;` e `overflow: hidden;` para evitar que a margem do elemento ou de seus parágrafos filhos empurre o rodapé da página gerando fragmentos de 0px com bordas duplicadas sob a instrução `-webkit-box-decoration-break: clone;`.
2. A chamada do renderizador de PDF em `termoService.js` deve explicitar `margin: { top: "37mm", bottom: "10mm" }`, alinhando as opções do Playwright à regra CSS `@page`.

## Critérios de Aceitação
1. `termoTemplate.html` possui `-webkit-box-decoration-break: clone` e `box-decoration-break: clone` aplicados aos elementos `.section`, `.clausulas-box`, `.assinaturas-section` e `.cliente-declara`.
2. O container `.cliente-declara` possui `margin-bottom: 0;` e `overflow: hidden;`, com `.cliente-declara p:last-child` e `.declara-item:last-child` possuindo `margin-bottom: 0;`.
3. `termoService.js` especifica a margem inferior de `10mm` na renderização do Playwright (`margin: { top: "37mm", bottom: "10mm" }`).
4. Em quadros divididos entre páginas, cada fragmento exibe todas as 4 bordas (superior, inferior, esquerda e direita), sem ocorrência de linha/borda dupla fantasma no final da última página.
5. A geração de PDF via Playwright (`make test-pdf-html-generation`) executa com sucesso sem regressões estruturais.
