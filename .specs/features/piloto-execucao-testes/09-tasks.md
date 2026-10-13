# Piloto — Tasks

## Ordem de execução

### T-PIL-001 — Cobertura dos limites da configuração de retry
- Requisitos/ACs: REQ-PIL-001, REQ-PIL-004, REQ-PIL-006, AC-PIL-001, AC-PIL-002, AC-PIL-005, AT-PIL-001, AT-PIL-002, AT-PIL-005, PROP-PIL-001.
- Tipo: implementation
- Depende de: Nenhum
- Status: complete
- Onde: somente src/infra/retry.test.ts; Status desta task como progresso.
- Reutiliza: resolveRetryConfig, Vitest existente, helpers atuais; não alterar src/infra/retry.ts nem configs/lockfile/dependências.
- Intervenção deliberada: antes de editar, perguntar ao operador qual identificador textual usar na evidência do piloto. Encerrar com <<TASK_INPUT: required>> e <<GATE_STATUS: blocked>>, sem aprovar gate. Após resposta na mesma sessão, usar o identificador somente na evidência; não mudar contrato. Registrar task/run/native sessionId antes e depois.
- Testes e RED: casos tabelados de attempts/minDelayMs/maxDelayMs/jitter, valores não finitos, ausentes e min/max, conforme PROP-PIL-001. Expected values explícitos, proteger invariantes observáveis; não copiar algoritmo para o oráculo. Preservar todos os testes existentes. GREEN prévio deve ser registrado honestamente; contraexemplo só em cópia descartável, sem modificar a produção da branch.
- Pré-requisitos: comandos 1/2 de 08-test-plan.md quando node_modules ausente, ignore-scripts/frozen, sem instalação global. Não commitar output/node_modules; nenhum hook/advance/push/PR pelo agente.
- Gate: task-local; checks 3–6 de 08-test-plan.md devem passar. Falha bloqueia e preserva evidência.
- Concluída quando: novos testes úteis e checks passed com evidências reais, resposta vinculada à mesma sessão; atualizar somente Status desta task. Launcher cria commit/checkpoint.

### T-PIL-002 — Erro terminal e informação da callback de retry
- Requisitos/ACs: REQ-PIL-001, REQ-PIL-006, AC-PIL-001, AC-PIL-002, AT-PIL-001, AT-PIL-002, PROP-PIL-002.
- Tipo: implementation
- Depende de: T-PIL-001
- Status: not-started
- Onde: somente src/infra/retry.test.ts; Status desta task como progresso.
- Reutiliza: retryAsync, fake timers/mocks e runner existentes. Abrir sessão limpa; não herdar conversa/home da task anterior.
- Testes e RED: casos tabelados 1/2/3 tentativas, erro terminal propagado por identidade, callback antes de retry real com attempt/maxAttempts/err corretos, nenhuma callback após última falha. Sem waits reais/IO. Sensibilidade e condição GREEN existentes conforme 08-test-plan.md; produção fora do escopo.
- Pré-requisitos: sequência 1/2 de 08-test-plan.md se necessário; nenhum commit/advance/push/PR pelo agente.
- Gate: task-local; comandos 3–6 de 08-test-plan.md.
- Concluída quando: testes úteis, teardown e checks passed, nova sessão comprovada, preservação dos testes anteriores; atualizar somente Status desta task, launcher checkpoint.

### T-PIL-003 — Revisão independente dos testes e do piloto
- Requisitos/ACs: REQ-PIL-002, REQ-PIL-005, AC-PIL-003, AC-PIL-006, AT-PIL-003, AT-PIL-006.
- Tipo: adversarial
- Depende de: T-PIL-002
- Status: not-started
- Onde: checkout readonly e relatório; nenhum reparo no artefato avaliado.
- Reutiliza: Antigravity gemini-3.1-pro-high, sessão limpa, launcher confiável para QA baseline/integrado.
- Gate: adversarial canônico; revisão de limites/valor dos testes e evidência nativa. Falha aguarda autorização de correção; não trocar provider para superar teste reprovado.
- Concluída quando: relatório íntegro para SHAs avaliados e estágio canônico concluído pelo launcher. QA executa sequência completa de 08-test-plan.md e explicita seu limite tests-only.

### T-PIL-004 — Gate humano de evidência e publicação controlada
- Requisitos/ACs: REQ-PIL-003, REQ-PIL-004, REQ-PIL-005, REQ-PIL-006, AC-PIL-004, AC-PIL-005, AC-PIL-006, AT-PIL-004, AT-PIL-005, AT-PIL-006, PROP-PIL-003.
- Tipo: evidence-release
- Depende de: T-PIL-003
- Status: not-started
- Onde: control plane/ledger/GitHub do fork registrado; launcher confiável.
- Reutiliza: PR rascunho main, issues só de achados comprovados, autorização específica, markers idempotentes.
- Gate: evidence-release humano; texto do agente não constitui aprovação. Sem merge/deploy.
- Concluída quando: aprovação humana canônica, QA/review válidos nos SHAs atuais, efeitos autorizados no grant e evidência real de publicação; sem alegar que os checks limitados validam todo OpenClaw.

## Matriz de rastreabilidade

| Task | REQ/AC | Teste | Gate |
|---|---|---|---|
| T-PIL-001 | REQ-PIL-001, REQ-PIL-004, REQ-PIL-006, AC-PIL-001, AC-PIL-002, AC-PIL-005 | AT-PIL-001, AT-PIL-002, AT-PIL-005 | task-local |
| T-PIL-002 | REQ-PIL-001, REQ-PIL-006, AC-PIL-001, AC-PIL-002 | AT-PIL-001, AT-PIL-002 | task-local |
| T-PIL-003 | REQ-PIL-002, REQ-PIL-005, AC-PIL-003, AC-PIL-006 | AT-PIL-003, AT-PIL-006 | adversarial |
| T-PIL-004 | REQ-PIL-003, REQ-PIL-004, REQ-PIL-005, REQ-PIL-006, AC-PIL-004, AC-PIL-005, AC-PIL-006 | AT-PIL-004, AT-PIL-005, AT-PIL-006 | evidence-release |
