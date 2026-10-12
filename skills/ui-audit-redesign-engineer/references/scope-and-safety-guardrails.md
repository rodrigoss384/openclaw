# Scope and Safety Guardrails

## Preserve

- Existing backend behavior and API contracts.
- Authentication and authorization behavior.
- Tenant isolation, RLS, roles, and permissions.
- Business, legal, financial, and workflow rules.
- Audit logs, telemetry, import/export semantics, and integrations.
- Existing user data and local uncommitted work.

## Avoid

- Rebuilding the application from scratch.
- Introducing a second design system when one can be normalized.
- Making broad refactors during visual work.
- Replacing functional flows with static mockups.
- Creating fake production data.
- Renaming domain concepts for visual polish unless product copy explicitly changes.
- Touching database containers, shared services, or external environments without explicit authorization.

## Keep changes reviewable

- Work by lot, not by aesthetic sweep.
- Prefer component/foundation fixes before page-by-page edits.
- Keep unrelated cleanup out of the diff.
- Document intentional visual behavior changes separately from functional changes.
- If a functional defect is discovered, record it and ask whether to fix it as a separate task.

## Evidence standard

Every audit finding should identify:

- location;
- symptom;
- likely cause;
- severity;
- affected user/task;
- recommended correction;
- validation method.

Every implementation handoff should identify:

- what changed;
- what did not change;
- tests/checks run;
- risks or follow-ups.
