#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { sourceSnapshot } from "./execution-context.mjs";
import { beginFeature } from "./workflow-entry.mjs";

function git(cwd, args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `git ${args.join(" ")} failed`);
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), "source-snapshot-"));
try {
  git(root, ["init", "-q", "-b", "main"]);
  git(root, ["config", "user.email", "test@example.com"]);
  git(root, ["config", "user.name", "test"]);
  fs.writeFileSync(path.join(root, "README.md"), "seed\n");
  git(root, ["add", "README.md"]);
  git(root, ["commit", "-q", "-m", "seed"]);
  fs.mkdirSync(path.join(root, "nested-repo"));
  git(path.join(root, "nested-repo"), ["init", "-q", "-b", "main"]);

  const withDirectory = sourceSnapshot(root);
  assert.match(withDirectory, /^[a-f0-9]{64}$/);
  fs.writeFileSync(path.join(root, "note.txt"), "file\n");
  assert.notEqual(sourceSnapshot(root), withDirectory);

  fs.mkdirSync(path.join(root, ".specs/project"), { recursive: true });
  fs.writeFileSync(path.join(root, ".specs/project/workflow-entry.json"), "{}\n");
  const start = beginFeature({ root, feature: "snapshot-probe" });
  assert.equal(start.feature, "snapshot-probe");
  assert.equal(fs.existsSync(path.join(root, ".specs/features/snapshot-probe/execution-start.json")), true);
  console.log("source snapshot nested directory contract passed");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
