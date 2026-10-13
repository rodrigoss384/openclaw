# Piloto — Critérios de aceitação propostos

**Status:** ready para validação objetiva; Q-PIL-001 resolvida por D-PIL-004 humana. Grant de execução ainda pendente; não substituído por este estado.

### AC-PIL-001 — Normalização e propagação

Requisito REQ-PIL-001. Dado o utilitário de retry existente, quando a suite tabelada exercitar limites/valores não finitos e erro terminal/callback, então os resultados e invariantes do contrato vigente são observados sem alterar código de produção. Todos os oito testes já existentes continuam passando. Divergência de contrato bloqueia escopo, sem reparo arbitrário do utilitário.

### AC-PIL-002 — Sessão e intervenção

Requisito REQ-PIL-001, REQ-PIL-006. Dada a task inicial autorizada, quando pedir a intervenção prevista e receber resposta válida pelo protocolo, então ledger registra a mesma task/run/conta/modelo/sessionId e nenhuma aprovação adicional. A task seguinte começa em outro sessionId/home. Resposta duplicada ou para tentativa diferente é recusada, sem outra execução.

### AC-PIL-003 — Revisão independente

Requisito REQ-PIL-002, REQ-PIL-005. Dada a feature candidata concluída, quando revisar, então só Antigravity Pro3.1High é usado, em sessão nova e checkout readonly; baseline/feature SHAs ficam registrados. Nenhum arquivo avaliado é reparado pelo reviewer. Falha/finding bloqueante preserva evidência e espera correção autorizada.

### AC-PIL-004 — Publicação e gate

Requisito REQ-PIL-003, REQ-PIL-006. Dado grant com efeitos explícitos e perfil correspondente ao fork, quando publicar, então branch própria e PR rascunho para main são criados idempotentemente. Issues somente de achados comprovados, vinculadas ao PR. Gate/revisão/checks/SHAs válidos são exigidos para pronto. Merge/deploy nunca ocorre por esse grant. Sem achados não há issue artificial.

### AC-PIL-005 — Quota, retomada e isolamento

Requisito REQ-PIL-004, REQ-PIL-005, REQ-PIL-006. Dado o dispatcher autorizado, quando quota/pause/restart/cancelamento afetar o job, então nenhuma nova task inicia com dados não comprovados, o provider não muda por teste falho e o escritor parcial é reconciliado. Cursor só inicia após ambos Codex inelegíveis por quota; recuperação validada devolve a task seguinte ao Codex. Não acelerar nem simular recuperação real para declarar o cenário nativo concluído.

Credencial guest pode ser escrita/renovada apenas no home da conversa; collector config/history/credenciais do host, socket Docker, home pessoal e módulos de controle do supervisor ficam inacessíveis. Symlink/outside-path é recusado. Source credential original permanece intacta no probe de escrita; rotação OAuth real tem evidência própria.

### AC-PIL-006 — QA honesta de integração

Requisito REQ-PIL-005, REQ-PIL-006. Dadas a main atual e feature SHAs, quando executar checks registrados no baseline e integração separados, então cada comando tem argv/exit/status/evidência e cleanup, e falha anterior não muda os checks que passaram. Check após falha é `not-run`; probe: sequência de QA registrada em 08-test-plan.md. Conflito, dependência indisponível, falha preexistente ou mudança dos SHAs impede aprovação. Tests-only não vira afirmação de prontidão do produto inteiro.

## Rastreabilidade

| AC | REQ | Categoria | Observável |
|---|---|---|---|
| AC-PIL-001 | REQ-PIL-001 | unit/invariantes | suite retry |
| AC-PIL-002 | REQ-PIL-001, REQ-PIL-006 | sessão/autoridade | ledger e IDs nativos |
| AC-PIL-003 | REQ-PIL-002, REQ-PIL-005 | review readonly | tentativa Agy/hashes |
| AC-PIL-004 | REQ-PIL-003, REQ-PIL-006 | publicação/gate | PR/issues/grant |
| AC-PIL-005 | REQ-PIL-004, REQ-PIL-005, REQ-PIL-006 | quota/recovery/isolamento | probes/ledger/containers |
| AC-PIL-006 | REQ-PIL-005, REQ-PIL-006 | integração/auditoria | relatório baseline/integração |
