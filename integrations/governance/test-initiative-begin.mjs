#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { beginFeature, nextStep } from "./workflow-entry.mjs";

function git(cwd, args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `git ${args.join(" ")} failed`);
}
function write(root, relative, content) {
  fs.mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
  fs.writeFileSync(path.join(root, relative), content);
}
function initiative(status, rows, header = "| Ordem | Feature slug | Objetivo | Depende de |") {
  return `# Programa — Initiative\n\n## Rollout plan\n\n${header}\n|---|---|---|---|\n${rows.join("\n")}\n\n## Status\n\n${status}\n\n## Changelog\n\n| Data | Mudança | Motivo |\n|---|---|---|\n`;
}
function release(root, feature, stage = "evidence-release") {
  write(root, `.specs/features/${feature}/stage-state.json`, `${JSON.stringify({ stages: { [stage]: { status: "complete" } } })}\n`);
}
const started = (root, feature) => fs.existsSync(path.join(root, ".specs/features", feature, "execution-start.json"));

const root = fs.mkdtempSync(path.join(os.tmpdir(), "initiative-begin-"));
let assertions = 0;
try {
  git(root, ["init", "-q", "-b", "main"]);
  git(root, ["config", "user.email", "test@example.com"]);
  git(root, ["config", "user.name", "test"]);
  write(root, "README.md", "seed\n");
  git(root, ["add", "README.md"]);
  git(root, ["commit", "-q", "-m", "seed"]);
  write(root, ".specs/project/workflow-entry.json", "{}\n");

  const program = ".specs/initiatives/programa/initiative.md";
  write(root, program, initiative("`ready`. Decisões declaradas.", [
    "| 1 | `base` | Fundação | — |",
    "| 2 | `meio` | Depende da base (`AD-001`, `externa-fora-do-plano`) | `base`: precisa do lint verde |",
    "| 3 | `topo` | Final | `meio` e `base` |"
  ]));

  // A rollout row without dependencies begins normally.
  assert.equal(nextStep({ root, feature: "base" }).command, "begin"); assertions += 1;
  beginFeature({ root, feature: "base" });
  assert.ok(started(root, "base")); assertions += 1;

  // A declared dependency without evidence-release blocks begin and next, without writing a start record.
  const blocked = nextStep({ root, feature: "meio" });
  assert.equal(blocked.status, "blocked-by-initiative"); assertions += 1;
  assert.equal(blocked.command, null); assertions += 1;
  assert.deepEqual(blocked.blockers.map(row => row.dependency), ["base"]); assertions += 1;
  assert.throws(() => beginFeature({ root, feature: "meio" }), /Initiative rollout blocks begin of meio: .*base has not completed evidence-release/); assertions += 1;
  assert.ok(!started(root, "meio")); assertions += 1;

  // Tokens outside the plan (decision IDs, external slugs) are not dependencies; partial stages are not a release.
  release(root, "base", "adversarial");
  assert.throws(() => beginFeature({ root, feature: "meio" }), /base has not completed evidence-release/); assertions += 1;
  release(root, "base");
  beginFeature({ root, feature: "meio" });
  assert.ok(started(root, "meio")); assertions += 1;

  // Every declared dependency is enforced, not only the previous row.
  release(root, "meio");
  fs.rmSync(path.join(root, ".specs/features/base/stage-state.json"));
  assert.deepEqual(nextStep({ root, feature: "topo" }).blockers.map(row => row.dependency), ["base"]); assertions += 1;
  release(root, "base");
  assert.equal(nextStep({ root, feature: "topo" }).command, "begin"); assertions += 1;

  // A non-ready initiative blocks all of its features, including the unfilled template status; resumes stay intact.
  for (const status of ["`blocked` — decisão de stack pendente.", "`blocked | ready`", "Sem status declarado."]) {
    write(root, program, initiative(status, ["| 1 | `base` | Fundação | — |", "| 2 | `meio` | Meio | `base` |", "| 3 | `topo` | Final | `meio` |"]));
    assert.throws(() => beginFeature({ root, feature: "topo" }), /initiative status is .*not ready/); assertions += 1;
  }
  assert.equal(beginFeature({ root, feature: "meio" }).feature, "meio"); assertions += 1;

  // Features outside every rollout plan are not governed by the initiative.
  assert.equal(nextStep({ root, feature: "avulsa" }).command, "begin"); assertions += 1;

  // A rollout table that cannot be read fails closed for the features it mentions.
  write(root, program, initiative("`ready`", ["| 1 | `base` | Fundação |", "| 2 | `topo` | Final |"], "| Ordem | Feature slug | Objetivo |"));
  assert.throws(() => beginFeature({ root, feature: "topo" }), /Rollout plan requires "Feature slug" and "Depende de" columns/); assertions += 1;
  assert.equal(nextStep({ root, feature: "avulsa" }).command, "begin"); assertions += 1;

  console.log(`Initiative begin gate tests passed (${assertions} assertions).`);
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
