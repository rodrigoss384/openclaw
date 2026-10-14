# <FEATURE_NAME> — Evidências

**Complexidade:**  
**Criticidade:**  
**Decisão:** `approved | approved-with-accepted-risk | rejected | awaiting-review`

## Artefatos e gates

| Item | Status | Evidência |
|---|---|---|

## Rastreabilidade

| REQ | AC | SCN | AT/teste real | PROP | Task | Resultado |
|---|---|---|---|---|---|---|

## Comandos executados

| Comando | Resultado | Contagens/saída relevante |
|---|---|---|

## Autonomy decision evidence

- Ledger derivado: `.specs/features/<feature-slug>/autonomous-decisions.json` — `not-applicable | checked`
- Decisões com `recordDecision=true`:
- Validação de provenance/ledger:
- `SAFE_AUTONOMOUS` efêmeras não são persistidas; ausência dessas microdecisões no ledger é esperada.
- Resumo release-relevant: referencie IDs do ledger sem duplicar seu conteúdo machine-readable.

## Backend evidence

- Backend gate: `not-applicable | ready-for-backend-slice | backend-broad-build-approved`
- Contrato e scenario matrix:
- Segurança e tenant isolation:
- Dados, migration e recovery:
- Resiliência, concorrência e idempotência:
- Observabilidade e SLO:
- Scorecard, decisão, approver e timestamp quando aplicável:

## Frontend evidence

## Riscos remanescentes e aceitações

## Aprovação humana
