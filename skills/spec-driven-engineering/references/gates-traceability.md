# Gates and Traceability

## Traceability chain

Maintain:

```text
REQ → AC → SCN → AT → real test evidence
          ↘ PROP when applicable
REQ → design decision → task → changed files
finding → remediation test → verification evidence
```

Every P0/core requirement needs implementation evidence and test evidence, or a specific automation-impossibility justification approved in `11-evidence.md`.

## Release gates

1. **Discovery** — complexity and criticality fixed; blocking questions visible.
2. **Specification** — spec and assumptions agree; product blockers resolved by an authority.
3. **Acceptance** — no orphan REQ, AC, SCN or AT; property applicability decided.
4. **Design/readiness** — formal design when required; applicable backend/frontend overlays are ready for their small slices.
5. **Implementation** — expected RED observed; real gate commands discovered.
6. **Backend representative** — representative vertical proof before broad backend build; human approval only for public contracts, persistence/migration, security/tenancy, material operational cost, or critical risk.
7. **Frontend representative** — explicit human approval before broad frontend build.
8. **Adversarial** — critical findings fixed or explicitly accepted by the correct authority.
9. **Evidence/release** — executed evidence and residual risk support the final decision.

Backend and frontend gates are independent. A full-stack feature must release each side before its corresponding broad build. Adversarial review and release are blocked while any applicable representative gate remains unreleased.

`manifest.json`'s `gates[].dependsOn` encodes this as a real graph, not
narrative: `adversarial` depends on both representative gates, each
representative gate depends on `implementation`, and each gate's `guard`
field names the `applicability.md` condition that makes it apply. See
`references/gate-state-machine.md` for the full transition diagram
including rejection/patch loops.

## Gate integrity

Use only repository commands found in manifests, build files, CI or approved test docs. Record:

- command and working directory;
- start/end or duration when useful;
- exit status;
- test counts and skipped tests;
- relevant failure output;
- environment prerequisite probes.

Do not label `not-run` as success. Do not weaken assertions, skip tests, alter gate status, or rewrite planning truth merely to pass a validator.

## Independent review

Specification/acceptance, implementation, adversarial review, and evidence review must run in clean contexts. A reviewer must not repair the subject in the same stage. Route fixes back through implementation and rerun affected gates.
