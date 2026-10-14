#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validateProductSemanticsEvidence } from "./product-semantics-evidence.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "../..");
const CLI = path.join(SCRIPT_DIR, "product-semantics-evidence.mjs");
const PHASE5_WRAPPER = path.join(ROOT, "skills/frontend-product-builder/scripts/audit-theme-operational-evidence.mjs");
const PROMPT_REPRESENTATIVE = path.join(ROOT, "prompts/spec-driven/07.1-frontend-representative-gate.prompt.md");
const PROMPT_EVIDENCE = path.join(ROOT, "prompts/spec-driven/09-validate-evidence.prompt.md");

let assertions = 0;
function ok(value, message) { assertions += 1; assert.ok(value, message); }
function equal(left, right, message) { assertions += 1; assert.equal(left, right, message); }

function write(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`);
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function touch(root, ref, content = "evidence\n") {
  write(path.join(root, ref), content);
  return ref;
}

function signature(variantRole, semanticColorRole, shapeRole, textRole) {
  return { variantRole, semanticColorRole, shapeRole, textRole };
}

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "phase10d-product-semantics-"));
  const screenRef = "docs/frontend/screens/application-shell/screen-spec.json";
  const navRef = "docs/frontend/navigation-capabilities.json";
  const retrievalRef = "docs/frontend/global-retrieval.json";
  const companionRef = "docs/frontend/screens/application-shell/product-semantics-evidence.json";
  const productContextRef = touch(root, "docs/frontend/product-context.md", "# Product Context\n");

  touch(root, "docs/product/modules/cases.md");
  touch(root, "docs/product/modules/clients.md");
  touch(root, "docs/product/entities/cases.md");
  touch(root, "docs/product/entities/clients.md");
  touch(root, "docs/backend/openapi.yaml", "openapi: 3.1.0\n");
  touch(root, "docs/backend/auth.md");
  touch(root, "tests/global-retrieval-tenant-negative.test.ts");
  touch(root, "docs/backend/rate-limit.md");
  touch(root, "docs/backend/retrieval-ranking.md");
  touch(root, "docs/backend/sensitive-data.md");
  touch(root, "tests/global-retrieval.integration.test.ts");

  const screen = {
    screen: { id: "application-shell", category: "application-shell", surface: "application-shell" },
    productContext: {
      source: productContextRef,
      permissions: [
        { capability: "cases.view", frontendTreatment: "allowed" },
        { capability: "clients.view", frontendTreatment: "allowed" }
      ]
    },
    architecture: { integrationContracts: [navRef, retrievalRef] },
    recipe: { id: "application-shell" },
    actions: [
      { id: "nav-cases", kind: "navigation", permission: "cases.view", label: "Cases", targetRoute: "/cases" },
      { id: "nav-clients", kind: "navigation", permission: "clients.view", label: "Clients", targetRoute: "/clients" }
    ]
  };
  write(path.join(root, screenRef), screen);

  const navigation = {
    $schema: "../../integrations/frontend/navigation-capability.schema.json",
    schemaVersion: "1.0.0",
    status: "implemented",
    owner: "product-team",
    productContextRef,
    applicationShellScreenRef: screenRef,
    navigationMode: "multi-module",
    modules: [
      {
        id: "cases",
        label: "Cases",
        capabilityRef: "cases.view",
        availability: "active",
        presentation: "navigate",
        sourceRef: "docs/product/modules/cases.md",
        route: "/cases",
        roadmapRef: null,
        commercialCapabilityRef: null,
        behavioralUxRef: null,
        reason: null
      },
      {
        id: "clients",
        label: "Clients",
        capabilityRef: "clients.view",
        availability: "active",
        presentation: "navigate",
        sourceRef: "docs/product/modules/clients.md",
        route: "/clients",
        roadmapRef: null,
        commercialCapabilityRef: null,
        behavioralUxRef: null,
        reason: null
      }
    ]
  };
  write(path.join(root, navRef), navigation);

  const backendRef = "docs/backend/global-retrieval-contract.json";
  const backend = {
    $schema: "../../integrations/frontend/global-retrieval-backend.schema.json",
    schemaVersion: "1.0.0",
    artifactKind: "global-retrieval-backend-contract",
    status: "implemented",
    owner: "backend-team",
    sourceRef: "docs/backend/openapi.yaml",
    authorizationMode: "backend-authoritative-query-scope",
    authentication: { required: true, mechanismRef: "docs/backend/auth.md" },
    tenantIsolation: {
      required: true,
      scopeKey: "tenantId",
      enforcementPoint: "retrieval-query",
      negativeTestRef: "tests/global-retrieval-tenant-negative.test.ts"
    },
    limits: { maxQueryLength: 128, maxResults: 20, rateLimitRef: "docs/backend/rate-limit.md" },
    ranking: { strategyRef: "docs/backend/retrieval-ranking.md", deterministicTieBreak: "entityType,id" },
    timeoutMs: 1500,
    sensitiveDataHandling: {
      policyRef: "docs/backend/sensitive-data.md",
      redactionMode: "omit-unauthorized",
      forbiddenFields: ["secretNote"]
    },
    evidenceRefs: ["tests/global-retrieval.integration.test.ts"]
  };
  write(path.join(root, backendRef), backend);

  const retrieval = {
    $schema: "../../integrations/frontend/global-retrieval.schema.json",
    schemaVersion: "1.0.0",
    artifactKind: "global-retrieval-applicability",
    status: "implemented",
    owner: "product-team",
    productContextRef,
    applicationShellScreenRef: screenRef,
    applicability: "required",
    applicabilityBasis: {
      transversalRetrieval: true,
      multipleEntityTypes: true,
      recurringQuickFind: true,
      operationalHighFrequency: false
    },
    reason: "Operators repeatedly retrieve cases and clients across product areas.",
    searchableEntityTypes: [
      { id: "case", label: "Case", sourceRef: "docs/product/entities/cases.md", capabilityRef: "cases.view", sensitivity: "ordinary" },
      { id: "client", label: "Client", sourceRef: "docs/product/entities/clients.md", capabilityRef: "clients.view", sensitivity: "restricted" }
    ],
    invocation: {
      mode: "command-menu",
      globalEntryRequired: true,
      accessibleTriggerRequired: true,
      focusManagementRequired: true
    },
    shortcut: "Ctrl+P",
    authorizationMode: "backend-authoritative-query-scope",
    resultContract: {
      requiredStates: ["loading", "empty", "error", "results"],
      requiredSemanticFields: ["entityType", "primaryLabel", "destination"],
      destinationResolution: "route",
      authorizationLeakageAllowed: false,
      resultAnnouncementRequired: true
    },
    backendContractRef: backendRef,
    evidence: [
      { signal: "transversal-retrieval", sourceRef: productContextRef, statement: "Retrieval crosses product areas." },
      { signal: "multiple-entity-types", sourceRef: productContextRef, statement: "Cases and clients are retrieved." },
      { signal: "recurring-quick-find", sourceRef: productContextRef, statement: "Quick find is recurring." }
    ]
  };
  write(path.join(root, retrievalRef), retrieval);

  const designSystem = {
    visualGrammar: {
      perceptualPolicy: {
        presentationRoles: {
          phase: { presentationSignature: signature("phase-step", "info", "pill", "label") },
          status: { presentationSignature: signature("status-badge", "success", "badge", "bodyStrong") }
        },
        semanticDifferentiation: {
          roles: ["phase", "status"],
          dimensions: ["variantRole", "semanticColorRole", "shapeRole", "textRole"],
          minimumDistinctDimensions: 2,
          colorOnlyAllowed: false
        }
      }
    }
  };
  const craft = {
    dimensions: {
      semanticPresentation: {
        assignments: [
          { targetId: "phase-chip", semanticRole: "phase", presentationSignature: signature("phase-step", "info", "pill", "label") },
          { targetId: "status-chip", semanticRole: "status", presentationSignature: signature("status-badge", "success", "badge", "bodyStrong") }
        ]
      }
    }
  };
  const evidence = {
    meta: { screenId: "application-shell", stateId: "results" },
    elements: [
      { componentUsageId: "phase-chip", rendered: true },
      { componentUsageId: "status-chip", rendered: true }
    ],
    presenceSignals: [{ signal: "productSemantics.evidenceRef", value: companionRef }]
  };
  const companion = {
    $schema: "../../../../integrations/frontend/product-semantics-evidence.schema.json",
    schemaVersion: "1.0.0",
    artifactKind: "product-semantics-evidence",
    status: "captured",
    screenId: "application-shell",
    stateId: "results",
    semanticDifferentiation: {
      applicability: "required",
      observations: [
        { componentUsageId: "phase-chip", semanticRole: "phase", rendered: true, presentationSignature: signature("phase-step", "info", "pill", "label") },
        { componentUsageId: "status-chip", semanticRole: "status", rendered: true, presentationSignature: signature("status-badge", "success", "badge", "bodyStrong") }
      ]
    },
    navigation: {
      applicability: "required",
      contractRef: navRef,
      contractSha256: sha256(path.join(root, navRef)),
      modules: [
        { id: "cases", capabilityRef: "cases.view", availability: "active", presentation: "navigate", rendered: true, navigable: true, destination: "/cases", reasonVisible: false },
        { id: "clients", capabilityRef: "clients.view", availability: "active", presentation: "navigate", rendered: true, navigable: true, destination: "/clients", reasonVisible: false }
      ]
    },
    globalRetrieval: {
      applicability: "required",
      contractRef: retrievalRef,
      contractSha256: sha256(path.join(root, retrievalRef)),
      trigger: {
        rendered: true,
        invocationMode: "command-menu",
        accessibleName: "Search across product",
        focusManaged: true,
        shortcutObserved: "Ctrl+P"
      },
      observedState: "results",
      resultAuthorization: {
        authorizationMode: "backend-authoritative-query-scope",
        authorizationFiltered: true,
        tenantScopeValidated: true,
        unauthorizedResultCount: 0,
        resultAnnouncementObserved: true,
        observedEntityTypes: ["case", "client"],
        authorizationEvidenceRefs: [
          "tests/global-retrieval-tenant-negative.test.ts",
          "tests/global-retrieval.integration.test.ts"
        ]
      }
    }
  };
  write(path.join(root, companionRef), companion);
  write(path.join(root, "design-system.json"), designSystem);
  write(path.join(root, "craft.json"), craft);
  write(path.join(root, "evidence.json"), evidence);

  return { root, screenRef, navRef, retrievalRef, companionRef, screen, designSystem, craft, evidence, companion };
}

function validate(fixture, companion = fixture.companion, evidence = fixture.evidence) {
  write(path.join(fixture.root, fixture.companionRef), companion);
  return validateProductSemanticsEvidence({
    root: fixture.root,
    screenRef: fixture.screenRef,
    screen: fixture.screen,
    designSystem: fixture.designSystem,
    craft: fixture.craft,
    evidence
  });
}

function expectCode(fixture, name, mutate, code) {
  const candidate = structuredClone(fixture.companion);
  mutate(candidate);
  const errors = validate(fixture, candidate);
  ok(errors.some((error) => error.code === code), `${name}: expected ${code}, got ${JSON.stringify(errors)}`);
  write(path.join(fixture.root, fixture.companionRef), fixture.companion);
}

const fixture = setup();
const validErrors = validate(fixture);
equal(validErrors.length, 0, `valid product semantics evidence should pass: ${JSON.stringify(validErrors)}`);

const cli = spawnSync(process.execPath, [
  CLI,
  "--root", fixture.root,
  "--screen", fixture.screenRef,
  "--design-system", "design-system.json",
  "--craft", "craft.json",
  "--evidence", "evidence.json"
], { cwd: fixture.root, encoding: "utf8" });
equal(cli.status, 0, `CLI should pass. stdout=${cli.stdout} stderr=${cli.stderr}`);
ok(cli.stdout.includes("Product semantics evidence valid"), "CLI should report valid product semantics evidence");

const missingRefEvidence = structuredClone(fixture.evidence);
missingRefEvidence.presenceSignals = [];
const missingRefErrors = validateProductSemanticsEvidence({
  root: fixture.root,
  screenRef: fixture.screenRef,
  screen: fixture.screen,
  designSystem: fixture.designSystem,
  craft: fixture.craft,
  evidence: missingRefEvidence
});
ok(missingRefErrors.some((error) => error.code === "PRODUCT_SEMANTICS_EVIDENCE_REF_MISSING"), "relevant Phase 10 semantics require the companion evidence ref");

const missingFileEvidence = structuredClone(fixture.evidence);
missingFileEvidence.presenceSignals[0].value = "docs/frontend/screens/application-shell/missing-product-semantics.json";
const missingFileErrors = validateProductSemanticsEvidence({
  root: fixture.root,
  screenRef: fixture.screenRef,
  screen: fixture.screen,
  designSystem: fixture.designSystem,
  craft: fixture.craft,
  evidence: missingFileEvidence
});
ok(missingFileErrors.some((error) => error.code === "PRODUCT_SEMANTICS_REF_MISSING"), "missing companion file must fail");

expectCode(fixture, "screen drift", (c) => { c.screenId = "other-screen"; }, "PRODUCT_SEMANTICS_SCREEN_DRIFT");
expectCode(fixture, "state drift", (c) => { c.stateId = "loading"; }, "PRODUCT_SEMANTICS_STATE_DRIFT");
expectCode(fixture, "semantic applicability", (c) => { c.semanticDifferentiation.applicability = "not-applicable"; }, "PRODUCT_SEMANTICS_SIGNATURE_REQUIRED");
expectCode(fixture, "semantic missing observation", (c) => { c.semanticDifferentiation.observations.pop(); }, "PRODUCT_SEMANTICS_SIGNATURE_OBSERVATION_MISSING");
expectCode(fixture, "semantic role drift", (c) => { c.semanticDifferentiation.observations[0].semanticRole = "status"; }, "PRODUCT_SEMANTICS_SIGNATURE_ROLE_DRIFT");
expectCode(fixture, "semantic signature drift", (c) => { c.semanticDifferentiation.observations[0].presentationSignature.variantRole = "wrong"; }, "PRODUCT_SEMANTICS_SIGNATURE_DRIFT");
expectCode(fixture, "semantic render drift", (c) => { c.semanticDifferentiation.observations[0].rendered = false; }, "PRODUCT_SEMANTICS_SIGNATURE_RENDER_DRIFT");
expectCode(fixture, "navigation applicability", (c) => { c.navigation.applicability = "not-applicable"; }, "PRODUCT_SEMANTICS_NAVIGATION_REQUIRED");
expectCode(fixture, "navigation ref drift", (c) => { c.navigation.contractRef = fixture.retrievalRef; }, "PRODUCT_SEMANTICS_NAVIGATION_REF_DRIFT");
expectCode(fixture, "navigation hash drift", (c) => { c.navigation.contractSha256 = "0".repeat(64); }, "PRODUCT_SEMANTICS_NAVIGATION_HASH_DRIFT");
expectCode(fixture, "navigation missing module", (c) => { c.navigation.modules.pop(); }, "PRODUCT_SEMANTICS_NAVIGATION_MODULE_MISSING");
expectCode(fixture, "navigation capability drift", (c) => { c.navigation.modules[0].capabilityRef = "wrong.view"; }, "PRODUCT_SEMANTICS_NAVIGATION_STATE_DRIFT");
expectCode(fixture, "navigation active not rendered", (c) => { c.navigation.modules[0].rendered = false; }, "PRODUCT_SEMANTICS_NAVIGATION_ACTIVE_DRIFT");
expectCode(fixture, "navigation active not navigable", (c) => { c.navigation.modules[0].navigable = false; }, "PRODUCT_SEMANTICS_NAVIGATION_ACTIVE_DRIFT");
expectCode(fixture, "navigation destination drift", (c) => { c.navigation.modules[0].destination = "/other"; }, "PRODUCT_SEMANTICS_NAVIGATION_ACTIVE_DRIFT");
expectCode(fixture, "retrieval applicability", (c) => { c.globalRetrieval.applicability = "optional"; }, "PRODUCT_SEMANTICS_RETRIEVAL_APPLICABILITY_DRIFT");
expectCode(fixture, "retrieval ref drift", (c) => { c.globalRetrieval.contractRef = fixture.navRef; }, "PRODUCT_SEMANTICS_RETRIEVAL_REF_DRIFT");
expectCode(fixture, "retrieval hash drift", (c) => { c.globalRetrieval.contractSha256 = "f".repeat(64); }, "PRODUCT_SEMANTICS_RETRIEVAL_HASH_DRIFT");
expectCode(fixture, "retrieval trigger missing", (c) => { c.globalRetrieval.trigger = null; }, "PRODUCT_SEMANTICS_RETRIEVAL_TRIGGER_MISSING");
expectCode(fixture, "retrieval trigger hidden", (c) => { c.globalRetrieval.trigger.rendered = false; }, "PRODUCT_SEMANTICS_RETRIEVAL_TRIGGER_NOT_RENDERED");
expectCode(fixture, "retrieval invocation drift", (c) => { c.globalRetrieval.trigger.invocationMode = "global-header"; }, "PRODUCT_SEMANTICS_RETRIEVAL_INVOCATION_DRIFT");
expectCode(fixture, "retrieval accessible name", (c) => { c.globalRetrieval.trigger.accessibleName = null; }, "PRODUCT_SEMANTICS_RETRIEVAL_ACCESSIBLE_NAME_MISSING");
expectCode(fixture, "retrieval focus", (c) => { c.globalRetrieval.trigger.focusManaged = false; }, "PRODUCT_SEMANTICS_RETRIEVAL_FOCUS_DRIFT");
expectCode(fixture, "retrieval shortcut", (c) => { c.globalRetrieval.trigger.shortcutObserved = "Cmd+K"; }, "PRODUCT_SEMANTICS_RETRIEVAL_SHORTCUT_DRIFT");
expectCode(fixture, "retrieval auth evidence missing", (c) => { c.globalRetrieval.resultAuthorization = null; }, "PRODUCT_SEMANTICS_RETRIEVAL_AUTH_EVIDENCE_MISSING");
expectCode(fixture, "retrieval auth mode", (c) => { c.globalRetrieval.resultAuthorization.authorizationMode = "backend-authoritative-per-result"; }, "PRODUCT_SEMANTICS_RETRIEVAL_AUTH_MODE_DRIFT");
expectCode(fixture, "retrieval unknown entity", (c) => { c.globalRetrieval.resultAuthorization.observedEntityTypes.push("secret"); }, "PRODUCT_SEMANTICS_RETRIEVAL_ENTITY_LEAK");
expectCode(fixture, "retrieval tenant negative missing", (c) => { c.globalRetrieval.resultAuthorization.authorizationEvidenceRefs = ["tests/global-retrieval.integration.test.ts"]; }, "PRODUCT_SEMANTICS_RETRIEVAL_TENANT_NEGATIVE_MISSING");
expectCode(fixture, "retrieval backend evidence missing", (c) => { c.globalRetrieval.resultAuthorization.authorizationEvidenceRefs = ["tests/global-retrieval-tenant-negative.test.ts"]; }, "PRODUCT_SEMANTICS_RETRIEVAL_BACKEND_EVIDENCE_MISSING");
expectCode(fixture, "retrieval unbound evidence", (c) => { c.globalRetrieval.resultAuthorization.authorizationEvidenceRefs.push("docs/backend/auth.md"); }, "PRODUCT_SEMANTICS_RETRIEVAL_EVIDENCE_UNBOUND");

expectCode(fixture, "schema blocks authorization leakage", (c) => { c.globalRetrieval.resultAuthorization.authorizationFiltered = false; }, "PRODUCT_SEMANTICS_EVIDENCE_SCHEMA");
expectCode(fixture, "schema blocks tenant false", (c) => { c.globalRetrieval.resultAuthorization.tenantScopeValidated = false; }, "PRODUCT_SEMANTICS_EVIDENCE_SCHEMA");
expectCode(fixture, "schema blocks unauthorized results", (c) => { c.globalRetrieval.resultAuthorization.unauthorizedResultCount = 1; }, "PRODUCT_SEMANTICS_EVIDENCE_SCHEMA");
expectCode(fixture, "schema blocks missing announcement", (c) => { c.globalRetrieval.resultAuthorization.resultAnnouncementObserved = false; }, "PRODUCT_SEMANTICS_EVIDENCE_SCHEMA");

const loading = structuredClone(fixture.companion);
loading.globalRetrieval.observedState = "loading";
equal(validate(fixture, loading).length, 0, "loading screenshot may pass when structural authorization-aware result evidence is still attached");
const errorState = structuredClone(fixture.companion);
errorState.globalRetrieval.observedState = "error";
equal(validate(fixture, errorState).length, 0, "error screenshot may pass when structural authorization-aware result evidence is still attached");
const emptyState = structuredClone(fixture.companion);
emptyState.globalRetrieval.observedState = "empty";
equal(validate(fixture, emptyState).length, 0, "empty screenshot may pass when structural authorization-aware result evidence is still attached");
write(path.join(fixture.root, fixture.companionRef), fixture.companion);

const wrapperText = fs.readFileSync(PHASE5_WRAPPER, "utf8");
ok(wrapperText.includes("validateProductSemanticsEvidence"), "Phase 5 public auditor must invoke the 10D validator");
ok(wrapperText.includes("product-semantics-evidence.mjs"), "Phase 5 public auditor must import the 10D implementation");

const repText = fs.readFileSync(PROMPT_REPRESENTATIVE, "utf8");
const evidenceText = fs.readFileSync(PROMPT_EVIDENCE, "utf8");
ok(repText.includes("productSemantics.evidenceRef"), "representative prompt must require the 10D evidence ref when applicable");
ok(evidenceText.includes("productSemantics.evidenceRef"), "evidence-release prompt must validate the 10D evidence ref when applicable");

process.stdout.write(`Product semantics evidence Phase 10D regression suite passed (${assertions} assertions).\n`);
