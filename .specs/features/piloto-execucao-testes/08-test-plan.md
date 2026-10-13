# Piloto — Plano de testes

## Baseline e RED esperado

Suite existente: oito testes de retry passaram no Docker antes da execução. Formatação/lint do arquivo e typecheck completo também passaram; evidências no pacote do supervisor. Uma feature de testes pode começar GREEN sobre produção já correta. Registrar isso honestamente. Demonstrar a sensibilidade da asserção a contraexemplo em cópia descartável controlada; não alterar produção na branch, não fabricar histórico RED. Revisão verifica valor dos casos e limitações.

## Matriz

| REQ / AC | Teste | Nível | Oráculo |
|---|---|---|---|
| REQ-PIL-001 / AC-PIL-001 | AT-PIL-001 / PROP-PIL-001, PROP-PIL-002 | unit/property tabelada | Limites observáveis, erro por identidade e callback |
| REQ-PIL-001, REQ-PIL-006 / AC-PIL-002 | AT-PIL-002 | operacional | Sessão antes/depois da resposta e próxima task |
| REQ-PIL-002 / AC-PIL-003 | AT-PIL-003 | review/security | Agy readonly, SHAs e ausência de reparo |
| REQ-PIL-003 / AC-PIL-004 | AT-PIL-004 | integration GitHub | PR draft/ready, issues, markers idempotentes |
| REQ-PIL-004, REQ-PIL-006 / AC-PIL-005 | AT-PIL-005 | resilience | Quotas reais, recovery, locks e isolamento |
| REQ-PIL-005 / AC-PIL-006 | AT-PIL-006 | integration Docker | Checks baseline/integrado e SHAs atuais |

## Comandos reais

Executar a sequência cadastrada abaixo no checkout descartável, sem credenciais de IA nos checks de QA. Instalação de ferramentas em /tmp; invocar o JS diretamente porque /tmp é noexec. Nunca rodar lifecycle scripts ou hooks. Limites: 3 GiB/2 CPUs para worker+proxy, reserva host 4 GiB. Timeout por comando; install frozen até 600s, typecheck até 300s. Launcher deve registrar argv, exit codes, hashes e cleanup.

1. `npm --cache=/tmp/npm-cache --userconfig=/dev/null install --prefix=/tmp/pilot-tools --ignore-scripts --no-audit --no-fund --package-lock=false pnpm@10.23.0`
2. `node /tmp/pilot-tools/node_modules/pnpm/bin/pnpm.cjs install --frozen-lockfile --ignore-scripts --store-dir=node_modules/.supervisor-store --network-concurrency=4`
3. `node node_modules/vitest/vitest.mjs run src/infra/retry.test.ts --config vitest.unit.config.ts --maxWorkers=1 --no-file-parallelism`
4. `./node_modules/.bin/oxfmt --check src/infra/retry.test.ts`
5. `./node_modules/.bin/oxlint --type-aware src/infra/retry.test.ts`
6. `env GOMAXPROCS=2 GOMEMLIMIT=1800MiB ./node_modules/.bin/tsgo --noEmit`

Egress de instalação: registry.npmjs.org, github.com, codeload.github.com. Só hosts públicos explicitamente cadastrados. Sem scripts de produção ou serviços externos reais. Build/migrations/stack: not-applicable neste contrato tests-only, racional D-PIL-005; não alegar aplicação validada integralmente. Probe para ampliação futura: qualificar comandos build/smoke oficiais e stack descartável antes de mudar o perfil.

## Fixtures, isolamento e teardown

Usar casos tabelados/fake timers já suportados; sem sleep real, rede ou novos fixtures de produção. Restaurar timers/mocks em teardown. Preservar os oito testes existentes. QA compara os mesmos comandos em main remota e integração temporária da feature; conflito bloqueia, falha baseline não vira sucesso. Nova alteração dos SHAs invalida relatório. Sessão review limpa não repara artefato.

## Backend applicability

Contracts/persistence/migrations/tenant/load: not-applicable, nenhum backend alterado. Cenários de idempotência, concorrência e recovery pertencem ao supervisor e requerem prova operacional AT-PIL-005; testes sintéticos complementam, não substituem essa prova.
