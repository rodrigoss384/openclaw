# Piloto — Design

## Contexto e boundaries

Escopo humano confirmado por D-PIL-004: somente ampliar testes em `src/infra/retry.test.ts`, em duas tasks sequenciais. Produção, dependências, lockfile, hooks e workflows permanecem fora do contrato. Baseline canônico: execution-context.json; bootstrap local em 25b38b845de35a3aecfd8ef48600cc594adea33c. Não reconstruir esse baseline a partir de commits posteriores.

## Arquitetura atual reutilizada

Reutilizar Vitest 4.0.18, utilitários de retry existentes e launcher/ledger do supervisor. Não adicionar biblioteca nem runner. T-PIL-001 cobre resolveRetryConfig; T-PIL-002 cobre retryAsync. Cada chamada recebe TASK_ID e usa conversa/home novo. A intervenção deliberada de T-PIL-001 responde pela mesma tentativa, provider, conta e sessão nativa.

## Componentes, interfaces e fluxo

Supervisor determina elegibilidade, reserva conta/projeto/RAM e valida grant. Worker recebe checkout isolado e apenas sua credencial de origem readonly; cópia gravável fica em home exclusivo da conversa. Configuração e ledger do supervisor não entram no worker. O coletor continua separado desse home. Recusar sessão vinculada a outra identidade. Agente atualiza somente o Status da task e o arquivo permitido; checkpoint/commit/transições são responsabilidade do launcher confiável.

Após duas tasks: implementação canônica, revisão Antigravity Pro 3.1 High em sessão limpa e checkout readonly, integração temporária com main remota e checks idênticos no baseline/integrado. O reviewer escreve 10 e findings em output isolado; o launcher forma o par 10/11 a partir de provas reais do ledger antes do advance adversarial. 11 declara QA pendente com probe até sua execução própria, sem aprovar gate; evidência humana ou stale não é sobrescrita. Gate evidence-release exige aprovação humana canônica. Publicação, quando autorizada no grant, usa exclusivamente o fork registrado e PR rascunho até checks/revisão/gates. Issues somente para achados comprovados; merge humano.

## Persistência, integrações e erros

Ledger contém task/run/checkpoint/native sessionId; `.specs` mantém contratos e gates. Mudança de contrato, baseline ou efeitos invalida grant. Falha de teste não provoca troca de provider nem reparo pelo reviewer. Rate limit/interrupção exige reconciliação da execução parcial. Quota reset não prova saldo recuperado. Cursor só inicia quando as duas contas Codex estão inelegíveis por quota; retorno ocorre entre tasks, após duas leituras coerentes.

## Decisões e trade-offs

| ID | Decisão | Alternativa | Evidência | Custo de reversão |
|---|---|---|---|---|
| D-PIL-004 | Duas tasks somente de testes | Alterar produção | Confirmação humana em 02-assumptions.md | Novo contrato/grant |
| D-PIL-005 | Checks limitados à mudança de testes e typecheck completo | Build/stack completos | Probes unit/lint/fmt/typecheck reais registrados no supervisor | Ampliação explícita de perfil |
| D-PIL-006 | Worker 3 GiB, 2 CPUs, Go memory soft limit 1800 MiB | 2 GiB, encerramento SIGKILL observado | pilot-baseline-typecheck-memory.json | Requalificar recursos/perfil |

D-PIL-005 é escolha de implementação dentro do escopo tests-only aprovado. Build de aplicação, migrations e smoke de stack não são aplicáveis à alteração exclusiva de testes; não houve nova implementação, schema, serviço ou artefato de aplicação. Não usar um serviço artificial para alegar validação do produto. A evidência resultante comprova somente suite retry, formatação, lint do arquivo e typecheck configurado completo; não certifica o funcionamento completo de OpenClaw. O PR deve explicitar esse limite. Demais cenários operacionais continuam pendentes de prova nativa no piloto.

## Rollout, rollback e riscos

Somente `_orchestrator-sandbox`; demais projetos desabilitados. Preflight/profile/grant específicos antes de execute. Remover checkout/containers próprios após evidência, sem reset do projeto original ou de WIP. OAuth refresh/rotação e identidade Cursor no guest ainda não comprovados: probe nativo autenticado necessário, sem presumir sucesso de inferência pelo login status. Bloqueios de autenticação não geram reparos no produto.

## Backend e frontend

Ambos not-applicable: nenhuma API, persistência, auth, tenancy ou interface de produto alterada. Representative gates não requeridos conforme applicability congelada. Sem deploy, apply IaC, VMware ou recursos reais.
