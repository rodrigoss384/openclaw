# Piloto — Applicability Contract

```text
complexity: small
criticality: standard
frontend: not-applicable
backend: not-applicable
persistence: not-applicable
public-api: unchanged
auth: not-applicable
tenancy: not-applicable
concurrency: not-applicable
migration: not-applicable
new-service-or-subsystem: not-applicable
material-operational-cost: not-applicable
performance: not-applicable
accessibility: not-applicable
frontend-representative-gate: not-required
backend-representative-gate: not-required
browser-evidence: not-required
contract-drift-check: not-applicable
interface-contract: not-applicable
interface-contract-kind: none
interface-contract-type: none
behavioral-ux: not-applicable
behavioral-ux-risk: none
outcome-evidence: not-applicable
```

## Racional

Derivado exclusivamente de 00–02: ampliação de teste existente de utilitário, sem alteração de backend/frontend de produto, API pública, persistência, migration, auth/tenancy ou concorrência. Workflow de execução/publicação já existe no supervisor e exige seu grant/gates; não faz parte do código do produto a implementar aqui. Sucesso deste piloto é evidência técnica de delivery/protocolo, sem hipótese de ativação, conversão ou efeito de produto/usuário; outcome evidence não aplicável. Consumo limitado de quota incluída está previsto nos perfis aprovados, nenhuma nova despesa operacional material autorizada.

Mudança de produção ou ampliação de escopo reabre 02/applicability; esses valores não dispensam preflight, segurança dos workers, revisão Agy ou gate humano de evidence/release.

## Changelog

| Data | Campo | De | Para | Motivo |
|---|---|---|---|---|
| 2026-10-12 | Perfil inicial | não emitido | small/standard test-only | Contrato proposto para fork descartável |
