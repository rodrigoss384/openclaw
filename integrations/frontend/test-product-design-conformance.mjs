#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  canonicalProductDesignDigest,
  deriveProductDesignProfile,
  deriveProductDesignShadowComparison,
  evaluateProductDesignReadiness
} from "./product-design-control.mjs";

const PRODUCTS = [
  {
    id: "inventario-amc",
    source: "/home/rodrigo/Documentos/projetos/inventario-amc",
    commit: "ebe6aa8e90896e953925c14ccf137ef29be7e053"
  },
  {
    id: "radar-execucoes",
    source: "/home/rodrigo/Documentos/projetos/a2i",
    commit: "e674c0c06353b974a5c053f4ed64d96687e3c4c0"
  }
];
const policyDigest = "f".repeat(64);
let assertions = 0;

function git(cwd, args) {
  return spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function seal(artifactKind, subject, fields) {
  const value = { artifactKind, schemaVersion: "1.0.0", subject, ...fields };
  value.semanticDigest = canonicalProductDesignDigest(value);
  return value;
}

function localSources(root) {
  const candidates = [
    ["design-direction", "docs/frontend/design-direction.md"],
    ["design-system", "docs/frontend/design-system/design-system.json"],
    ["styling-authority", "docs/frontend/styling-authority.json"],
    ["product-context", "docs/frontend/product-context.md"]
  ];
  return candidates.filter(([, relativePath]) => fs.existsSync(path.join(root, relativePath)))
    .map(([kind, ref]) => ({ kind, ref, status: "observed" }));
}

for (const product of PRODUCTS) {
  assert.ok(fs.existsSync(path.join(product.source, ".git")), `${product.id}: authorized local repository is unavailable.`);
  assertions += 1;
  const before = git(product.source, ["status", "--porcelain=v1", "--untracked-files=all"]).stdout;
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), `product-design-conformance-${product.id}-`));
  const clone = path.join(temp, "repo");
  try {
    const cloned = spawnSync("git", ["clone", "--quiet", "--no-hardlinks", product.source, clone], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    assert.equal(cloned.status, 0, `${product.id}: disposable clone failed: ${cloned.stderr}`);
    const checkedOut = git(clone, ["checkout", "--quiet", product.commit]);
    assert.equal(checkedOut.status, 0, `${product.id}: fixed commit checkout failed: ${checkedOut.stderr}`);
    assert.equal(git(clone, ["rev-parse", "HEAD"]).stdout.trim(), product.commit, `${product.id}: pinned commit drifted.`);
    assertions += 3;

    const subject = { project: product.id, commit: product.commit };
    const profile = deriveProductDesignProfile({ subject, feature: "read-only-conformance", product: { name: product.id, maturity: "established" },
      changeMode: "conformance-read-only", context: { visitorMode: "Operate", emotional: "historical-baseline" }, localSources: localSources(clone), openCapabilities: ["open-web", "openverse"] });
    assert.equal(profile.findings.length, 0, `${product.id}: profile must not require paid/authenticated providers.`);
    assert.equal(profile.researchPlan.intensity, "targeted-research", `${product.id}: read-only conformance uses deterministic targeted fixtures.`);
    assertions += 2;

    const brief = seal("product-design-brief", subject, { feature: "read-only-conformance" });
    const research = seal("visual-research", subject, { briefDigest: brief.semanticDigest, network: { mode: "fixture", status: "passed" } });
    const decision = seal("design-authority-decision", subject, { briefDigest: brief.semanticDigest, researchDigest: research.semanticDigest, visualDirectionSelectedBy: "agent" });
    const gate = evaluateProductDesignReadiness({ subject, brief, research, decision, policyDigest });
    assert.equal(gate.readiness.status, "passed", `${product.id}: pinned clone must consume Product Design readiness without mutation.`);
    assert.equal(gate.readiness.visualDirectionSelectedBy, "agent");
    assertions += 2;

    const shadow = deriveProductDesignShadowComparison({ subject,
      legacy: { decisionKind: "aesthetic-approval", decisionOwner: "human" },
      controller: { visualDirectionSelectedBy: "agent", autonomyClass: "design-authority-bounded", disposition: "AUTONOMOUS_WITH_AUDIT" } });
    assert.equal(shadow.status, "passed", `${product.id}: shadow must expose the legacy aesthetic-approval delta.`);
    assert.equal(shadow.rollout.authority, "shadow");
    assertions += 2;
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
  const after = git(product.source, ["status", "--porcelain=v1", "--untracked-files=all"]).stdout;
  assert.equal(after, before, `${product.id}: original user worktree changed during Product Design conformance.`);
  assertions += 1;
}

console.log(`Product design conformance passed (${assertions} assertions; two pinned disposable clones; original statuses byte-equivalent).`);
