# <FEATURE_NAME> — Applicability Contract

Ver `references/applicability-contract.md` para regras de derivação e consumo.

```text
complexity: <quick | small | medium | large | complex>
criticality: <low | standard | critical>
frontend: <not-applicable | lightweight | substantial>
backend: <not-applicable | lightweight | substantial>
persistence: <not-applicable | affected>
public-api: <unchanged | compatible | breaking | new>
auth: <not-applicable | affected>
tenancy: <not-applicable | affected>
concurrency: <not-applicable | affected>
migration: <not-applicable | required>
new-service-or-subsystem: <not-applicable | applicable>
material-operational-cost: <not-applicable | applicable>
performance: <not-applicable | standard | critical>
accessibility: <not-applicable | required>
frontend-representative-gate: <not-required | required>
backend-representative-gate: <not-required | required>
browser-evidence: <not-required | hard-required>
contract-drift-check: <not-applicable | required>
interface-contract: <not-applicable | applicable>
interface-contract-kind: <none | http | event | graphql | grpc | job | cli>
interface-contract-type: <none | openapi | asyncapi | graphql-sdl | protobuf | arazzo | custom>
behavioral-ux: <not-applicable | applicable>
behavioral-ux-risk: <none | standard | high-risk>
outcome-evidence: <not-applicable | applicable>
```

## Racional

`<Por que cada valor não trivial foi escolhido — cite evidência de 00-02.>`

## Changelog

| Data | Campo alterado | De | Para | Motivo |
|---|---|---|---|---|
