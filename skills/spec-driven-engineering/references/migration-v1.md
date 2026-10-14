# Legacy V1 Migration

Migrate semantically in a clean context. Use `scripts/migrate-v1.mjs` only for safe backup and structural scaffolding.

## Preconditions

1. Run dry-run.
2. Confirm the feature directory and legacy files.
3. Confirm no numbered target artifact exists.
4. Back up the complete feature directory.
5. Preserve all legacy IDs and evaluation baselines.

## Mapping

| Legacy | New destination | Migration treatment |
|---|---|---|
| `context.md` | `00-intent.md`, `02-assumptions.md` | Split intent/decisions from questions/ambiguity semantically |
| `requirements.md` | `01-spec.md` | Preserve requirement IDs and priorities |
| `spec.md` | `01-spec.md`, `03-acceptance-criteria.md` | Preserve behavior and acceptance anchors |
| `design.md` | `07-design.md` | Preserve decisions and rejected alternatives |
| `tasks.md` | `09-tasks.md` | Preserve task IDs, status and dependencies |
| `evaluations/` | unchanged | Add migration note; never re-freeze silently |

The deterministic script creates conservative source snapshots with migration headers. A migration prompt must refine combined or split content. Do not fabricate `04`, `05`, `06`, `08`, `10`, or `11`; create them through the normal new stages.

## Completion

Validate the new package, retain the backup location in `11-evidence.md`, mark unresolved semantic splits in `02-assumptions.md`, and update the handoff with the first incomplete new stage.
