# Bootstrap de contexto — fonte única

Este bloco era repetido literalmente em nove prompts (`03`, `04`, `05`, `06`, `07`,
`07.1`, `07.2`, `08`, `09`). Texto normativo idêntico relido a cada estágio é custo de
janela sem informação nova, então ele vive aqui e os prompts apontam para cá.

A autoridade machine-readable continua sendo
`prompts/spec-driven/manifest.json#contextBootstrap`. Em caso de divergência entre
esta prosa e o manifest, o manifest vence.

## Preenchimento pelo usuário

O uso normal exige do usuário somente `PROJECT_ROOT` e `FEATURE_SLUG`, nos prompts que declaram esses campos. Os demais tokens podem permanecer literais no prompt recebido: o agente resolve seus valores conforme `manifest.json#placeholderPolicy`, a partir da conversa, artefatos autorizados, código/configuração ou defaults seguros. Não solicite a edição manual de um placeholder técnico que essas fontes permitem resolver. A proibição de tokens não resolvidos vale para outputs e comandos efetivamente executados; não exige que o usuário preencha todo o template.

`REQUEST` pode permanecer literal quando o pedido da feature já foi fornecido na conversa: `explicit-or-block` exige intenção humana real, não substituição manual do token. Se a intenção não existe no contexto acessível, pergunte pelo problema/objetivo em linguagem natural. Ambiguidade consequencial, aprovação humana, credenciais e configuração protegida do executor continuam exigindo suas fontes/autoridades reais.

O agente também escolhe o provider com base na configuração identificada, escreve `execution-paths.json`, preenche `enforcement-inputs.json` com referências aos artefatos reais e resolve as alternativas enumeradas. Esses arquivos são preparação interna do workflow, não formulários adicionais para o usuário. A CLI `inputs` lista requisitos e valida os valores fornecidos pelo agente; ela não decide escopo de produto nem fabrica evidência. `needs-inputs` leva primeiro à busca/produção autorizada do artefato pelo seu owner, antes de qualquer escalada humana.

Sem alvo explícito de release, `RELEASE_TARGET` assume `readiness-review-only`; sem modo de migração, `MIGRATION_MODE` assume `dry-run`. Esses defaults não aprovam entrega nem autorizam Git, merge ou deploy. Gates podem continuar bloqueados por falta de evidência/autoridade, mesmo que todos os placeholders técnicos tenham sido resolvidos.

## `policy-rollout`

Siga `manifest.json#contextBootstrap.governancePolicy.mode` e
`bootstrap.rulesAdmission`:

- em `shadow`: carregue a revisão admitida das regras integralmente, para
  compatibilidade e comparação, **sem** tornar operacional o que é rationale-only nem
  adições não admitidas;
- em `primary` (`primaryScope=registered-rules-only`): `hardRules` e
  `requiredEnforcements` são a autoridade operacional para regras registradas. Fora do
  registry, apenas a governança legacy congelada no baseline admitido permanece
  operacional.

`unregisteredAdditions=non-operative` e `rationaleOnlyOperational=false` são
obrigatórios. Divergência material mantém o estágio `blocked`. Approvals
representative/release e os demais human gates não mudam por causa do rollout.

## `context-load`

Carregue `.specs/project/STATE.md`, `.specs/HANDOFF.md`, `effective-policy.json` e
somente os artefatos e o código realmente exigidos pelo estágio.

- em `shadow`: leia também a revisão admitida das regras integralmente, para
  comparação;
- em `primary`: mantenha o path das regras como pointer e leia rationale ou
  governança legacy do baseline admitido somente quando necessário, sem promover
  adições pós-baseline não registradas a autoridade operacional.

## Enforcement do estágio

O caminho executável é `workflow-entry.mjs`: `init` no projeto, `begin` antes do intent, `freeze` após applicability, `inputs` para preparar o mapa, `advance` ao fechar cada estágio e `delivery` para recalcular a entrega. Interfaces e migração: `integrations/governance/DELIVERY.md`.

Os prompts 00/01/02 publicam os comandos de preparação; 05/07/07.1/07.2/08 usam `advance`; 09 seleciona a feature e usa `delivery`. O executor produz `stage-state.json` somente após enforcement bem-sucedido e exige inputs/contexto válidos. `bootstrap`, `resolve`, `inputs` e `enforce --dry-run` são diagnósticos; não efetivam transição.

`enforcement-inputs.json` contém `stages`, com mapas capability → parâmetro → valor por estágio. Os valores são argumentos escalares; alternativas de comando usam enums e paths separados. `enforcement-input-requirements.json` enumera os parâmetros faltantes; ausência bloqueia a transição. Não substitua esse caminho por uma lista lembrada de validators nem escreva estado de aprovação manualmente.

## Orientação humana verificada

Antes de pedir decisão/execução/inspeção à pessoa, o agente prepara o roteiro estruturado descrito em `skills/spec-driven-engineering/references/human-approval-runbook.md`. Isso não acrescenta nenhum placeholder ao usuário. No handoff, `## Ação humana pendente` deve conter somente `Nenhuma.` quando não houver ação humana, ou o pointer `human-guidance` para o JSON. O gravador canônico valida o conteúdo e publica o bloco Markdown a reproduzir na resposta. Texto livre nessa seção, campos faltantes, comandos sem fonte/evidência vinculada, placeholders e snapshot desatualizado bloqueiam a escrita. O checker não executa os comandos recomendados. Operações não executadas devem ser declaradas assim, com motivo/preflight; passagem do checker não é aprovação nem prova criptográfica de execução.
