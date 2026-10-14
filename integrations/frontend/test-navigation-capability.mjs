#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateNavigationCapability } from "./navigation-capability.mjs";

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

function validBux() {
  return {
    $schema: "../schemas/behavioral-ux-contract.schema.json",
    id: "BUX-NAV-UPSELL-001",
    surface: "application-shell-navigation",
    userGoal: "Understand which additional product capability is available before choosing whether to upgrade.",
    productGoal: "Offer an optional commercial upgrade without disguising entitlement state.",
    principle: "value-before-commitment",
    hypothesis: "Showing a truthful locked capability with explicit value context improves qualified upgrade starts without increasing confusion.",
    evidenceGrade: "D",
    userBenefit: "Users can distinguish a paid capability from an active navigation destination before taking action.",
    businessBenefit: "Qualified users can discover an upgrade path without deceptive availability cues.",
    truthful: true,
    reversible: true,
    userControl: "preserved",
    manipulationRisk: "low",
    experimentRequired: true,
    primaryMetric: "qualified-upgrade-start-rate",
    guardrails: ["navigation-misclick-rate", "support-contact-rate"],
    notes: null
  };
}

function baseShell() {
  return {
    screen: { id: "application-shell", category: "application-shell", surface: "application-shell" },
    productContext: {
      source: "docs/frontend/product-context.md",
      permissions: [
        { capability: "view-dashboard", frontendTreatment: "allowed", backendAuthoritative: true },
        { capability: "view-cases", frontendTreatment: "allowed", backendAuthoritative: true },
        { capability: "advanced-analytics", frontendTreatment: "unavailable", backendAuthoritative: true }
      ]
    },
    architecture: {
      integrationContracts: ["docs/frontend/navigation-capabilities.json"]
    },
    recipe: { id: "application-shell" },
    actions: [
      { id: "nav-dashboard", label: "Dashboard", kind: "navigation", permission: "view-dashboard", targetRoute: "/dashboard" },
      { id: "nav-cases", label: "Cases", kind: "navigation", permission: "view-cases", targetRoute: "/cases" }
    ]
  };
}

function baseContract() {
  return {
    $schema: "../../integrations/frontend/navigation-capability.schema.json",
    schemaVersion: "1.0.0",
    status: "ready",
    owner: "product-platform",
    productContextRef: "docs/frontend/product-context.md",
    applicationShellScreenRef: "docs/frontend/screens/application-shell/screen-spec.json",
    navigationMode: "multi-module",
    modules: [
      {
        id: "dashboard",
        label: "Dashboard",
        capabilityRef: "view-dashboard",
        availability: "active",
        presentation: "navigate",
        sourceRef: "docs/product/capabilities.md#dashboard",
        route: "/dashboard",
        roadmapRef: null,
        commercialCapabilityRef: null,
        behavioralUxRef: null,
        reason: null
      },
      {
        id: "cases",
        label: "Cases",
        capabilityRef: "view-cases",
        availability: "active",
        presentation: "navigate",
        sourceRef: "docs/product/capabilities.md#cases",
        route: "/cases",
        roadmapRef: null,
        commercialCapabilityRef: null,
        behavioralUxRef: null,
        reason: null
      }
    ]
  };
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "phase10b-navigation-"));
try {
  write(tempRoot, "docs/frontend/product-context.md", "# Product Context\n\nApproved information architecture.\n");
  write(tempRoot, "docs/product/capabilities.md", "# Capabilities\n\nDashboard and cases are approved product capabilities.\n");
  write(tempRoot, "docs/product/roadmap.md", "# Approved Roadmap\n\nReporting is approved for a future release.\n");
  write(tempRoot, "docs/product/commercial-capabilities.md", "# Commercial Capabilities\n\nAdvanced analytics is a paid capability.\n");
  write(tempRoot, "docs/frontend/behavioral-ux/upsell.json", validBux());
  write(tempRoot, "docs/frontend/behavioral-ux/invalid.json", { $schema: "../schemas/behavioral-ux-contract.schema.json" });

  const contractPath = write(tempRoot, "docs/frontend/navigation-capabilities.json", baseContract());
  write(tempRoot, "docs/frontend/screens/application-shell/screen-spec.json", baseShell());

  const valid = validateNavigationCapability({ root: tempRoot, contractPath });
  check(valid.valid, `base multi-module contract should be valid: ${valid.errors.join(" | ")}`);
  equal(valid.summary.navigationMode, "multi-module", "mode should be retained");
  equal(valid.summary.activeModules.length, 2, "two active modules should be reported");

  const single = baseContract();
  single.navigationMode = "single-module";
  single.modules = [single.modules[0]];
  const singlePath = write(tempRoot, "docs/frontend/navigation-single.json", single);
  const singleShell = baseShell();
  singleShell.architecture.integrationContracts = ["docs/frontend/navigation-single.json"];
  write(tempRoot, "docs/frontend/screens/application-shell/screen-spec.json", singleShell);
  const singleResult = validateNavigationCapability({ root: tempRoot, contractPath: singlePath });
  check(singleResult.valid, `single-module contract should be valid: ${singleResult.errors.join(" | ")}`);

  const entitlement = baseContract();
  entitlement.navigationMode = "entitlement-aware";
  entitlement.modules = [entitlement.modules[0], {
    id: "advanced-analytics",
    label: "Advanced analytics",
    capabilityRef: "advanced-analytics",
    availability: "entitlement-locked",
    presentation: "upsell-entry",
    sourceRef: "docs/product/capabilities.md#advanced-analytics",
    route: null,
    roadmapRef: null,
    commercialCapabilityRef: "docs/product/commercial-capabilities.md#advanced-analytics",
    behavioralUxRef: "docs/frontend/behavioral-ux/upsell.json",
    reason: "Available only on the Advanced Analytics entitlement; show the upgrade path without presenting it as active navigation."
  }];
  const entitlementPath = write(tempRoot, "docs/frontend/navigation-entitlement.json", entitlement);
  const entitlementShell = baseShell();
  entitlementShell.architecture.integrationContracts = ["docs/frontend/navigation-entitlement.json"];
  entitlementShell.actions = [entitlementShell.actions[0]];
  write(tempRoot, "docs/frontend/screens/application-shell/screen-spec.json", entitlementShell);
  const entitlementResult = validateNavigationCapability({ root: tempRoot, contractPath: entitlementPath });
  check(entitlementResult.valid, `entitlement-aware contract should be valid: ${entitlementResult.errors.join(" | ")}`);

  const hybrid = baseContract();
  hybrid.navigationMode = "hybrid";
  hybrid.modules = [hybrid.modules[0], {
    id: "reporting",
    label: "Reporting",
    capabilityRef: "future-reporting",
    availability: "approved-coming-soon",
    presentation: "disabled-with-reason",
    sourceRef: "docs/product/capabilities.md#reporting",
    route: null,
    roadmapRef: "docs/product/roadmap.md#reporting",
    commercialCapabilityRef: null,
    behavioralUxRef: null,
    reason: "Approved for a future release; not yet operational."
  }];
  const hybridPath = write(tempRoot, "docs/frontend/navigation-hybrid.json", hybrid);
  const hybridShell = baseShell();
  hybridShell.architecture.integrationContracts = ["docs/frontend/navigation-hybrid.json"];
  hybridShell.actions = [hybridShell.actions[0]];
  write(tempRoot, "docs/frontend/screens/application-shell/screen-spec.json", hybridShell);
  const hybridResult = validateNavigationCapability({ root: tempRoot, contractPath: hybridPath });
  check(hybridResult.valid, `hybrid coming-soon contract should be valid: ${hybridResult.errors.join(" | ")}`);

  function expectInvalid(name, mutateContract, mutateShell, expectedFragment) {
    const contract = baseContract();
    const shell = baseShell();
    mutateContract?.(contract);
    mutateShell?.(shell);
    const relative = `docs/frontend/negative-${name}.json`;
    shell.architecture.integrationContracts = [relative];
    write(tempRoot, "docs/frontend/screens/application-shell/screen-spec.json", shell);
    const candidatePath = write(tempRoot, relative, contract);
    const result = validateNavigationCapability({ root: tempRoot, contractPath: candidatePath });
    check(!result.valid, `${name} should be rejected`);
    check(result.errors.some((error) => String(error).includes(expectedFragment)), `${name} should report '${expectedFragment}', got: ${result.errors.join(" | ")}`);
  }

  expectInvalid("missing-source-ref", (contract) => { delete contract.modules[0].sourceRef; }, null, "schema:");
  expectInvalid("missing-source-file", (contract) => { contract.modules[0].sourceRef = "docs/product/missing.md#dashboard"; }, null, "sourceRef does not exist");
  expectInvalid("product-context-mismatch", null, (shell) => { shell.productContext.source = "docs/frontend/other-product-context.md"; }, "productContext.source must match");
  expectInvalid("not-application-shell", null, (shell) => { shell.screen.category = "dashboard"; shell.screen.surface = "route"; }, "category or surface is application-shell");
  expectInvalid("wrong-recipe", null, (shell) => { shell.recipe.id = "dashboard"; }, "recipe.id=application-shell");
  expectInvalid("active-route-placeholder", (contract) => { contract.modules[0].route = "/<guessed>"; }, null, "concrete route");
  expectInvalid("active-action-drift", (contract) => { contract.modules[0].route = "/dashboard-v2"; }, null, "match exactly one application-shell navigation action");
  expectInvalid("active-permission-missing", (contract) => { contract.modules[0].capabilityRef = "missing-capability"; }, null, "must exist in application-shell productContext.permissions");
  expectInvalid("single-mode-drift", (contract) => { contract.navigationMode = "single-module"; }, null, "navigationMode=single-module");
  expectInvalid("locked-cannot-navigate", (contract) => {
    contract.navigationMode = "entitlement-aware";
    contract.modules[1] = {
      ...contract.modules[1],
      id: "advanced-analytics",
      label: "Advanced analytics",
      capabilityRef: "advanced-analytics",
      availability: "entitlement-locked",
      presentation: "navigate",
      sourceRef: "docs/product/capabilities.md#advanced-analytics",
      route: "/advanced-analytics",
      reason: "Locked"
    };
  }, (shell) => { shell.actions = [shell.actions[0]]; }, "must never use presentation=navigate");
  expectInvalid("coming-soon-without-roadmap", (contract) => {
    contract.navigationMode = "hybrid";
    contract.modules[1] = {
      ...contract.modules[1],
      id: "reporting",
      label: "Reporting",
      capabilityRef: "future-reporting",
      availability: "approved-coming-soon",
      presentation: "disabled-with-reason",
      route: null,
      roadmapRef: null,
      reason: "Future"
    };
  }, (shell) => { shell.actions = [shell.actions[0]]; }, "requires roadmapRef");
  expectInvalid("upsell-without-commercial-source", (contract) => {
    contract.navigationMode = "entitlement-aware";
    contract.modules[1] = {
      ...contract.modules[1],
      id: "advanced-analytics",
      label: "Advanced analytics",
      capabilityRef: "advanced-analytics",
      availability: "entitlement-locked",
      presentation: "upsell-entry",
      route: null,
      commercialCapabilityRef: null,
      behavioralUxRef: "docs/frontend/behavioral-ux/upsell.json",
      reason: "Paid capability"
    };
  }, (shell) => { shell.actions = [shell.actions[0]]; }, "requires commercialCapabilityRef");
  expectInvalid("upsell-without-bux", (contract) => {
    contract.navigationMode = "entitlement-aware";
    contract.modules[1] = {
      ...contract.modules[1],
      id: "advanced-analytics",
      label: "Advanced analytics",
      capabilityRef: "advanced-analytics",
      availability: "entitlement-locked",
      presentation: "upsell-entry",
      route: null,
      commercialCapabilityRef: "docs/product/commercial-capabilities.md#advanced-analytics",
      behavioralUxRef: null,
      reason: "Paid capability"
    };
  }, (shell) => { shell.actions = [shell.actions[0]]; }, "requires behavioralUxRef");
  expectInvalid("disabled-without-reason", (contract) => {
    contract.navigationMode = "hybrid";
    contract.modules[1] = {
      ...contract.modules[1],
      id: "reporting",
      label: "Reporting",
      capabilityRef: "future-reporting",
      availability: "approved-coming-soon",
      presentation: "disabled-with-reason",
      route: null,
      roadmapRef: "docs/product/roadmap.md#reporting",
      reason: null
    };
  }, (shell) => { shell.actions = [shell.actions[0]]; }, "requires a non-empty reason");
  expectInvalid("nonactive-route-action", (contract) => {
    contract.navigationMode = "entitlement-aware";
    contract.modules[1] = {
      ...contract.modules[1],
      id: "advanced-analytics",
      label: "Advanced analytics",
      capabilityRef: "advanced-analytics",
      availability: "entitlement-locked",
      presentation: "disabled-with-reason",
      route: null,
      reason: "Entitlement required"
    };
  }, (shell) => {
    shell.actions[1] = { id: "nav-advanced", label: "Advanced analytics", kind: "navigation", permission: "advanced-analytics", targetRoute: "/advanced" };
  }, "unavailable capability must not have an application-shell navigation action");
  expectInvalid("invalid-bux", (contract) => {
    contract.navigationMode = "entitlement-aware";
    contract.modules[1] = {
      ...contract.modules[1],
      id: "advanced-analytics",
      label: "Advanced analytics",
      capabilityRef: "advanced-analytics",
      availability: "entitlement-locked",
      presentation: "upsell-entry",
      route: null,
      commercialCapabilityRef: "docs/product/commercial-capabilities.md#advanced-analytics",
      behavioralUxRef: "docs/frontend/behavioral-ux/invalid.json",
      reason: "Paid capability"
    };
  }, (shell) => { shell.actions = [shell.actions[0]]; }, "behavioralUxRef invalid");

  {
    const contract = baseContract();
    const shell = baseShell();
    const relative = "docs/frontend/negative-missing-shell-binding.json";
    shell.architecture.integrationContracts = ["docs/frontend/another-contract.json"];
    write(tempRoot, "docs/frontend/screens/application-shell/screen-spec.json", shell);
    const candidatePath = write(tempRoot, relative, contract);
    const result = validateNavigationCapability({ root: tempRoot, contractPath: candidatePath });
    check(!result.valid, "missing application-shell integration binding should be rejected");
    check(result.errors.some((error) => String(error).includes("architecture.integrationContracts must include")), `missing binding should report integrationContracts drift, got: ${result.errors.join(" | ")}`);
  }

  const promptChecks = [
    "prompts/spec-driven/05-design-readiness.prompt.md",
    "prompts/spec-driven/07-execute.prompt.md",
    "prompts/spec-driven/07.1-frontend-representative-gate.prompt.md",
    "prompts/spec-driven/09-validate-evidence.prompt.md"
  ];
  for (const prompt of promptChecks) {
    const content = fs.readFileSync(path.join(ROOT, prompt), "utf8");
    check(content.includes("navigation-capability.mjs check"), `${prompt} must consume the 10B navigation validator`);
  }
  const capabilities = JSON.parse(fs.readFileSync(path.join(ROOT, "integrations/governance/enforcement-capabilities.json"), "utf8"));
  check(capabilities.capabilities.some((capability) => capability.id === "frontend-navigation-capability-control"), "10B capability must be registered");

  console.log(`Navigation capability Phase 10B regression suite passed (${assertions} assertions).`);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
