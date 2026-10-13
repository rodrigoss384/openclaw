# Piloto — Contratos executáveis propostos

**Status:** ready para validação objetiva dos contratos, escopo confirmado por D-PIL-004. Perfil final e grant continuam necessários antes de executar. Nenhuma inferência nativa foi executada nesta preparação.
**Runner existente:** Vitest4.0.18 para o produto; CLI do supervisor/ledger e GitHub para cenários operacionais, sem Cucumber.

| ID | REQ / AC | Cenário | Nível | Local/oráculo | Status |
|---|---|---|---|---|---|
| AT-PIL-001 | REQ-PIL-001 / AC-PIL-001 | SCN-PIL-001 | unit | src/infra/retry.test.ts, novos describe de resolveRetryConfig e retryAsync | planned |
| AT-PIL-002 | REQ-PIL-001, REQ-PIL-006 / AC-PIL-002 | SCN-PIL-002 | acceptance operacional | runs/ledger nativo: same-session na resposta, next-session na task seguinte | planned |
| AT-PIL-003 | REQ-PIL-002 / AC-PIL-003 | SCN-PIL-003 | acceptance operacional | reviewer Agy e hash do readonly checkout | planned |
| AT-PIL-004 | REQ-PIL-003 / AC-PIL-004 | SCN-PIL-004 | integration GitHub | branch/PR main, draft/ready, marker idempotente, issues comprovadas | planned |
| AT-PIL-005 | REQ-PIL-004, REQ-PIL-006 / AC-PIL-005 | SCN-PIL-005 | acceptance operacional | snapshots/recovery/guest isolamento e OAuth real | planned |
| AT-PIL-006 | REQ-PIL-005 / AC-PIL-006 | SCN-PIL-006 | integration Docker | QA report baseline/integração e SHAs | planned |

## Oráculos e execução

AT-PIL-001: setup com frozen lockfile, lifecycle scripts desabilitados; Vitest com worker1. Casos numéricos previstos em 01/06; preservar os oito testes existentes. RED esperado para um teste novo meaningful só quando o cenário não estiver comprovado; numa feature tests-only o contrato pode já estar GREEN na produção existente. Registrar honestamente essa condição, sem fabricar RED nem alterar produto para produzir falha artificial. O executor precisa demonstrar que o novo teste detecta o contraexemplo pretendido por mecanismo controlado e reversível ou registrar a limitação para revisão, sem modificar o avaliado no reviewer.

Comando unit real provado em Docker: `node node_modules/vitest/vitest.mjs run src/infra/retry.test.ts --config vitest.unit.config.ts --maxWorkers=1 --no-file-parallelism`. Instalação frozen/ignore-scripts é prerequisito independente. Não usar --minWorkers (removido no Vitest4).

AT-PIL-002: primeiro despacho novo; intervenção com resposta pelo protocolo exato. Verificar task/run/modelo/conta/native sessionId antes/depois e idempotência. Mensagem não concede gate.

AT-PIL-003: sessão review nova, modelo Pro3.1High, mesma combinação de SHAs; mount readonly e artefato byte-estável. Reviewer devolve achados sem reparar.

AT-PIL-004: grant registra efeitos; publisher liga repo/identidade/origin, branch própria e markers. Verificar PR draft sem duplicatas após timeout/retry; findings comprovados viram issue, ausência de findings não produz issue vazia. Nunca executar merge.

AT-PIL-005: cenários nativos separados por evidência. Quota real reset exige duas leituras coerentes, não só relógio. Reservas/locks e escritores após restart devem ser comprovados. OAuth refresh ainda not-run (probe autenticado de rotação controlada em sessão do piloto), não equivale aos testes sintéticos de cópia isolada.

AT-PIL-006: launcher executa a mesma lista no baseline e merge temporário; comandos/exit/stdout/stderr/hash/cleanup registrados. Comando aplicável ausente ou não executado produz not-run e bloqueia a liberação; probe: sequência cadastrada em 08-test-plan.md. Build/migrations/stack são not-applicable neste piloto tests-only pelo racional D-PIL-005; os checks não certificam prontidão completa da aplicação. Scope tests-only e limitações devem aparecer no PR.
