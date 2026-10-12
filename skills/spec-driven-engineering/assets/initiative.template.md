# <INITIATIVE_NAME> — Initiative

## Target architecture

`<Descrição de alto nível da arquitetura de destino do programa.>`

## Technology decisions

| Decisão | Escolha | Racional |
|---|---|---|
| `<ex.: router>` | `<ex.: TanStack Router>` | `<racional>` |

## Migration/cutover strategy

`<big-bang | incremental>` — `<detalhe da estratégia, ordem de corte, rollback/containment>`

## Design-system foundation

`<se o programa exige um design system novo/consolidado antes das features de tela, declare aqui>`

## Quality gates

`<gates canônicos aplicáveis a toda feature do programa — normalmente todos, sem exceção>`

## Rollout plan

`Depende de` lista slugs de features deste plano entre crases (ou `—`); `workflow-entry.mjs begin` só inicia a feature depois que cada uma tiver `evidence-release` completo.

| Ordem | Feature slug | Objetivo | Depende de |
|---|---|---|---|
| 1 | `<feature-slug>` | `<objetivo>` | — |

## Status

`blocked | ready` — substitua por um único valor; qualquer valor diferente de `ready` bloqueia o `begin` das features do plano.

## Changelog

| Data | Mudança | Motivo |
|---|---|---|
