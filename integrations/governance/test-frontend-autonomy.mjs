#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "../..");
const ROUTER = path.join(SCRIPT_DIR, "frontend-autonomy.mjs");
const CONTROLLER = path.join(SCRIPT_DIR, "governance-control.mjs");
const TEMP_DIR = path.join(SCRIPT_DIR, `.test-frontend-autonomy-${process.pid}`);
const REQUEST_REF = repositoryRef(path.join(TEMP_DIR, "frontend-request.json"));
const ROUTED_REF = repositoryRef(path.join(TEMP_DIR, "routed.json"));
const DECISION_REF = repositoryRef(path.join(TEMP_DIR, "decision.json"));
const EFFECTIVE_REF = repositoryRef(path.join(TEMP_DIR, "effective-policy.json"));
const CONTRACT_REF = repositoryRef(path.join(TEMP_DIR, "product-context.json"));
const RECIPE_REF = repositoryRef(path.join(TEMP_DIR, "recipe.json"));
const SCREEN_REF = repositoryRef(path.join(TEMP_DIR, "screen.json"));
const DESIGN_SYSTEM_REF = repositoryRef(path.join(TEMP_DIR, "design-system.json"));
const CATALOG_REF = repositoryRef(path.join(TEMP_DIR, "component-catalog.json"));
const IMPLEMENTATION_REF = repositoryRef(path.join(TEMP_DIR, "component.jsx"));
const EQUIVALENCE_REF = repositoryRef(path.join(TEMP_DIR, "equivalence.json"));
const FINDING_ROUTE_REF = repositoryRef(path.join(TEMP_DIR, "finding-route.json"));
const EXPLICIT_ROUTE_REF = repositoryRef(path.join(TEMP_DIR, "explicit-route.json"));
const CONTRACT_ROUTE_REF = repositoryRef(path.join(TEMP_DIR, "contract-route.json"));
const RISK_REF = repositoryRef(path.join(TEMP_DIR, "risk.json"));
const TEST_FEATURE = `evh-frontend-autonomy-${process.pid}`;
const TEST_FEATURE_DIR = path.join(ROOT, ".specs/features", TEST_FEATURE);
fs.mkdirSync(TEST_FEATURE_DIR, { recursive: true });
let assertions = 0;

const HASH = "0".repeat(64);

function repositoryRef(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join("/");
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function effectivePolicy(overrides = {}) {
  return {
    $schema: "integrations/governance/effective-policy.schema.json",
    schemaVersion: "1.0.0",
    artifactKind: "derived-effective-policy",
    canonical: false,
    stage: "implementation",
    feature: TEST_FEATURE,
    task: "T-009F",
    applicability: {
      frontend: "not-applicable",
      backend: "not-applicable",
      behavioralUx: "not-applicable"
    },
    hardRules: ["RULE-SDE-ADMISSION-001"],
    defaults: [],
    advisories: [],
    escalations: [],
    requiredEnforcements: ["governance-rule-admission-validation"],
    sources: {
      governancePolicy: { ref: "prompts/spec-driven/governance-policy.json", sha256: HASH },
      capabilityRegistry: { ref: "integrations/governance/enforcement-capabilities.json", sha256: HASH },
      applicability: { ref: ".specs/features/phase9f-frontend-autonomy/applicability.md", sha256: HASH }
    },
    ...overrides
  };
}

function genericCandidate(id, binding, overrides = {}) {
  return {
    id,
    description: `Frontend candidate ${id}`,
    canonicalContractMatch: true,
    contractRefs: [CONTRACT_REF],
    precedentMatch: false,
    precedentRefs: [],
    changeSize: 3,
    complexity: 2,
    riskSurface: 2,
    objectiveScore: 80,
    reversible: true,
    evidenceRefs: [],
    equivalenceEvidenceRefs: [],
    binding,
    ...overrides
  };
}

function frontendRequest(choiceKind, candidates, overrides = {}) {
  return {
    $schema: "integrations/governance/frontend-autonomy.schema.json",
    schemaVersion: "1.0.0",
    artifactKind: "frontend-autonomy-request",
    choiceKind,
    stage: "implementation",
    feature: TEST_FEATURE,
    task: "T-009F",
    effectivePolicyRef: EFFECTIVE_REF,
    frontendCraftPolicyRef: "prompts/spec-driven/frontend-craft-policy.json",
    humanGateRequired: false,
    intendedEffects: {
      implementationOnly: ![
        "product-navigation-semantics",
        "new-capability",
        "commercial-capability",
        "brand-material",
        "legal",
        "behavioral-high-risk",
        "authentication-security-tenancy",
        "public-contract"
      ].includes(choiceKind),
      canonicalContractWrites: [],
      externalEffects: false
    },
    candidates,
    evidence: [],
    ...overrides
  };
}

function run(command, args) {
  return spawnSync(process.execPath, [command, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function route(request) {
  writeJson(path.join(TEMP_DIR, "frontend-request.json"), request);
  const result = run(ROUTER, ["route", "--root", ROOT, "--request", REQUEST_REF]);
  return result;
}

function routeAccepted(label, request) {
  const result = route(request);
  assert.equal(result.status, 0, `${label}: route failed.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  assertions += 1;
  return JSON.parse(result.stdout);
}

function routeRejected(label, request, expected) {
  const result = route(request);
  assert.notEqual(result.status, 0, `${label}: invalid frontend route was accepted.\n${result.stdout}`);
  assert.match(result.stderr, expected, `${label}: unexpected failure.\n${result.stderr}`);
  assertions += 2;
}

function decide(routed, effective = effectivePolicy()) {
  writeJson(path.join(TEMP_DIR, "effective-policy.json"), effective);
  writeJson(path.join(TEMP_DIR, "routed.json"), routed);
  const result = run(CONTROLLER, ["decide", "--root", ROOT, "--request", ROUTED_REF]);
  assert.equal(result.status, 0, `decide failed:\n${result.stdout}\n${result.stderr}`);
  assertions += 1;
  return JSON.parse(result.stdout);
}

function consume(decision) {
  writeJson(path.join(TEMP_DIR, "decision.json"), decision);
  const result = run(CONTROLLER, ["consume", "--root", ROOT, "--decision", DECISION_REF]);
  assert.equal(result.status, 0, `consume failed:\n${result.stdout}\n${result.stderr}`);
  assertions += 1;
  return JSON.parse(result.stdout);
}

function findingRoute({ defectKind = "implementation", command = "layout", governance = "managed", approval = false } = {}) {
  const contractRepair = defectKind === "contract";
  return {
    $schema: "finding-route.schema.json",
    schemaVersion: "1.0.0",
    generated: true,
    generatedAt: "2026-08-14T23:40:00-03:00",
    finding: {
      id: contractRepair ? "contract-drift" : "layout-drift",
      class: "spatial-density",
      defectKind,
      summary: contractRepair ? "Canonical layout contract is insufficient" : "Implementation drifted from the approved layout contract",
      source: "objective-audit"
    },
    route: {
      class: "spatial-density",
      owner: "frontend-product-builder",
      affectedContracts: ["recipe", "screen-specification", "composition-proof"],
      repairStrategy: contractRepair ? "canonical-contract-repair" : "targeted-implementation-repair",
      providerCommand: command === null ? null : {
        name: command,
        governance,
        requiresExplicitApproval: approval
      },
      returnStage: contractRepair ? "DESIGN_READINESS" : "PATCH",
      revalidationSet: ["craft-contract", "composition-proof", "browser-evidence", "impeccable-detector"],
      rationale: contractRepair ? "Return to the canonical owner." : "Repair only the bounded implementation drift."
    }
  };
}

function consequentialCandidate(id = "human-option") {
  return genericCandidate(id, { kind: "consequential", authorityRef: CONTRACT_REF }, {
    reversible: false,
    riskSurface: 8
  });
}

try {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
  writeJson(path.join(TEMP_DIR, "effective-policy.json"), effectivePolicy());
  writeJson(path.join(TEMP_DIR, "product-context.json"), { status: "approved", navigation: { mode: "existing" } });
  writeJson(path.join(TEMP_DIR, "recipe.json"), { id: "dashboard", responsive: ["compact", "wide"] });
  writeJson(path.join(TEMP_DIR, "screen.json"), { screen: { id: "dashboard" }, recipe: "dashboard" });
  writeJson(path.join(TEMP_DIR, "design-system.json"), { meta: { status: "approved" }, tokens: { spacing: { sm: "8px", md: "16px" } } });
  writeJson(path.join(TEMP_DIR, "component-catalog.json"), {
    meta: { status: "approved" },
    components: {
      button: {
        status: "stable",
        variants: {
          primary: { intent: "primary action" },
          secondary: { intent: "secondary action" }
        }
      }
    }
  });
  fs.writeFileSync(path.join(TEMP_DIR, "component.jsx"), "export function Component(){ return null; }\n");
  writeJson(path.join(TEMP_DIR, "equivalence.json"), { equivalent: true });
  writeJson(path.join(TEMP_DIR, "risk.json"), { risk: "human review required" });
  writeJson(path.join(TEMP_DIR, "finding-route.json"), findingRoute());
  writeJson(path.join(TEMP_DIR, "explicit-route.json"), findingRoute({ command: "quieter", governance: "explicitApproval", approval: true }));
  writeJson(path.join(TEMP_DIR, "contract-route.json"), findingRoute({ defectKind: "contract", command: null }));

  const refactor = routeAccepted("reversible-refactor", frontendRequest("reversible-refactor", [
    genericCandidate("refactor-small", { kind: "reversible-refactor", implementationRef: IMPLEMENTATION_REF }, {
      evidenceRefs: [IMPLEMENTATION_REF]
    })
  ]));
  assert.equal(refactor.decisionClass, "reversible-internal");
  assertions += 1;
  const refactorDecision = decide(refactor);
  assert.equal(refactorDecision.disposition, "SAFE_AUTONOMOUS");
  assertions += 1;
  const refactorDirective = consume(refactorDecision);
  assert.equal(refactorDirective.action, "execute");
  assert.equal(refactorDirective.askHuman, false);
  assertions += 2;

  const responsive = routeAccepted("responsive-layout", frontendRequest("responsive-layout-within-recipe", [
    genericCandidate("compact-layout", { kind: "responsive-layout-within-recipe", recipeRef: RECIPE_REF, screenSpecRef: SCREEN_REF }, {
      contractRefs: [CONTRACT_REF, RECIPE_REF, SCREEN_REF]
    })
  ]));
  assert.equal(responsive.decisionClass, "reversible-contract-bounded");
  assertions += 1;
  const responsiveDecision = decide(responsive);
  assert.equal(responsiveDecision.disposition, "AUTONOMOUS_WITH_AUDIT");
  assertions += 1;
  const responsiveDirective = consume(responsiveDecision);
  assert.equal(responsiveDirective.action, "record-and-execute");
  assert.equal(responsiveDirective.askHuman, false);
  assertions += 2;

  const spacing = routeAccepted("existing-spacing-token", frontendRequest("existing-spacing-token", [
    genericCandidate("spacing-sm", { kind: "existing-spacing-token", designSystemRef: DESIGN_SYSTEM_REF, tokenPointer: "/tokens/spacing/sm" }, {
      contractRefs: [CONTRACT_REF, DESIGN_SYSTEM_REF]
    })
  ]));
  assert.equal(spacing.decisionClass, "reversible-contract-bounded");
  assert.equal(decide(spacing).disposition, "AUTONOMOUS_WITH_AUDIT");
  assertions += 2;

  const variant = routeAccepted("component-variant", frontendRequest("component-variant", [
    genericCandidate("primary", { kind: "component-variant", componentCatalogRef: CATALOG_REF, componentId: "button", variantId: "primary" }, {
      contractRefs: [CONTRACT_REF, CATALOG_REF],
      equivalenceEvidenceRefs: [EQUIVALENCE_REF]
    })
  ]));
  assert.equal(variant.decisionClass, "equivalent-variant");
  assert.equal(decide(variant).disposition, "AUTONOMOUS_WITH_AUDIT");
  assertions += 2;

  const repair = routeAccepted("craft-implementation-repair", frontendRequest("craft-implementation-repair", [
    genericCandidate("patch-layout", { kind: "craft-implementation-repair", findingRouteRef: FINDING_ROUTE_REF }, {
      evidenceRefs: [FINDING_ROUTE_REF]
    })
  ]));
  assert.equal(repair.decisionClass, "reversible-contract-bounded");
  assert.equal(decide(repair).disposition, "AUTONOMOUS_WITH_AUDIT");
  assertions += 2;

  const provider = routeAccepted("allowed-provider-command", frontendRequest("allowed-provider-command", [
    genericCandidate("layout-command", { kind: "allowed-provider-command", findingRouteRef: FINDING_ROUTE_REF, command: "layout" }, {
      evidenceRefs: [FINDING_ROUTE_REF]
    })
  ]));
  assert.equal(provider.decisionClass, "reversible-contract-bounded");
  assert.equal(decide(provider).disposition, "AUTONOMOUS_WITH_AUDIT");
  assertions += 2;

  for (const [choiceKind, expectedClass] of [
    ["product-navigation-semantics", "product-consequential"],
    ["new-capability", "product-consequential"],
    ["commercial-capability", "product-consequential"],
    ["brand-material", "brand-consequential"],
    ["legal", "legal-consequential"],
    ["behavioral-high-risk", "behavioral-high-risk"],
    ["authentication-security-tenancy", "security-consequential"],
    ["public-contract", "product-consequential"]
  ]) {
    const routed = routeAccepted(`consequential-${choiceKind}`, frontendRequest(choiceKind, [consequentialCandidate()], {
      evidence: [{ source: "risk-assessment", ref: RISK_REF }]
    }));
    assert.equal(routed.decisionClass, expectedClass, `${choiceKind}: wrong decision class`);
    const decision = decide(routed);
    assert.equal(decision.disposition, "HUMAN_REQUIRED", `${choiceKind}: must remain human-controlled`);
    assert.equal(decision.selectedOption, null, `${choiceKind}: human decision cannot be preselected`);
    assertions += 3;
  }

  const existingHumanGate = routeAccepted("existing-human-gate", frontendRequest("reversible-refactor", [
    genericCandidate("refactor-gated", { kind: "reversible-refactor", implementationRef: IMPLEMENTATION_REF }, {
      evidenceRefs: [IMPLEMENTATION_REF]
    })
  ], { humanGateRequired: true }));
  assert.equal(decide(existingHumanGate).disposition, "HUMAN_REQUIRED");
  assertions += 1;

  const escalated = routeAccepted("effective-policy-escalation", frontendRequest("reversible-refactor", [
    genericCandidate("refactor-escalated", { kind: "reversible-refactor", implementationRef: IMPLEMENTATION_REF }, {
      evidenceRefs: [IMPLEMENTATION_REF]
    })
  ]));
  assert.equal(decide(escalated, effectivePolicy({ escalations: ["RULE-SDE-PLACEHOLDER-001"] })).disposition, "HUMAN_REQUIRED");
  assertions += 1;

  routeRejected("canonical-contract-write-bypass", frontendRequest("reversible-refactor", [
    genericCandidate("write-contract", { kind: "reversible-refactor", implementationRef: IMPLEMENTATION_REF }, { evidenceRefs: [IMPLEMENTATION_REF] })
  ], {
    intendedEffects: { implementationOnly: true, canonicalContractWrites: [CONTRACT_REF], externalEffects: false }
  }), /cannot write canonical contracts/);

  routeRejected("external-effect-bypass", frontendRequest("reversible-refactor", [
    genericCandidate("external", { kind: "reversible-refactor", implementationRef: IMPLEMENTATION_REF }, { evidenceRefs: [IMPLEMENTATION_REF] })
  ], {
    intendedEffects: { implementationOnly: true, canonicalContractWrites: [], externalEffects: true }
  }), /cannot create external effects/);

  routeRejected("contract-finding-not-autonomous", frontendRequest("craft-implementation-repair", [
    genericCandidate("contract-repair", { kind: "craft-implementation-repair", findingRouteRef: CONTRACT_ROUTE_REF }, {
      evidenceRefs: [CONTRACT_ROUTE_REF]
    })
  ]), /canonical contract repair is not autonomous/);

  routeRejected("explicit-provider-command-not-autonomous", frontendRequest("allowed-provider-command", [
    genericCandidate("quieter-command", { kind: "allowed-provider-command", findingRouteRef: EXPLICIT_ROUTE_REF, command: "quieter" }, {
      evidenceRefs: [EXPLICIT_ROUTE_REF]
    })
  ]), /is not autonomous/);

  routeRejected("provider-command-mismatch", frontendRequest("allowed-provider-command", [
    genericCandidate("typeset-command", { kind: "allowed-provider-command", findingRouteRef: FINDING_ROUTE_REF, command: "typeset" }, {
      evidenceRefs: [FINDING_ROUTE_REF]
    })
  ]), /does not match the Finding Router command/);

  routeRejected("missing-token", frontendRequest("existing-spacing-token", [
    genericCandidate("missing-token", { kind: "existing-spacing-token", designSystemRef: DESIGN_SYSTEM_REF, tokenPointer: "/tokens/spacing/xl" }, {
      contractRefs: [CONTRACT_REF, DESIGN_SYSTEM_REF]
    })
  ]), /does not resolve in the approved Design System/);

  routeRejected("missing-variant", frontendRequest("component-variant", [
    genericCandidate("ghost", { kind: "component-variant", componentCatalogRef: CATALOG_REF, componentId: "button", variantId: "ghost" }, {
      contractRefs: [CONTRACT_REF, CATALOG_REF],
      equivalenceEvidenceRefs: [EQUIVALENCE_REF]
    })
  ]), /variant 'ghost' does not exist/);

  routeRejected("binding-kind-laundering", frontendRequest("reversible-refactor", [
    genericCandidate("wrong-binding", { kind: "consequential", authorityRef: CONTRACT_REF })
  ]), /binding.kind 'consequential' does not match choiceKind 'reversible-refactor'/);

  const draftCatalog = JSON.parse(fs.readFileSync(path.join(TEMP_DIR, "component-catalog.json"), "utf8"));
  draftCatalog.meta.status = "draft";
  writeJson(path.join(TEMP_DIR, "component-catalog.json"), draftCatalog);
  routeRejected("draft-catalog", frontendRequest("component-variant", [
    genericCandidate("primary", { kind: "component-variant", componentCatalogRef: CATALOG_REF, componentId: "button", variantId: "primary" }, {
      contractRefs: [CONTRACT_REF, CATALOG_REF],
      equivalenceEvidenceRefs: [EQUIVALENCE_REF]
    })
  ]), /component catalog must be approved/);

  console.log(`Frontend autonomy integration Phase 9F regression suite passed (${assertions} assertions).`);
} finally {
  fs.rmSync(TEST_FEATURE_DIR, { recursive: true, force: true });
  fs.rmSync(TEMP_DIR, { recursive: true, force: true });
}
