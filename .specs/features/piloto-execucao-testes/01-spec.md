# Piloto de execução segura — Especificação proposta

**Status:** `in-progress`; execução/publicação aguardam grant próprio.

## Objetivo e limites

Provar o supervisor real em duas tasks de ampliação da cobertura de retry no fork descartável. O artefato de produto permitido é `src/infra/retry.test.ts`. `src/infra/retry.ts` e seus consumidores não serão alterados. Não atualizar dependências, lockfiles, hooks, workflows ou configuração do produto. O bootstrap foi autorizado e commitado separadamente.

## Comportamento de teste

REQ-PIL-001: uma task cobre normalização dos overrides de `resolveRetryConfig` (limites, valores não finitos e relação min/max) por casos tabelados, usando o runner existente. A segunda cobre preservação do erro terminal e informação da callback em `retryAsync`, sem real time waits ou IO externo. Não duplicar apenas linhas da implementação: proteger os invariantes de limite e propagação observáveis; não alterar produção para satisfazer uma asserção divergente do contrato atual. Divergência bloqueia para revisão do escopo.

No primeiro despacho, o contrato exige uma pergunta humana sobre a identificação da evidência do piloto antes de editar; o operador responde pela tentativa exata. A pergunta não transfere uma decisão de arquitetura nem autoriza efeito novo. A retomada usa a mesma sessão, conta/modelo/task. A segunda task abre sessão nova. Esse caso é uma prova deliberada do protocolo de intervenção, registrada como tal.

## Revisão, QA e publicação

REQ-PIL-002: revisão exclusivamente Antigravity `gemini-3.1-pro-high`, sessão limpa, checkout readonly. O revisor não corrige a branch avaliada. Rejeição preserva evidência, mantém PR rascunho e espera decisão de correção.

REQ-PIL-003: destino exato `rodrigoss384/openclaw`, PR para `main`. Branch pertence ao job do supervisor. Launcher confiável realiza push/PR/issues com identidade vinculada e grant; credencial não entra em worker. Issues somente para achados comprovados, ligadas ao PR. Sem merge/deploy. Promoção para pronto depende de revisão, checks e gates canônicos para os SHAs avaliados.

REQ-PIL-005: instalar dependências frozen/ignore-scripts em checkout descartável, validar a suite retry existente/ampliada, lint/formatação/typecheck aplicáveis e smoke descartável que o perfil conseguir provar. Baseline e integração executam os mesmos comandos; conflito, ausência de dependências/stack ou falha no baseline são resultados explícitos. Fonte alterada por teste invalida evidência. Escopo limited-test-only não comprova prontidão completa de OpenClaw; relatório e PR devem dizer exatamente o que rodou. Perfil/commands ainda em qualificação, nenhuma aprovação de QA neste contrato.

## Autorização, estado e recursos

REQ-PIL-004: Codex1→Codex2→Cursor→Antigravity executor, apenas por quota inelegível comprovada; Codex ocupado espera. Five-hour90/weekly95/Cursor90; duas leituras coerentes para recuperação, retorno somente entre tasks. Cursor `cursor-grok-4.6-high`; último executor Gemini3.8FlashHigh; nenhuma troca por teste falho. Reviewer fica Antigravity mesmo em fallback.

REQ-PIL-006: `observe` e projetos desabilitados até perfil/grant. Baseline congelado, contratos autorizados e `TASK_ID` explícito. Aprovação repetida não cria novo job. Mudança de baseline/contrato/permissões exige novo grant. Progress factual não invalida autorização. Pausa/cancelamento/restart preservam checkpoints e locks; escritores desconhecidos bloqueiam reconciliação.

Homes nativos separados por conversa/conta/identidade; somente credencial necessária readonly, copiada dentro do guest. Coletor do host não recebe alterações, configurações, hooks ou sessões do worker. Auth refresh/rotação ainda precisa de prova nativa; não chamar esse item concluído a partir de credenciais de teste.

## Contratos públicos e dados

Nenhuma API, schema, banco, migration, autenticação, tenancy ou comportamento de produção alterados. Os contratos do supervisor já aprovados governam ledger/grants/task/review/publicação; esta feature não os reimplementa. Gates humanos canônicos e merge permanecem com o operador.

## Rastreabilidade das restrições explícitas

| Restrição | ID | Destino |
|---|---|---|
| Fork próprio e main | REQ-PIL-003 | Publicação e relatório dos SHAs |
| Codex gpt-6-luna high conta1/2 | REQ-PIL-001, REQ-PIL-004 | Perfil executor qualificado |
| Cursor Grok4.6High fallback; retorno entre tasks | REQ-PIL-004 | Cenários de quota/retomada |
| Revisão Agy Pro3.1High; fallbackexecutor Flash3.8High | REQ-PIL-002, REQ-PIL-004 | Perfil e reserva Agy |
| Task limpa e intervenção na mesma sessão | REQ-PIL-001 | Tasks e evidência nativa |
| PR rascunho, issues comprovadas, merge humano | REQ-PIL-003 | Grant, publisher e gate final |
| Incluídas somente; fivehour90/weekly95/Cursor90 | REQ-PIL-004 | Coleta/dispatch fail-closed |
| Docker descartável, limites, WIP e bots preservados | REQ-PIL-005 | Preflight/QA/checkout |
| Bootstrap local autorizado; grant separado para execução | REQ-PIL-006 | Execution-start/convite |
| Sem Hermes v1; agendamento sem LLM | REQ-PIL-004 | Supervisor existente |
