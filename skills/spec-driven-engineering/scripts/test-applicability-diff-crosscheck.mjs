#!/usr/bin/env node

// Contract for the diff cross-check added to validate-applicability-contract.mjs.
//
// governance-control.mjs derives requiredEnforcements straight from
// applicability.md, an agent-authored file. Declaring `frontend:
// not-applicable` used to remove every RULE-FE-* enforcement from the
// resolved policy with nothing verifying that against what actually changed
// — a degraded agent could write "not-applicable" and no script would
// disagree. This test locks in the fix: the validator now diffs the working
// tree (and, with --base-ref, the committed range) and refuses a
// not-applicable declaration that contradicts an unambiguous frontend- or
// backend-shaped file change.

import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const VALIDATOR = path.join(SCRIPT_DIR, "validate-applicability-contract.mjs");

let assertions = 0;

function git(cwd, args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
  }
  return result.stdout;
}

function write(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

const APPLICABILITY_NOT_APPLICABLE = [
  "# Applicability",
  "",
  "```text",
  "complexity: small",
  "criticality: standard",
  "frontend: not-applicable",
  "backend: not-applicable",
  "persistence: not-applicable",
  "public-api: unchanged",
  "auth: not-applicable",
  "tenancy: not-applicable",
  "concurrency: not-applicable",
  "migration: not-applicable",
  "new-service-or-subsystem: not-applicable",
  "material-operational-cost: not-applicable",
  "performance: not-applicable",
  "accessibility: not-applicable",
  "frontend-representative-gate: not-required",
  "backend-representative-gate: not-required",
  "browser-evidence: not-required",
  "contract-drift-check: not-applicable",
  "interface-contract: not-applicable",
  "interface-contract-kind: none",
  "interface-contract-type: none",
  "behavioral-ux: not-applicable",
  "behavioral-ux-risk: none",
  "outcome-evidence: not-applicable",
  "```",
  ""
].join("\n");

function run(cwd, extraArgs = []) {
  const result = spawnSync(
    process.execPath,
    [VALIDATOR, path.join(cwd, "applicability.md"), ...extraArgs],
    { cwd, encoding: "utf8" }
  );
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), "applicability-crosscheck-"));

try {
  git(root, ["init", "-q", "-b", "main"]);
  git(root, ["config", "user.email", "test@example.com"]);
  git(root, ["config", "user.name", "test"]);
  write(path.join(root, "README.md"), "seed\n");
  write(path.join(root, "applicability.md"), APPLICABILITY_NOT_APPLICABLE);
  git(root, ["add", "-A"]);
  git(root, ["commit", "-q", "-m", "seed"]);

  const seedCommit = git(root, ["rev-list", "--max-parents=0", "HEAD"]).trim();

  // 1. Clean tree, no diff at all: must pass.
  const clean = run(root);
  assert.equal(clean.status, 0, `A clean tree must pass.\n${clean.stdout}${clean.stderr}`);
  assertions += 1;

  // 2. An untracked .tsx file with frontend: not-applicable must fail.
  write(path.join(root, "src/components/Button.tsx"), "export const X = 1;\n");
  const frontendViolation = run(root);
  assert.notEqual(frontendViolation.status, 0, "An untracked .tsx file must fail frontend: not-applicable.");
  assert.match(frontendViolation.stdout, /frontend: not-applicable.*frontend-shaped/s);
  assert.match(frontendViolation.stdout, /Button\.tsx/);
  assertions += 3;

  // 3. A docs/frontend/ contract file must also trigger the frontend signal.
  fs.rmSync(path.join(root, "src"), { recursive: true, force: true });
  write(path.join(root, "docs/frontend/design-system/design-system.json"), "{}\n");
  const frontendDocsViolation = run(root);
  assert.notEqual(frontendDocsViolation.status, 0, "docs/frontend/ contract files must trigger the frontend signal.");
  assertions += 1;
  fs.rmSync(path.join(root, "docs"), { recursive: true, force: true });

  // 4. A Cargo.toml (backend signal) with backend: not-applicable must fail.
  write(path.join(root, "Cargo.toml"), "[package]\nname = \"x\"\n");
  const backendViolation = run(root);
  assert.notEqual(backendViolation.status, 0, "Cargo.toml must fail backend: not-applicable.");
  assert.match(backendViolation.stdout, /backend: not-applicable.*backend-shaped/s);
  assert.match(backendViolation.stdout, /Cargo\.toml/);
  assertions += 3;
  fs.rmSync(path.join(root, "Cargo.toml"));

  // 5. Ordinary non-signal churn must never trigger a false positive.
  write(path.join(root, "docs/notes.md"), "irrelevant change\n");
  write(path.join(root, "scripts/build.mjs"), "console.log(1);\n");
  const benign = run(root);
  assert.equal(benign.status, 0, `Non-frontend/backend file churn must not trigger the cross-check.\n${benign.stdout}`);
  assertions += 1;
  fs.rmSync(path.join(root, "docs"), { recursive: true, force: true });
  fs.rmSync(path.join(root, "scripts"), { recursive: true, force: true });

  write(path.join(root, "README.md"), "still innocuous\n");
  const readme = run(root);
  assert.equal(readme.status, 0, `An untracked README must not trip migration, auth, or tenancy signals.\n${readme.stdout}`);
  assertions += 1;

  write(path.join(root, "db/migrations/001.sql"), "select 1;\n");
  const migration = run(root);
  assert.notEqual(migration.status, 0, "migrations/ must contradict migration and persistence not-applicable.");
  assert.match(migration.stdout, /migrations\//);
  assertions += 2;
  fs.rmSync(path.join(root, "db"), { recursive: true, force: true });

  write(path.join(root, "src/auth/session.ts"), "export const session = true;\n");
  const auth = run(root);
  assert.notEqual(auth.status, 0, "auth/ must contradict auth: not-applicable.");
  assert.match(auth.stdout, /auth: not-applicable/);
  assertions += 2;
  fs.rmSync(path.join(root, "src"), { recursive: true, force: true });

  write(path.join(root, "src/tenancy/scope.ts"), "export const scope = true;\n");
  const tenancy = run(root);
  assert.notEqual(tenancy.status, 0, "tenancy/ must contradict tenancy: not-applicable.");
  assert.match(tenancy.stdout, /tenancy: not-applicable/);
  assertions += 2;
  fs.rmSync(path.join(root, "src"), { recursive: true, force: true });

  const originalApplicability = fs.readFileSync(path.join(root, "applicability.md"), "utf8");
  write(path.join(root, "applicability.md"), originalApplicability.replace("criticality: standard", "criticality: low").replace("auth: not-applicable", "auth: affected"));
  const lowCriticality = run(root);
  assert.notEqual(lowCriticality.status, 0, "criticality: low must fail when auth is affected.");
  assert.match(lowCriticality.stdout, /criticality: low/);
  assertions += 2;
  write(path.join(root, "applicability.md"), originalApplicability);

  const invalidBase = run(root, ["--base-ref", "missing-feature-base"]);
  assert.notEqual(invalidBase.status, 0, "Unavailable feature base must block"); assertions++;
  fs.mkdirSync(path.join(root, "apps/api"), { recursive: true });
  fs.writeFileSync(path.join(root, "apps/api/main.py"), "def handler(): pass\n");
  const pythonBackend = run(root);
  assert.notEqual(pythonBackend.status, 0, "Python backend directory contradicts backend not-applicable"); assertions++;
  fs.rmSync(path.join(root, "apps"), { recursive: true });

  fs.mkdirSync(path.join(root, "custom-service"));
  fs.writeFileSync(path.join(root, "custom-service/main.py"), "def handler(): pass\n");
  fs.writeFileSync(path.join(root, "context.json"), JSON.stringify({ baseCommit: seedCommit, frontendPaths: [], backendPaths: ["custom-service"] }));
  assert.notEqual(run(root, ["--base-ref", seedCommit, "--context", "context.json"]).status, 0, "Frozen project directories must detect other backend layouts"); assertions++;
  fs.rmSync(path.join(root, "custom-service"), { recursive: true }); fs.unlinkSync(path.join(root, "context.json"));

  // 6. Once a violation is committed, the default (uncommitted-only) diff
  // goes quiet again — this is expected, and is exactly why --base-ref exists.
  write(path.join(root, "src/components/Button.tsx"), "export const X = 1;\n");
  git(root, ["add", "-A"]);
  git(root, ["commit", "-q", "-m", "add tsx"]);
  const committedQuiet = run(root);
  assert.equal(committedQuiet.status, 0, "A committed violation must not appear in the default uncommitted-only diff.");
  assertions += 1;

  // 7. --base-ref against the seed commit must catch the same violation.
  const withBaseRef = run(root, ["--base-ref", seedCommit]);
  assert.notEqual(withBaseRef.status, 0, "--base-ref must surface a violation committed since that ref.");
  assert.match(withBaseRef.stdout, /Button\.tsx/);
  assertions += 2;

  // 8. --root lets the check target a project root other than cwd.
  const rootFlagResult = spawnSync(
    process.execPath,
    [VALIDATOR, path.join(root, "applicability.md"), "--root", root, "--base-ref", seedCommit],
    { cwd: os.tmpdir(), encoding: "utf8" }
  );
  assert.notEqual(rootFlagResult.status, 0, "--root must let the check run against a project root other than cwd.");
  assertions += 1;

  // 9. When the project root is not a Git repository at all, the check must
  // report itself as not-run rather than silently pass with no visibility,
  // and must block until the comparison is available.
  const noGitRoot = fs.mkdtempSync(path.join(os.tmpdir(), "applicability-no-git-"));
  write(path.join(noGitRoot, "applicability.md"), APPLICABILITY_NOT_APPLICABLE);
  const noGitResult = run(noGitRoot);
  assert.notEqual(noGitResult.status, 0, "A non-Git root must block rather than authorize an unverified applicability.");
  assert.match(noGitResult.stdout, /Diff cross-check not-run/);
  assertions += 2;
  fs.rmSync(noGitRoot, { recursive: true, force: true });

  console.log(`Applicability diff cross-check contract passed (${assertions} assertions).`);
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
