---
trigger: model_decision
description: QUANDO SOLICITADO PARA COMENTAR,FAZER COMMIT, OU SE USAR PALAVRAS COMO COMMIT, PR,MERGE
---

# Regra de Commit, PR e Merge

- **Gerar texto, nunca executar**: Ao receber qualquer pedido de "commit", "push", "PR" ou "merge", NUNCA execute os comandos. Apenas gere o texto dos comandos (git add, commit, gh pr create, gh pr merge) pronto para o usuário copiar e executar.
- **Somente o que foi conversado**: O commit deve incluir exclusivamente os arquivos/mudanças que se referem à conversa atual. Nada além disso (nada de `git add .` cego, nem arquivos não relacionados).
- **`git add` individual por linha (sem quebra de linha)**: Cada arquivo ou diretório afetado deve ter obrigatoriamente seu próprio comando `git add <arquivo>` em uma linha dedicada. É estritamente PROIBIDO listar múltiplos arquivos em um único comando `git add` com quebras de linha (`\`, indentações ou wraps), pois isso quebra o parser do PowerShell. NÃO utilize `&&`.
- **Branch nova**: Antes de commitar, gerar o comando para criar uma nova branch (`git checkout -b <nome-descritivo>`) quando ainda não estiver em uma branch de trabalho dedicada.
- **Fluxo PR/Merge**: Sempre usar `gh` para o fluxo completo: criar branch, push, `gh pr create`, e depois `gh pr merge`.
  - **Sintaxe PowerShell para `gh pr create`**: Evite aspas duplas internas que quebram o parser do PowerShell. Use aspas simples nas descrições (ex: `--body "Remove o rowspan='2'..."`) ou use a flag `--fill`.
  - **Sintaxe para `gh pr merge`**: Use flags válidas da CLI `gh` como `gh pr merge --merge --delete-branch`.
- **Acompanhar CI**: Após `git push` e/ou `gh pr merge`, sempre incluir `gh run watch $(gh run list -L 1 --json databaseId -q '.[0].databaseId')` para acompanhar o workflow até conclusão.
- **SEMPRE usar `--no-verify`**: Gerar ou executar comandos de `git commit` e `git push` com `--no-verify` (não usar `-n`, pois em `git push` a flag `-n` significa `--dry-run`). Além disso, NUNCA passe `-n`/`--no-verify` para comandos `gh` (`gh pr create`/`gh pr merge`), pois a flag não existe na CLI do GitHub. Hooks e verificações devem rodar normalmente.

## Checklist Pré-Commit .specs/

Antes de gerar os comandos `git add`, verificar se os seguintes arquivos foram atualizados na sessão atual. Se SIM, incluir no commit:

- [ ] `tasks.md` — tarefa marcada como Done
- [ ] `spec.md` — rastreabilidade de requisitos atualizada
- [ ] `validation.md` — relatório de validação criado/atualizado
- [ ] `STATE.md` — Handoff ou Changelog atualizado
- [ ] Arquivos `.specs/` relevantes incluídos nos comandos `git add` (um `git add` por arquivo, em linha única)
- [ ] `README.md` — documentação do projeto atualizada (se houve mudanças na estrutura, comandos, variáveis ou fluxos)
- [ ] `AGENTS.md` — guia do agente atualizado (se houve mudanças em comandos, convenções, arquitetura ou rotas)

## Modelo de Comando (segue exatamente este fluxo)

```
git add <arquivo1>
git add <arquivo2>
git commit -m "<tipo>(<escopo>): <descricao curta>" --no-verify
git push origin <nome-da-branch> --no-verify
gh pr create --title "<tipo>(<escopo>): <titulo>" --body "<descricao detalhada>"
gh pr merge --merge --delete-branch
gh run watch $(gh run list -L 1 --json databaseId -q '.[0].databaseId')
```

- `git add` lista explicitamente apenas os arquivos da conversa (código, testes e `.specs/` relacionados) com um prefixo `git add` em cada linha individual sem quebras de linha/wraps, e nunca `git add .`.
- `--no-verify` vai em `git commit` e `git push`, mas NUNCA em `gh pr create`/`gh pr merge`.
- Exemplo real:
```
git add public/modules/contratos/services/cepService.js
git add .specs/features/modulo-gestor-tokens/sub-specs/cep-token-trigger/
git commit -m "fix(contratos): trigger change event on UF auto-select via CEP" --no-verify
git push origin fix/contratos-cep-token-trigger --no-verify
gh pr create --title "..." --body "..."
gh pr merge --merge --delete-branch
gh run watch $(gh run list -L 1 --json databaseId -q '.[0].databaseId')
```
