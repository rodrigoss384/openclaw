#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateJsonSchema } from "../../skills/spec-driven-engineering/scripts/lib/json-schema.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, "../..");
const SCHEMA_PATH = path.join(SCRIPT_DIR, "navigation-capability.schema.json");
const BUX_SCHEMA_PATH = path.join(DEFAULT_ROOT, "skills/frontend-product-builder/assets/schemas/behavioral-ux-contract.schema.json");

function parseArgs(argv) {
  const parsed = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      parsed._.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) parsed[key] = true;
    else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizeRepoPath(value) {
  return String(value || "").split("#", 1)[0].replaceAll("\\", "/").replace(/^\.\//, "");
}

function resolveRepoRef(root, ref, label, errors) {
  const relative = normalizeRepoPath(ref);
  if (!relative) {
    errors.push(`${label} must resolve to a repository path.`);
    return null;
  }
  const absolute = path.resolve(root, relative);
  const normalizedRoot = path.resolve(root);
  if (absolute !== normalizedRoot && !absolute.startsWith(`${normalizedRoot}${path.sep}`)) {
    errors.push(`${label} escapes the repository root: ${ref}`);
    return null;
  }
  if (!fs.existsSync(absolute)) {
    errors.push(`${label} does not exist: ${ref}`);
    return null;
  }
  return absolute;
}

function hasPlaceholder(value) {
  if (typeof value === "string") {
    return /<[^>]+>|\{\{[^}]+\}\}|\b(?:TODO|TBD)\b/i.test(value);
  }
  if (Array.isArray(value)) return value.some(hasPlaceholder);
  if (value && typeof value === "object") return Object.values(value).some(hasPlaceholder);
  return false;
}

function isRealRoute(route) {
  return typeof route === "string"
    && route.startsWith("/")
    && route !== "/"
    && !route.includes("<")
    && !route.includes("{{")
    && !route.startsWith("//")
    && !route.includes("#")
    && !/^javascript:/i.test(route);
}

function relativeRepoPath(root, filePath) {
  return path.relative(root, filePath).replaceAll("\\", "/");
}

function validateMode(contract, errors) {
  const active = contract.modules.filter((module) => module.availability === "active");
  const visible = contract.modules.filter((module) => module.presentation !== "hidden");
  const visibleLocked = visible.filter((module) => module.availability === "entitlement-locked");
  const visibleComingSoon = visible.filter((module) => module.availability === "approved-coming-soon");

  switch (contract.navigationMode) {
    case "single-module":
      if (active.length !== 1 || visible.length !== 1 || visible[0].availability !== "active") {
        errors.push("navigationMode=single-module requires exactly one visible active module; hidden future modules may remain inventoried.");
      }
      break;
    case "multi-module":
      if (active.length < 2 || visible.some((module) => module.availability !== "active")) {
        errors.push("navigationMode=multi-module requires at least two visible active modules and no visible unavailable module.");
      }
      break;
    case "entitlement-aware":
      if (active.length < 1 || visibleLocked.length < 1 || visibleComingSoon.length > 0) {
        errors.push("navigationMode=entitlement-aware requires at least one active module plus one visible entitlement-locked module; visible coming-soon modules require hybrid mode.");
      }
      break;
    case "hybrid":
      if (active.length < 1 || (visibleLocked.length + visibleComingSoon.length) < 1) {
        errors.push("navigationMode=hybrid requires at least one active module and at least one visible non-active module.");
      }
      break;
    default:
      break;
  }
}

function validateModuleSemantics({ root, module, permissionsByCapability, navigationActions, errors }) {
  const prefix = `modules[${module.id}]`;
  resolveRepoRef(root, module.sourceRef, `${prefix}.sourceRef`, errors);

  const matchingPermission = permissionsByCapability.get(module.capabilityRef) || [];
  if (matchingPermission.length > 1) {
    errors.push(`${prefix}.capabilityRef resolves to multiple productContext.permissions entries: ${module.capabilityRef}`);
  }
  const permission = matchingPermission[0] || null;
  const matchingNavigationActions = navigationActions.filter((action) => action.permission === module.capabilityRef);

  if (module.availability === "active") {
    if (module.presentation !== "navigate") errors.push(`${prefix}: active modules must use presentation=navigate.`);
    if (!isRealRoute(module.route)) errors.push(`${prefix}: active modules require a concrete route beginning with '/'.`);
    if (module.roadmapRef !== null) errors.push(`${prefix}: active modules must not carry roadmapRef.`);
    if (module.commercialCapabilityRef !== null) errors.push(`${prefix}: active modules must not carry commercialCapabilityRef.`);
    if (module.behavioralUxRef !== null) errors.push(`${prefix}: active navigation must not carry behavioralUxRef unless the module becomes an explicit behavioral/commercial surface.`);
    if (!permission) errors.push(`${prefix}: active capabilityRef must exist in application-shell productContext.permissions.`);
    else if (!["allowed", "read-only"].includes(permission.frontendTreatment)) {
      errors.push(`${prefix}: active capability permission must be allowed or read-only, got ${permission.frontendTreatment}.`);
    }
    const exactAction = matchingNavigationActions.filter((action) => action.targetRoute === module.route && action.label === module.label);
    if (exactAction.length !== 1) {
      errors.push(`${prefix}: active module must match exactly one application-shell navigation action by capabilityRef, label and targetRoute.`);
    }
    return;
  }

  if (module.presentation === "navigate") {
    errors.push(`${prefix}: unavailable modules must never use presentation=navigate.`);
  }
  if (module.route !== null) {
    errors.push(`${prefix}: unavailable modules must keep route=null so they cannot look operational.`);
  }
  if (matchingNavigationActions.length > 0) {
    errors.push(`${prefix}: unavailable capability must not have an application-shell navigation action.`);
  }

  if (module.availability === "entitlement-locked") {
    if (!["hidden", "disabled-with-reason", "upsell-entry"].includes(module.presentation)) {
      errors.push(`${prefix}: entitlement-locked modules must be hidden, disabled-with-reason, or upsell-entry.`);
    }
    if (!permission) errors.push(`${prefix}: entitlement-locked capabilityRef must exist in application-shell productContext.permissions.`);
    else if (["allowed", "read-only"].includes(permission.frontendTreatment)) {
      errors.push(`${prefix}: entitlement-locked capability cannot have an allowed/read-only frontend permission treatment.`);
    }
    if (module.roadmapRef !== null) errors.push(`${prefix}: entitlement-locked modules must not use roadmapRef; roadmap provenance belongs to approved-coming-soon.`);
  }

  if (module.availability === "approved-coming-soon") {
    if (!["hidden", "disabled-with-reason"].includes(module.presentation)) {
      errors.push(`${prefix}: approved-coming-soon modules may only be hidden or disabled-with-reason.`);
    }
    if (module.roadmapRef === null) errors.push(`${prefix}: approved-coming-soon requires roadmapRef.`);
    else resolveRepoRef(root, module.roadmapRef, `${prefix}.roadmapRef`, errors);
    if (module.commercialCapabilityRef !== null) errors.push(`${prefix}: approved-coming-soon must not use commercialCapabilityRef.`);
    if (module.behavioralUxRef !== null) errors.push(`${prefix}: approved-coming-soon must not use behavioralUxRef.`);
    if (permission && ["allowed", "read-only"].includes(permission.frontendTreatment)) {
      errors.push(`${prefix}: approved-coming-soon capability cannot already be allowed/read-only.`);
    }
  }

  if (["hidden", "disabled-with-reason"].includes(module.presentation) && !module.reason?.trim()) {
    errors.push(`${prefix}: presentation=${module.presentation} requires a non-empty reason.`);
  }

  if (module.presentation === "upsell-entry") {
    if (module.availability !== "entitlement-locked") {
      errors.push(`${prefix}: upsell-entry is only valid for entitlement-locked modules.`);
    }
    if (module.commercialCapabilityRef === null) errors.push(`${prefix}: upsell-entry requires commercialCapabilityRef.`);
    else resolveRepoRef(root, module.commercialCapabilityRef, `${prefix}.commercialCapabilityRef`, errors);
    if (module.behavioralUxRef === null) {
      errors.push(`${prefix}: upsell-entry requires behavioralUxRef so applicable Behavioral UX governance cannot be bypassed.`);
    } else {
      const buxPath = resolveRepoRef(root, module.behavioralUxRef, `${prefix}.behavioralUxRef`, errors);
      if (buxPath) {
        try {
          const bux = readJson(buxPath);
          const buxSchema = readJson(BUX_SCHEMA_PATH);
          const buxErrors = validateJsonSchema(bux, buxSchema);
          for (const error of buxErrors) errors.push(`${prefix}.behavioralUxRef invalid: ${error}`);
        } catch (error) {
          errors.push(`${prefix}.behavioralUxRef is not valid JSON: ${error.message}`);
        }
      }
    }
    if (!module.reason?.trim()) errors.push(`${prefix}: upsell-entry requires a truthful reason.`);
  } else if (module.commercialCapabilityRef !== null) {
    errors.push(`${prefix}: commercialCapabilityRef is only valid for presentation=upsell-entry.`);
  }
}

export function validateNavigationCapability({ root, contractPath }) {
  const errors = [];
  const schema = readJson(SCHEMA_PATH);
  const contract = readJson(contractPath);
  for (const error of validateJsonSchema(contract, schema)) errors.push(`schema: ${error}`);
  if (errors.length) return { valid: false, errors, contract };

  if (contract.status !== "draft" && hasPlaceholder(contract)) {
    errors.push(`status=${contract.status} forbids unresolved placeholders/TODO/TBD values.`);
  }

  const productContextPath = resolveRepoRef(root, contract.productContextRef, "productContextRef", errors);
  const shellPath = resolveRepoRef(root, contract.applicationShellScreenRef, "applicationShellScreenRef", errors);
  if (!productContextPath || !shellPath) return { valid: false, errors, contract };

  let shell;
  try {
    shell = readJson(shellPath);
  } catch (error) {
    errors.push(`applicationShellScreenRef is not valid JSON: ${error.message}`);
    return { valid: false, errors, contract };
  }

  if (shell.screen?.category !== "application-shell" && shell.screen?.surface !== "application-shell") {
    errors.push("applicationShellScreenRef must point to a screen whose category or surface is application-shell.");
  }
  if (shell.recipe?.id !== "application-shell") {
    errors.push("applicationShellScreenRef must select recipe.id=application-shell.");
  }
  if (normalizeRepoPath(shell.productContext?.source) !== normalizeRepoPath(contract.productContextRef)) {
    errors.push("application-shell productContext.source must match navigation contract productContextRef.");
  }

  const contractRelative = relativeRepoPath(root, contractPath);
  const integrationContracts = shell.architecture?.integrationContracts || [];
  if (!integrationContracts.map(normalizeRepoPath).includes(contractRelative)) {
    errors.push(`application-shell architecture.integrationContracts must include ${contractRelative}.`);
  }

  const ids = new Set();
  for (const module of contract.modules) {
    if (ids.has(module.id)) errors.push(`duplicate navigation module id: ${module.id}`);
    ids.add(module.id);
  }

  const permissionsByCapability = new Map();
  for (const permission of shell.productContext?.permissions || []) {
    const entries = permissionsByCapability.get(permission.capability) || [];
    entries.push(permission);
    permissionsByCapability.set(permission.capability, entries);
  }
  const navigationActions = (shell.actions || []).filter((action) => action.kind === "navigation");

  for (const module of contract.modules) {
    validateModuleSemantics({ root, module, permissionsByCapability, navigationActions, errors });
  }
  validateMode(contract, errors);

  const activeModules = contract.modules.filter((module) => module.availability === "active").map((module) => module.id);
  const renderableModules = contract.modules.filter((module) => module.presentation !== "hidden").map((module) => module.id);
  return {
    valid: errors.length === 0,
    errors,
    contract,
    summary: {
      navigationMode: contract.navigationMode,
      activeModules,
      renderableModules,
      productContextRef: contract.productContextRef,
      applicationShellScreenRef: contract.applicationShellScreenRef
    }
  };
}

function writeOutput(outputPath, value) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(value, null, 2)}\n`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0] || "help";
  if (command !== "check") {
    process.stderr.write("Usage: node integrations/frontend/navigation-capability.mjs check --root <repo> --contract <docs/frontend/navigation-capabilities.json> [--output <report.json>]\n");
    process.exit(2);
  }
  const root = path.resolve(String(args.root || DEFAULT_ROOT));
  // RULE-FE-NAVIGATION-001 applies to every frontend feature, but this
  // contract only exists when the application shell, global navigation,
  // module availability or a commercial entry was actually touched, and its
  // schema has no not-applicable mode of its own. An untouched feature must
  // not be forced to fabricate a navigation projection -- and must not skip
  // the check silently either. --not-applicable requires an explicit,
  // recorded reason (same shape as frontend-family-consistency.mjs); the
  // adversarial and evidence stages judge whether the claim is honest.
  if (!args.contract) {
    const notApplicable = args["not-applicable"];
    if (notApplicable !== undefined) {
      if (notApplicable === true || String(notApplicable).trim() === "") {
        process.stderr.write("--not-applicable requires an explicit reason: --not-applicable \"<reason>\"\n");
        process.exit(2);
      }
      process.stdout.write(`${JSON.stringify({
        artifactKind: "navigation-capability-check",
        status: "not-applicable",
        reason: String(notApplicable)
      }, null, 2)}\n`);
      process.exit(0);
    }
    process.stderr.write("--contract is required (or --not-applicable \"<reason>\" when no navigation surface changed).\n");
    process.exit(2);
  }
  const contractPath = path.resolve(root, String(args.contract));
  if (!contractPath.startsWith(`${root}${path.sep}`) && contractPath !== root) {
    process.stderr.write("Contract path escapes repository root.\n");
    process.exit(2);
  }
  if (!fs.existsSync(contractPath)) {
    process.stderr.write(`Navigation capability contract not found: ${contractPath}\n`);
    process.exit(1);
  }

  try {
    const result = validateNavigationCapability({ root, contractPath });
    const report = {
      schemaVersion: "1.0.0",
      valid: result.valid,
      contract: relativeRepoPath(root, contractPath),
      ...result.summary,
      errors: result.errors
    };
    if (args.output) writeOutput(path.resolve(root, String(args.output)), report);
    if (!result.valid) {
      process.stderr.write(`Navigation capability contract failed:\n- ${result.errors.join("\n- ")}\n`);
      process.exit(1);
    }
    process.stdout.write(`Navigation capability contract valid: ${report.contract}\n`);
    process.stdout.write(`navigationMode=${report.navigationMode}\n`);
    process.stdout.write(`activeModules=${report.activeModules.join(",") || "none"}\n`);
    process.stdout.write(`renderableModules=${report.renderableModules.join(",") || "none"}\n`);
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exit(1);
  }
}

function isMainModule(realPath) {
  if (!process.argv[1]) return false;
  try {
    return fs.realpathSync(path.resolve(process.argv[1])) === realPath;
  } catch {
    return false;
  }
}

if (isMainModule(fileURLToPath(import.meta.url))) main();
