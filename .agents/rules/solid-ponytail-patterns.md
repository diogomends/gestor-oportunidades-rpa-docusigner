---
trigger: always_on
---

# Diretrizes Arquiteturais: Padrão SOLID & PonyTail (Modular Steps)

Sempre que criar, refatorar ou manter serviços, rotinas RPA e fluxos sequenciais no projeto, aplique as seguintes diretrizes:

## 1. Single Responsibility Principle (SRP) & Modular Steps
- Isole cada etapa de fluxo ou automação em seu próprio arquivo (`services/steps/<name>Step.js`).
- Cada step exporta uma função assíncrona pura `execute<Name>Step(context)` recebendo apenas os parâmetros/contexto necessários (`page`, `selectors`, `data`, `log`).
- Mantenha o orquestrador apenas como compositor da pipeline de execução.

## 2. Anti-Phantom Success (Hardening Obrigatório)
- **Nunca presuma sucesso por omissão de erro**: uma etapa só é bem-sucedida se o estado final for verificado explicitamente (seletor de confirmação visível, URL esperada, retorno de dados válidos e não-nulos).
- Lance erros com contexto claro (`stepUtils.createStepError` ou mensagens informativas) quando a validação pós-ação falhar.
- Capture falhas no step e marque o job/fluxo com erro real em vez de mascarar status.

## 3. PonyTail & Simplicidade (Anti-Sobre-engenharia)
- Prefira funções assíncronas simples e exportação direta a padrões de classes abstratas ou factories complexas.
- Centralize lógica repetitiva (polling, retry exponencial, digitação segura, clique com fallback) em utilitários focados (`stepUtils.js`).
- Use cache baseado em metadata simples (ex: `mtime` de arquivos) em vez de bibliotecas pesadas quando a necessidade for pontual.

## 4. Desacoplamento de Serviços (DIP / Clean Boundaries)
- Serviços de regras de negócio e persistência (ex: `agreementsService`, `gestorApiClient`) não devem conter dependências diretas de automação de navegador (DOM/Playwright).
- O navegador executa ações e extrai dados brutos; os serviços de domínio processam, validam e persistem os dados.
