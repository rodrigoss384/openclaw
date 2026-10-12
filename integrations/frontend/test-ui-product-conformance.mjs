#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { lintReactTailwindSource } from "./ui-engineering-control.mjs";

const CASES = [
  {
    id: "inventario-amc",
    source: "/home/rodrigo/Documentos/projetos/inventario-amc",
    commit: "ebe6aa8e90896e953925c14ccf137ef29be7e053",
    expected: ["UI-01", "UI-05", "UI-06", "UI-SOURCE-INLINE-STYLE"],
    historicalScreenshot: { attribution: "historical-unattributed", sourceClassAttributionAllowed: false }
  },
  {
    id: "radar-execucoes",
    source: "/home/rodrigo/Documentos/projetos/a2i",
    commit: "e674c0c06353b974a5c053f4ed64d96687e3c4c0",
    expected: ["UI-02", "UI-06", "UI-07", "UI-08", "UI-10", "UI-12"]
  }
];
let assertions = 0;

function git(cwd, args) {
  return spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8" });
}

function sourceFiles(root) {
  const result = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if ([".git", "node_modules", "dist", "build", "coverage", "generated"].includes(entry.name)) continue;
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(target);
      else if (/\.(?:jsx|tsx)$/.test(entry.name) && !/\.(?:spec|test)\.[jt]sx$/.test(entry.name)) result.push(target);
    }
  };
  visit(root);
  return result.sort();
}

for (const product of CASES) {
  assert.ok(fs.existsSync(path.join(product.source, ".git")), `${product.id}: authorized local repository is unavailable.`);
  assertions += 1;
  const before = git(product.source, ["status", "--porcelain=v1"]).stdout;
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), `ui-conformance-${product.id}-`));
  const clone = path.join(temp, "repo");
  try {
    const cloned = spawnSync("git", ["clone", "--quiet", "--no-hardlinks", product.source, clone], { encoding: "utf8" });
    assert.equal(cloned.status, 0, `${product.id}: disposable clone failed: ${cloned.stderr}`);
    assertions += 1;
    const checkedOut = git(clone, ["checkout", "--quiet", product.commit]);
    assert.equal(checkedOut.status, 0, `${product.id}: fixed commit checkout failed: ${checkedOut.stderr}`);
    assertions += 1;
    assert.equal(git(clone, ["rev-parse", "HEAD"]).stdout.trim(), product.commit, `${product.id}: conformance commit drifted.`);
    assertions += 1;

    const findings = sourceFiles(clone).flatMap((file) =>
      lintReactTailwindSource(fs.readFileSync(file, "utf8"), { locale: { catalog: [] } }).findings
        .map((finding) => ({ ...finding, sourceRef: path.relative(clone, file) }))
    );
    const ids = new Set(findings.map((finding) => finding.id));
    for (const expected of product.expected) {
      assert.ok(ids.has(expected), `${product.id}@${product.commit}: expected ${expected}; observed ${[...ids].sort().join(", ")}`);
      assertions += 1;
    }
    if (product.historicalScreenshot) {
      assert.equal(product.historicalScreenshot.attribution, "historical-unattributed");
      assert.equal(product.historicalScreenshot.sourceClassAttributionAllowed, false);
      assertions += 2;
    }
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
  const after = git(product.source, ["status", "--porcelain=v1"]).stdout;
  assert.equal(after, before, `${product.id}: original user worktree changed during conformance.`);
  assertions += 1;
}

console.log(`UI product conformance tests passed (${assertions} assertions).`);
