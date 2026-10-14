#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { compileProductDesignDecision } from "./product-design-control.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "../..");
const CONTROLLER = path.join(SCRIPT_DIR, "product-design-control.mjs");
const TEMP_DIR = path.join(SCRIPT_DIR, `.test-product-design-decision-${process.pid}`);
const EFFECTIVE_REF = path.relative(ROOT, path.join(TEMP_DIR, "effective-policy.json")).split(path.sep).join("/");
const INPUT_REF = path.relative(ROOT, path.join(TEMP_DIR, "input.json")).split(path.sep).join("/");
const OUTPUT_REF = path.relative(ROOT, path.join(TEMP_DIR, "output")).split(path.sep).join("/");
const HASH = "0".repeat(64);
let assertions = 0;

function candidate(id, overrides = {}) {
  return {
    id,
    thesis: `${id} organizes operational evidence around the dominant verification task and its trust boundary.`,
    signatureElement: `${id}-evidence-rail`,
    contextuality: {
      productSignals: ["audit trail", "policy provenance"],
      audienceSignals: ["operators compare exceptions before acting"],
      taskSignals: ["verify evidence then resolve the finding"]
    },
    criteria: [
      { id: "task-clarity", weight: 4, score: id === "contextual" ? 9 : 6, rationale: "Prioritizes the dominant verification sequence." },
      { id: "trust", weight: 3, score: id === "contextual" ? 9 : 7, rationale: "Keeps evidence beside the affected decision." },
      { id: "distinctiveness", weight: 2, score: id === "contextual" ? 8 : 5, rationale: "Uses a product-specific evidence rail." }
    ],
    risks: [{ id: "density", mitigation: "Progressive disclosure preserves scanability." }],
    evidenceRefs: ["evidence/visual-research.json", `evidence/${id}-comparison.json`],
    adoptedAspects: ["evidence adjacent to action"],
    excludedAspects: ["generic dashboard card grid"],
    rationale: `${id} best balances verification speed, trust and product specificity.`,
    canonicalContractMatch: true,
    contractRefs: [".specs/features/delegated-product-design-authority/07-design.md"],
    precedentMatch: false,
    precedentRefs: [],
    changeSize: 10,
    complexity: 4,
    riskSurface: 3,
    reversible: true,
    equivalenceEvidenceRefs: [],
    ...overrides
  };
}

function designInput(overrides = {}) {
  return {
    subject: { project: "spec-driven-development", commit: "39ed012" },
    feature: "delegated-product-design-authority",
    task: "T-PDA-501",
    stage: "implementation",
    effectivePolicyRef: EFFECTIVE_REF,
    humanGateRequired: false,
    brief: {
      semanticDigest: "1".repeat(64),
      product: { name: "Control Plane" },
      audience: { primary: "workflow operator" },
      task: { dominant: "verify evidence before resolving findings" }
    },
    research: {
      semanticDigest: "2".repeat(64),
      references: [{ id: "REF-001", adoptedAspects: ["evidence proximity"], excludedAspects: ["decorative metrics"] }]
    },
    candidates: [candidate("contextual"), candidate("generic")],
    evidence: [
      { source: "approved-product-context", ref: ".specs/features/delegated-product-design-authority/01-spec.md" },
      { source: "visual-research", ref: "evidence/visual-research.json" },
      { source: "candidate-comparison", ref: "evidence/direction-comparison.json" }
    ],
    ...overrides
  };
}

function autonomyDecision(overrides = {}) {
  return {
    artifactKind: "autonomy-decision-result",
    decisionId: "DEC-0123456789ABCDEF",
    decisionClass: "design-authority-bounded",
    disposition: "AUTONOMOUS_WITH_AUDIT",
    selectedOption: "contextual",
    reversible: true,
    evidenceRefs: [
      ".specs/features/delegated-product-design-authority/01-spec.md",
      "evidence/visual-research.json",
      "evidence/direction-comparison.json"
    ],
    policyProvenance: {
      autonomyPolicy: { ref: "prompts/spec-driven/autonomy-policy.json", sha256: "3".repeat(64) },
      effectivePolicy: { ref: EFFECTIVE_REF, sha256: "4".repeat(64) }
    },
    ...overrides
  };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

try {
  const valid = compileProductDesignDecision(designInput(), autonomyDecision());
  assert.deepEqual(valid.findings, []);
  assert.equal(valid.decision.artifactKind, "design-authority-decision");
  assert.equal(valid.decision.selectedCandidateId, "contextual");
  assert.equal(valid.decision.visualDirectionSelectedBy, "agent");
  assert.equal(valid.decision.autonomyDecisionId, "DEC-0123456789ABCDEF");
  assert.equal(valid.decision.alternatives.filter((item) => item.status === "selected").length, 1);
  assert.equal(valid.decision.alternatives.length, 2);
  assert.equal(valid.decision.criteria.length, 3);
  assert.ok(valid.decision.evidenceRefs.length >= 3);
  assertions += 9;

  const incomplete = compileProductDesignDecision(
    designInput({ candidates: [candidate("contextual", { thesis: "" }), candidate("generic")] }),
    autonomyDecision()
  );
  assert.ok(incomplete.findings.some((item) => item.id === "PDA-03"));
  assertions += 1;

  const generic = compileProductDesignDecision(
    designInput({ candidates: [candidate("contextual", { contextuality: { productSignals: [], audienceSignals: [], taskSignals: [] } }), candidate("generic")] }),
    autonomyDecision()
  );
  assert.ok(generic.findings.some((item) => item.id === "PDA-04"));
  assertions += 1;

  const human = compileProductDesignDecision(
    designInput(),
    autonomyDecision({ decisionClass: "brand-consequential", disposition: "HUMAN_REQUIRED", selectedOption: null, reversible: null })
  );
  assert.ok(human.findings.some((item) => item.id === "PDA-13"));
  assert.equal(human.decision, null);
  assertions += 2;

  writeJson(path.join(TEMP_DIR, "effective-policy.json"), {
    $schema: "integrations/governance/effective-policy.schema.json",
    schemaVersion: "1.0.0",
    artifactKind: "derived-effective-policy",
    canonical: false,
    stage: "implementation",
    feature: "delegated-product-design-authority",
    task: "T-PDA-501",
    applicability: { frontend: "substantial", backend: "not-applicable", behavioralUx: "applicable" },
    hardRules: ["RULE-SDE-ADMISSION-001"], defaults: [], advisories: [], escalations: [],
    requiredEnforcements: ["governance-rule-admission-validation"],
    sources: {
      governancePolicy: { ref: "prompts/spec-driven/governance-policy.json", sha256: HASH },
      capabilityRegistry: { ref: "integrations/governance/enforcement-capabilities.json", sha256: HASH },
      applicability: { ref: ".specs/features/delegated-product-design-authority/applicability.md", sha256: HASH }
    }
  });
  writeJson(path.join(TEMP_DIR, "input.json"), designInput());
  const cli = spawnSync(process.execPath, [
    CONTROLLER, "decide", "--root", ROOT, "--input", INPUT_REF, "--output-dir", OUTPUT_REF
  ], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  assert.equal(cli.status, 0, `decide CLI failed.\n${cli.stderr}`);
  const cliDecision = JSON.parse(fs.readFileSync(path.join(TEMP_DIR, "output", "design-authority-decision.json"), "utf8"));
  const ledger = JSON.parse(fs.readFileSync(path.join(TEMP_DIR, "output", "design-authority-autonomy-decision.json"), "utf8"));
  assert.equal(cliDecision.selectedCandidateId, "contextual");
  assert.equal(ledger.disposition, "AUTONOMOUS_WITH_AUDIT");
  assert.equal(ledger.selectedOption, "contextual");
  assertions += 4;

  console.log(`Product design decision regression suite passed (${assertions} assertions).`);
} finally {
  fs.rmSync(TEMP_DIR, { recursive: true, force: true });
}
