# Tasks — Trava Concorrencia

- [x] isRunning flag + busy response (AD-045)
- [x] finally libera trava
- [x] isStatusSyncRunning export
- [x] interval 5-30 default 5 (AD-052)
- [x] stop() limpa initialTimeoutId (AD-047)
- [x] POST /sync-status RBAC admin + 500 on error (AD-049)
- [x] Testes: statusSyncScheduler.test.js concorrencia

## Gate
- node --test tests/backend/services/statusSyncScheduler.test.js
