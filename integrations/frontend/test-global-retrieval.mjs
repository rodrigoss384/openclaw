#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateGlobalRetrieval } from "./global-retrieval.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "../..");
let assertions = 0;

function check(condition, message) {
  assertions += 1;
  assert.ok(condition, message);
}

function equal(actual, expected, message) {
  assertions += 1;
  assert.equal(actual, expected, message);
}

function write(root, relative, content) {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, typeof content === "string" ? content : `${JSON.stringify(content, null, 2)}\n`);
  return target;
}

function baseShell(contractRef = "docs/frontend/global-retrieval.json") {
  return {
    screen: { id: "application-shell", category: "application-shell", surface: "application-shell" },
    productContext: {
      source: "docs/frontend/product-context.md",
      permissions: [
        { capability: "view-cases", frontendTreatment: "allowed", backendAuthoritative: true },
        { capability: "view-clients", frontendTreatment: "read-only", backendAuthoritative: true },
        { capability: "view-restricted", frontendTreatment: "unavailable", backendAuthoritative: true }
      ]
    },
    architecture: { integrationContracts: [contractRef] }
  };
}

function baseBackend() {
  return {
    $schema: "../../integrations/frontend/global-retrieval-backend.schema.json",
    schemaVersion: "1.0.0",
    artifactKind: "global-retrieval-backend-contract",
    status: "ready",
    owner: "backend-platform",
    sourceRef: "docs/backend/search-api.md",
    authorizationMode: "backend-authoritative-query-scope",
    authentication: { required: true, mechanismRef: "docs/backend/auth.md" },
    tenantIsolation: {
      required: true,
      scopeKey: "tenantId",
      enforcementPoint: "search service query boundary",
      negativeTestRef: "tests/backend/search-tenant-isolation.test.md"
    },
    limits: { maxQueryLength: 256, maxResults: 50, rateLimitRef: "docs/backend/rate-limit.md" },
    ranking: { strategyRef: "docs/backend/search-ranking.md", deterministicTieBreak: "entityType then canonical id" },
    timeoutMs: 2500,
    sensitiveDataHandling: {
      policyRef: "docs/backend/sensitive-data.md",
      redactionMode: "omit-unauthorized",
      forbiddenFields: ["secretNote"]
    },
    evidenceRefs: ["tests/backend/search-contract.test.md"]
  };
}

function baseContract() {
  return {
    $schema: "../../integrations/frontend/global-retrieval.schema.json",
    schemaVersion: "1.0.0",
    artifactKind: "global-retrieval-applicability",
    status: "ready",
    owner: "product-platform",
    productContextRef: "docs/frontend/product-context.md",
    applicationShellScreenRef: "docs/frontend/screens/application-shell/screen-spec.json",
    applicability: "required",
    applicabilityBasis: {
      transversalRetrieval: true,
      multipleEntityTypes: true,
      recurringQuickFind: true,
      operationalHighFrequency: false
    },
    reason: "Operators repeatedly locate cases and clients across product areas during the primary workflow.",
    searchableEntityTypes: [
      {
        id: "case",
        label: "Case",
        sourceRef: "docs/product/entities.md#case",
        capabilityRef: "view-cases",
        sensitivity: "ordinary"
      },
      {
        id: "client",
        label: "Client",
        sourceRef: "docs/product/entities.md#client",
        capabilityRef: "view-clients",
        sensitivity: "sensitive"
      }
    ],
    invocation: {
      mode: "global-header",
      globalEntryRequired: true,
      accessibleTriggerRequired: true,
      focusManagementRequired: true
    },
    shortcut: null,
    authorizationMode: "backend-authoritative-query-scope",
    resultContract: {
      requiredStates: ["loading", "empty", "error", "results"],
      requiredSemanticFields: ["entityType", "primaryLabel", "destination"],
      destinationResolution: "route",
      authorizationLeakageAllowed: false,
      resultAnnouncementRequired: true
    },
    backendContractRef: "docs/backend/global-retrieval-contract.json",
    evidence: [
      { signal: "transversal-retrieval", sourceRef: "docs/frontend/product-context.md", statement: "The journey crosses case and client areas." },
      { signal: "multiple-entity-types", sourceRef: "docs/frontend/product-context.md", statement: "Cases and clients are both retrieval targets." },
      { signal: "recurring-quick-find", sourceRef: "docs/product/usage-evidence.md", statement: "Quick find recurs during the primary daily workflow." }
    ]
  };
}

function optionalContract() {
  const value = baseContract();
  value.applicability = "optional";
  value.applicabilityBasis = {
    transversalRetrieval: true,
    multipleEntityTypes: false,
    recurringQuickFind: false,
    operationalHighFrequency: false
  };
  value.searchableEntityTypes = [value.searchableEntityTypes[0]];
  value.evidence = [value.evidence[0]];
  return value;
}

function notApplicableContract() {
  const value = baseContract();
  value.applicationShellScreenRef = null;
  value.applicability = "not-applicable";
  value.applicabilityBasis = {
    transversalRetrieval: false,
    multipleEntityTypes: false,
    recurringQuickFind: false,
    operationalHighFrequency: false
  };
  value.reason = "The approved product context contains no cross-product retrieval workflow.";
  value.searchableEntityTypes = [];
  value.invocation = {
    mode: "none",
    globalEntryRequired: false,
    accessibleTriggerRequired: false,
    focusManagementRequired: false
  };
  value.shortcut = null;
  value.authorizationMode = "not-applicable";
  value.resultContract = null;
  value.backendContractRef = null;
  value.evidence = [
    { signal: "not-applicable", sourceRef: "docs/frontend/product-context.md", statement: "No global retrieval job is approved." }
  ];
  return value;
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "phase10c-global-retrieval-"));
try {
  for (const file of [
    "docs/frontend/product-context.md",
    "docs/product/entities.md",
    "docs/product/usage-evidence.md",
    "docs/backend/search-api.md",
    "docs/backend/auth.md",
    "docs/backend/rate-limit.md",
    "docs/backend/search-ranking.md",
    "docs/backend/sensitive-data.md",
    "tests/backend/search-tenant-isolation.test.md",
    "tests/backend/search-contract.test.md"
  ]) write(tempRoot, file, `# ${path.basename(file)}\n`);

  write(tempRoot, "docs/backend/global-retrieval-contract.json", baseBackend());
  write(tempRoot, "docs/frontend/screens/application-shell/screen-spec.json", baseShell());
  const contractPath = write(tempRoot, "docs/frontend/global-retrieval.json", baseContract());

  const requiredResult = validateGlobalRetrieval({ root: tempRoot, contractPath });
  check(requiredResult.valid, `required contract should pass: ${requiredResult.errors.join(" | ")}`);
  equal(requiredResult.summary.applicability, "required", "required applicability should be retained");
  equal(requiredResult.summary.searchableEntityTypes.length, 2, "two entity types should be reported");
  equal(requiredResult.summary.shortcut, null, "required global retrieval must not require a keyboard shortcut");

  const customShortcut = baseContract();
  customShortcut.shortcut = "Ctrl+P";
  const customPath = write(tempRoot, "docs/frontend/global-retrieval-custom-shortcut.json", customShortcut);
  write(tempRoot, "docs/frontend/screens/application-shell/screen-spec.json", baseShell("docs/frontend/global-retrieval-custom-shortcut.json"));
  const customResult = validateGlobalRetrieval({ root: tempRoot, contractPath: customPath });
  check(customResult.valid, `custom shortcut should pass without Cmd+K hard-code: ${customResult.errors.join(" | ")}`);
  equal(customResult.summary.shortcut, "Ctrl+P", "custom shortcut should be retained");

  const optional = optionalContract();
  const optionalPath = write(tempRoot, "docs/frontend/global-retrieval-optional.json", optional);
  write(tempRoot, "docs/frontend/screens/application-shell/screen-spec.json", baseShell("docs/frontend/global-retrieval-optional.json"));
  const optionalResult = validateGlobalRetrieval({ root: tempRoot, contractPath: optionalPath });
  check(optionalResult.valid, `optional contract should pass: ${optionalResult.errors.join(" | ")}`);

  const notApplicable = notApplicableContract();
  const notApplicablePath = write(tempRoot, "docs/frontend/global-retrieval-na.json", notApplicable);
  const notApplicableResult = validateGlobalRetrieval({ root: tempRoot, contractPath: notApplicablePath });
  check(notApplicableResult.valid, `not-applicable contract should pass: ${notApplicableResult.errors.join(" | ")}`);

  function expectInvalid(name, mutateContract, mutateShell, mutateBackend, expectedFragment) {
    const relative = `docs/frontend/negative-${name}.json`;
    const contract = baseContract();
    const shell = baseShell(relative);
    const backend = baseBackend();
    mutateContract?.(contract);
    mutateShell?.(shell);
    mutateBackend?.(backend);
    write(tempRoot, "docs/backend/global-retrieval-contract.json", backend);
    write(tempRoot, "docs/frontend/screens/application-shell/screen-spec.json", shell);
    const candidatePath = write(tempRoot, relative, contract);
    const result = validateGlobalRetrieval({ root: tempRoot, contractPath: candidatePath });
    check(!result.valid, `${name} should be rejected`);
    check(result.errors.some((error) => String(error).includes(expectedFragment)), `${name} should report '${expectedFragment}', got: ${result.errors.join(" | ")}`);
  }

  expectInvalid("applicability-underrated", (contract) => { contract.applicability = "optional"; }, null, null, "applicability must be required");
  expectInvalid("missing-signal-evidence", (contract) => { contract.evidence = contract.evidence.filter((entry) => entry.signal !== "recurring-quick-find"); }, null, null, "signal=recurring-quick-find");
  expectInvalid("multiple-entity-count", (contract) => { contract.searchableEntityTypes = [contract.searchableEntityTypes[0]]; }, null, null, "requires at least two searchableEntityTypes");
  expectInvalid("missing-entity-source", (contract) => { contract.searchableEntityTypes[0].sourceRef = "docs/product/missing.md#case"; }, null, null, "sourceRef does not exist");
  expectInvalid("duplicate-entity-id", (contract) => { contract.searchableEntityTypes[1].id = contract.searchableEntityTypes[0].id; }, null, null, "duplicate searchable entity id");
  expectInvalid("missing-shell", (contract) => { contract.applicationShellScreenRef = null; }, null, null, "requires a valid applicationShellScreenRef");
  expectInvalid("wrong-shell", null, (shell) => { shell.screen.category = "dashboard"; shell.screen.surface = "route"; }, null, "must point to an application-shell screen");
  expectInvalid("product-context-drift", null, (shell) => { shell.productContext.source = "docs/frontend/other.md"; }, null, "productContext.source must match");
  expectInvalid("integration-binding", null, (shell) => { shell.architecture.integrationContracts = []; }, null, "architecture.integrationContracts must include");
  expectInvalid("missing-capability", (contract) => { contract.searchableEntityTypes[0].capabilityRef = "missing-capability"; }, null, null, "capabilityRef must exist");
  expectInvalid("unavailable-capability", (contract) => { contract.searchableEntityTypes[0].capabilityRef = "view-restricted"; }, null, null, "must be allowed or read-only");
  expectInvalid("invocation-none", (contract) => { contract.invocation.mode = "none"; }, null, null, "requires a concrete invocation mode");
  expectInvalid("missing-global-entry", (contract) => { contract.invocation.globalEntryRequired = false; }, null, null, "requires a discoverable global entry");
  expectInvalid("missing-accessible-trigger", (contract) => { contract.invocation.accessibleTriggerRequired = false; }, null, null, "requires an accessible trigger");
  expectInvalid("missing-focus", (contract) => { contract.invocation.focusManagementRequired = false; }, null, null, "requires focus management");
  expectInvalid("missing-loading-state", (contract) => { contract.resultContract.requiredStates = ["empty", "error", "results"]; }, null, null, "must include loading");
  expectInvalid("missing-destination-field", (contract) => { contract.resultContract.requiredSemanticFields = ["entityType", "primaryLabel"]; }, null, null, "must include destination");
  expectInvalid("missing-backend-ref", (contract) => { contract.backendContractRef = "docs/backend/missing.json"; }, null, null, "backendContractRef does not exist");
  expectInvalid("backend-auth-mode", null, null, (backend) => { backend.authorizationMode = "backend-authoritative-per-result"; }, "authorizationMode must match");
  expectInvalid("backend-draft", null, null, (backend) => { backend.status = "draft"; }, "cannot depend on a draft backend");
  expectInvalid("backend-source", null, null, (backend) => { backend.sourceRef = "docs/backend/missing-api.md"; }, "backend.sourceRef does not exist");
  expectInvalid("backend-auth-ref", null, null, (backend) => { backend.authentication.mechanismRef = "docs/backend/missing-auth.md"; }, "authentication.mechanismRef does not exist");
  expectInvalid("backend-tenant-negative", null, null, (backend) => { backend.tenantIsolation.negativeTestRef = "tests/backend/missing-tenant.md"; }, "tenantIsolation.negativeTestRef does not exist");
  expectInvalid("backend-rate-limit", null, null, (backend) => { backend.limits.rateLimitRef = "docs/backend/missing-rate.md"; }, "limits.rateLimitRef does not exist");
  expectInvalid("backend-ranking", null, null, (backend) => { backend.ranking.strategyRef = "docs/backend/missing-ranking.md"; }, "ranking.strategyRef does not exist");
  expectInvalid("backend-sensitive", null, null, (backend) => { backend.sensitiveDataHandling.policyRef = "docs/backend/missing-sensitive.md"; }, "sensitiveDataHandling.policyRef does not exist");
  expectInvalid("backend-evidence", null, null, (backend) => { backend.evidenceRefs = ["tests/backend/missing-contract.md"]; }, "backend.evidenceRefs[0] does not exist");

  const invalidBackendPath = "docs/backend/global-retrieval-contract.json";
  write(tempRoot, invalidBackendPath, { $schema: "../../integrations/frontend/global-retrieval-backend.schema.json" });
  write(tempRoot, "docs/frontend/screens/application-shell/screen-spec.json", baseShell("docs/frontend/negative-invalid-backend-schema.json"));
  const invalidBackendContract = baseContract();
  const invalidBackendContractPath = write(tempRoot, "docs/frontend/negative-invalid-backend-schema.json", invalidBackendContract);
  const invalidBackendResult = validateGlobalRetrieval({ root: tempRoot, contractPath: invalidBackendContractPath });
  check(!invalidBackendResult.valid, "invalid backend schema should be rejected");
  check(invalidBackendResult.errors.some((error) => error.includes("backend contract schema:")), `invalid backend schema should report schema errors: ${invalidBackendResult.errors.join(" | ")}`);

  write(tempRoot, invalidBackendPath, baseBackend());
  const invalidNa = notApplicableContract();
  invalidNa.shortcut = "Mod+K";
  const invalidNaPath = write(tempRoot, "docs/frontend/negative-na-shortcut.json", invalidNa);
  const invalidNaResult = validateGlobalRetrieval({ root: tempRoot, contractPath: invalidNaPath });
  check(!invalidNaResult.valid, "not-applicable shortcut should be rejected");
  check(invalidNaResult.errors.some((error) => error.includes("shortcut=null")), "not-applicable shortcut should report null requirement");

  const promptChecks = [
    "prompts/spec-driven/05-design-readiness.prompt.md",
    "prompts/spec-driven/07-execute.prompt.md",
    "prompts/spec-driven/07.1-frontend-representative-gate.prompt.md",
    "prompts/spec-driven/09-validate-evidence.prompt.md"
  ];
  for (const prompt of promptChecks) {
    const content = fs.readFileSync(path.join(ROOT, prompt), "utf8");
    check(content.includes("global-retrieval.mjs check"), `${prompt} must consume the 10C global retrieval validator`);
  }
  const capabilities = JSON.parse(fs.readFileSync(path.join(ROOT, "integrations/governance/enforcement-capabilities.json"), "utf8"));
  check(capabilities.capabilities.some((capability) => capability.id === "frontend-global-retrieval-control"), "10C capability must be registered");

  console.log(`Global retrieval Phase 10C regression suite passed (${assertions} assertions).`);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
