# Tasks — Envio Sob Demanda

## Done
- [x] POST /trigger 202 + RobotJob pending (REQ-006)
- [x] POST /trigger-batch admin
- [x] GET /instance/next-job lock atomico (AD-039 fix $and)
- [x] Validacao contractEligibility pos-lock com revert (AD-051)
- [x] job-runner pre-validacao antes de chromium.launch (AD-038)

## Gate
- npm test (robotInstanceController, eligibleContractsRegression)
