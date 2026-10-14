#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validateJsonSchema } from "../../skills/spec-driven-engineering/scripts/lib/json-schema.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, "../..");
const FRONTEND_REQUEST_SCHEMA_REF = "integrations/governance/frontend-autonomy.schema.json";
const AUTONOMY_DECISION_SCHEMA_REF = "integrations/governance/autonomy-decision.schema.json";
const EFFECTIVE_POLICY_SCHEMA_REF = "integrations/governance/effective-policy.schema.json";
const AUTONOMY_VALIDATOR_REF = "integrations/governance/validate-autonomy-policy.mjs";
const FRONTEND_CRAFT_POLICY_REF = "prompts/spec-driven/frontend-craft-policy.json";
const FINDING_ROUTE_SCHEMA_REF = "integrations/impeccable/finding-route.schema.json";

const AUTONOMOUS_CHOICES = new Map([
  ["component-variant", "equivalent-variant"],
  ["responsive-layout-within-recipe", "reversible-contract-bounded"],
  ["existing-spacing-token", "reversible-contract-bounded"],
  ["craft-implementation-repair", "reversible-contract-bounded"],
  ["allowed-provider-command", "reversible-contract-bounded"],
  ["reversible-refactor", "reversible-internal"]
]);

const CONSEQUENTIAL_CHOICES = new Map([
  ["product-navigation-semantics", "product-consequential"],
  ["new-capability", "product-consequential"],
  ["commercial-capability", "product-consequential"],
  ["brand-material", "brand-consequential"],
  ["legal", "legal-consequential"],
  ["behavioral-high-risk", "behavioral-high-risk"],
  ["authentication-security-tenancy", "security-consequential"],
  ["public-contract", "product-consequential"]
]);

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

function usage() {
  return "Usage: node integrations/governance/frontend-autonomy.mjs route --root <project-root> --request <frontend-autonomy-request.json> [--output <autonomy-decision-request.json>]";
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Cannot read JSON ${filePath}: ${error.message}`);
  }
}

function resolveRepositoryFile(root, ref, label) {
  if (!ref || typeof ref !== "string" || path.isAbsolute(ref)) {
    throw new Error(`${label} must be a repository-relative path.`);
  }
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, ref);
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`${label} escapes project root: '${ref}'.`);
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    throw new Error(`${label} not found: '${ref}'.`);
  }
  return resolved;
}

function repositoryRef(root, filePath) {
  const relative = path.relative(path.resolve(root), path.resolve(filePath)).split(path.sep).join("/");
  if (!relative || relative.startsWith("../")) throw new Error(`File is outside project root: ${filePath}`);
  return relative;
}

function validateAgainst(value, schemaPath, label) {
  const errors = validateJsonSchema(value, readJson(schemaPath));
  if (errors.length) throw new Error(`${label} violates its schema:\n- ${errors.join("\n- ")}`);
}

function runAutonomyValidator(root) {
  const validator = resolveRepositoryFile(root, AUTONOMY_VALIDATOR_REF, "autonomy validator");
  const result = spawnSync(process.execPath, [validator, "--root", root], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (result.status !== 0) {
    throw new Error(`Canonical autonomy policy validation failed:\n${result.stderr || result.stdout}`);
  }
}

function hasJsonPointer(document, pointer) {
  if (pointer === "") return true;
  if (!pointer.startsWith("/")) return false;
  const parts = pointer.slice(1).split("/").map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"));
  let current = document;
  for (const part of parts) {
    if (current === null || typeof current !== "object" || !(part in current)) return false;
    current = current[part];
  }
  return true;
}

function ensureRefsExist(root, refs, label) {
  for (const ref of refs || []) resolveRepositoryFile(root, ref, label);
}

function validateFrontendAuthorityPolicy(policy) {
  if (policy?.authority?.rule !== "one-concern-one-authority-other-skills-may-advise-never-compete") {
    throw new Error("Frontend craft policy must preserve one-concern-one-authority routing.");
  }
  const expected = {
    productBehavior: "spec-driven-engineering",
    frontendArchitecture: "frontend-product-builder",
    visualCraft: "impeccable",
    behavioralInfluence: "behavioral-ux-contract"
  };
  for (const [key, value] of Object.entries(expected)) {
    if (policy?.authority?.[key] !== value) throw new Error(`Frontend authority '${key}' must remain '${value}'.`);
  }
  const prohibitedRedefinitions = new Set(policy?.guardrails?.impeccableMayNotSilentlyRedefine || []);
  for (const required of ["approved-product-behavior", "behavioral-ux-policy", "screen-contracts", "authentication-contracts"]) {
    if (!prohibitedRedefinitions.has(required)) {
      throw new Error(`Frontend craft policy must keep '${required}' outside silent provider redefinition.`);
    }
  }
}

function validateFindingRoute(root, ref) {
  const routePath = resolveRepositoryFile(root, ref, "findingRouteRef");
  const route = readJson(routePath);
  const schemaPath = resolveRepositoryFile(root, FINDING_ROUTE_SCHEMA_REF, "finding route schema");
  validateAgainst(route, schemaPath, "Frontend finding route");
  return route;
}

function requireContractRef(candidate, ref, label) {
  if (!(candidate.contractRefs || []).includes(ref)) {
    throw new Error(`${candidate.id}: ${label} must be present in candidate.contractRefs.`);
  }
}

function requireEvidenceRef(candidate, ref, label) {
  if (!(candidate.evidenceRefs || []).includes(ref)) {
    throw new Error(`${candidate.id}: ${label} must be present in candidate.evidenceRefs.`);
  }
}

function validateAutonomousEffects(request) {
  const effects = request.intendedEffects;
  if (effects.implementationOnly !== true) {
    throw new Error(`${request.choiceKind}: autonomous frontend routing requires implementationOnly=true.`);
  }
  if ((effects.canonicalContractWrites || []).length > 0) {
    throw new Error(`${request.choiceKind}: autonomous frontend routing cannot write canonical contracts; return to the canonical owner instead.`);
  }
  if (effects.externalEffects !== false) {
    throw new Error(`${request.choiceKind}: autonomous frontend routing cannot create external effects.`);
  }
}

function validateAutonomousBinding({ request, candidate, root, frontendPolicy }) {
  const binding = candidate.binding;
  if (binding.kind !== request.choiceKind) {
    throw new Error(`${candidate.id}: binding.kind '${binding.kind}' does not match choiceKind '${request.choiceKind}'.`);
  }

  if (request.choiceKind === "component-variant") {
    requireContractRef(candidate, binding.componentCatalogRef, "componentCatalogRef");
    const catalogPath = resolveRepositoryFile(root, binding.componentCatalogRef, "componentCatalogRef");
    const catalog = readJson(catalogPath);
    if (catalog?.meta?.status !== "approved") throw new Error(`${candidate.id}: component catalog must be approved for autonomous variant selection.`);
    const component = catalog?.components?.[binding.componentId];
    if (!component) throw new Error(`${candidate.id}: component '${binding.componentId}' does not exist in the approved catalog.`);
    if (component.status === "deprecated") throw new Error(`${candidate.id}: component '${binding.componentId}' is deprecated.`);
    if (!component.variants || !(binding.variantId in component.variants)) {
      throw new Error(`${candidate.id}: variant '${binding.variantId}' does not exist on component '${binding.componentId}'.`);
    }
    if (!(candidate.equivalenceEvidenceRefs || []).length) {
      throw new Error(`${candidate.id}: component-variant requires equivalenceEvidenceRefs before autonomy routing.`);
    }
  } else if (request.choiceKind === "responsive-layout-within-recipe") {
    requireContractRef(candidate, binding.recipeRef, "recipeRef");
    requireContractRef(candidate, binding.screenSpecRef, "screenSpecRef");
    resolveRepositoryFile(root, binding.recipeRef, "recipeRef");
    resolveRepositoryFile(root, binding.screenSpecRef, "screenSpecRef");
  } else if (request.choiceKind === "existing-spacing-token") {
    requireContractRef(candidate, binding.designSystemRef, "designSystemRef");
    const designSystemPath = resolveRepositoryFile(root, binding.designSystemRef, "designSystemRef");
    const designSystem = readJson(designSystemPath);
    if (!hasJsonPointer(designSystem, binding.tokenPointer)) {
      throw new Error(`${candidate.id}: tokenPointer '${binding.tokenPointer}' does not resolve in the approved Design System.`);
    }
  } else if (request.choiceKind === "craft-implementation-repair") {
    requireEvidenceRef(candidate, binding.findingRouteRef, "findingRouteRef");
    const route = validateFindingRoute(root, binding.findingRouteRef);
    if (route.finding?.defectKind !== "implementation" || route.route?.repairStrategy !== "targeted-implementation-repair" || route.route?.returnStage !== "PATCH") {
      throw new Error(`${candidate.id}: Finding Router does not authorize a targeted implementation PATCH; canonical contract repair is not autonomous.`);
    }
  } else if (request.choiceKind === "allowed-provider-command") {
    requireEvidenceRef(candidate, binding.findingRouteRef, "findingRouteRef");
    const route = validateFindingRoute(root, binding.findingRouteRef);
    if (route.finding?.defectKind !== "implementation" || route.route?.repairStrategy !== "targeted-implementation-repair") {
      throw new Error(`${candidate.id}: provider command must originate from an implementation finding route.`);
    }
    const providerCommand = route.route?.providerCommand;
    if (!providerCommand || providerCommand.name !== binding.command) {
      throw new Error(`${candidate.id}: requested provider command '${binding.command}' does not match the Finding Router command.`);
    }
    if (providerCommand.requiresExplicitApproval === true || !["managed", "findingDriven"].includes(providerCommand.governance)) {
      throw new Error(`${candidate.id}: provider command '${binding.command}' is not autonomous; its frontend policy governance requires explicit approval or a different authority.`);
    }
    const policyCommands = new Set(frontendPolicy?.commands?.[providerCommand.governance] || []);
    if (!policyCommands.has(binding.command)) {
      throw new Error(`${candidate.id}: provider command '${binding.command}' is not registered in frontend-craft-policy.json#commands.${providerCommand.governance}.`);
    }
  } else if (request.choiceKind === "reversible-refactor") {
    requireEvidenceRef(candidate, binding.implementationRef, "implementationRef");
    resolveRepositoryFile(root, binding.implementationRef, "implementationRef");
  }
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function bindingContractRefs(binding) {
  if (binding.kind === "component-variant") return [binding.componentCatalogRef];
  if (binding.kind === "responsive-layout-within-recipe") return [binding.recipeRef, binding.screenSpecRef];
  if (binding.kind === "existing-spacing-token") return [binding.designSystemRef];
  if (binding.kind === "consequential") return [binding.authorityRef];
  return [];
}

function bindingEvidenceRefs(binding) {
  if (["craft-implementation-repair", "allowed-provider-command"].includes(binding.kind)) return [binding.findingRouteRef];
  if (binding.kind === "reversible-refactor") return [binding.implementationRef];
  return [];
}

function routeRequest({ root, requestPath }) {
  runAutonomyValidator(root);
  const requestSchemaPath = resolveRepositoryFile(root, FRONTEND_REQUEST_SCHEMA_REF, "frontend autonomy request schema");
  const decisionSchemaPath = resolveRepositoryFile(root, AUTONOMY_DECISION_SCHEMA_REF, "autonomy decision schema");
  const effectiveSchemaPath = resolveRepositoryFile(root, EFFECTIVE_POLICY_SCHEMA_REF, "effective policy schema");
  const request = readJson(requestPath);
  validateAgainst(request, requestSchemaPath, "Frontend autonomy request");

  const effectivePolicyPath = resolveRepositoryFile(root, request.effectivePolicyRef, "effectivePolicyRef");
  const effectivePolicy = readJson(effectivePolicyPath);
  validateAgainst(effectivePolicy, effectiveSchemaPath, "Frontend autonomy effective policy");
  if (effectivePolicy.artifactKind !== "derived-effective-policy") throw new Error("effectivePolicyRef must target a derived-effective-policy artifact.");
  if (effectivePolicy.stage !== request.stage || effectivePolicy.feature !== request.feature || (effectivePolicy.task || null) !== (request.task || null)) {
    throw new Error("Frontend autonomy request context does not match the referenced effective policy.");
  }

  if (request.frontendCraftPolicyRef !== FRONTEND_CRAFT_POLICY_REF) {
    throw new Error(`frontendCraftPolicyRef must reference '${FRONTEND_CRAFT_POLICY_REF}'.`);
  }
  const frontendPolicyPath = resolveRepositoryFile(root, request.frontendCraftPolicyRef, "frontendCraftPolicyRef");
  const frontendPolicy = readJson(frontendPolicyPath);
  validateFrontendAuthorityPolicy(frontendPolicy);

  const autonomousClass = AUTONOMOUS_CHOICES.get(request.choiceKind);
  const consequentialClass = CONSEQUENTIAL_CHOICES.get(request.choiceKind);
  const decisionClass = autonomousClass || consequentialClass;
  if (!decisionClass) throw new Error(`Unknown frontend autonomy choiceKind '${request.choiceKind}'.`);

  const requestRef = repositoryRef(root, requestPath);
  if (autonomousClass) validateAutonomousEffects(request);

  for (const candidate of request.candidates) {
    ensureRefsExist(root, candidate.contractRefs, `${candidate.id}.contractRefs`);
    ensureRefsExist(root, candidate.precedentRefs, `${candidate.id}.precedentRefs`);
    ensureRefsExist(root, candidate.evidenceRefs, `${candidate.id}.evidenceRefs`);
    ensureRefsExist(root, candidate.equivalenceEvidenceRefs, `${candidate.id}.equivalenceEvidenceRefs`);

    if (autonomousClass) {
      validateAutonomousBinding({ request, candidate, root, frontendPolicy });
    } else {
      if (candidate.binding.kind !== "consequential") {
        throw new Error(`${candidate.id}: consequential choice '${request.choiceKind}' requires binding.kind=consequential.`);
      }
      requireContractRef(candidate, candidate.binding.authorityRef, "authorityRef");
      resolveRepositoryFile(root, candidate.binding.authorityRef, "authorityRef");
    }
  }

  for (const evidence of request.evidence) resolveRepositoryFile(root, evidence.ref, `evidence '${evidence.source}'`);

  const candidates = request.candidates.map(({ binding, ...candidate }) => ({
    ...candidate,
    contractRefs: unique([...candidate.contractRefs, FRONTEND_CRAFT_POLICY_REF, ...bindingContractRefs(binding)]),
    evidenceRefs: unique([...candidate.evidenceRefs, requestRef, ...bindingEvidenceRefs(binding)])
  }));

  const evidence = [...request.evidence];
  if (!evidence.some((item) => item.source === "canonical-contracts" && item.ref === FRONTEND_CRAFT_POLICY_REF)) {
    evidence.push({ source: "canonical-contracts", ref: FRONTEND_CRAFT_POLICY_REF });
  }

  const routed = {
    $schema: AUTONOMY_DECISION_SCHEMA_REF,
    schemaVersion: "1.0.0",
    artifactKind: "autonomy-decision-request",
    decisionClass,
    stage: request.stage,
    feature: request.feature,
    task: request.task,
    effectivePolicyRef: request.effectivePolicyRef,
    humanGateRequired: request.humanGateRequired,
    candidates,
    evidence
  };
  validateAgainst(routed, decisionSchemaPath, "Routed autonomy decision request");
  return routed;
}

const args = parseArgs(process.argv.slice(2));
const command = args._[0];
if (command !== "route") {
  console.error(usage());
  process.exit(1);
}

try {
  const root = path.resolve(String(args.root || DEFAULT_ROOT));
  if (typeof args.request !== "string") throw new Error(`route requires --request <frontend-autonomy-request.json>.\n${usage()}`);
  const requestPath = resolveRepositoryFile(root, String(args.request), "frontend autonomy request");
  const output = routeRequest({ root, requestPath });
  const serialized = `${JSON.stringify(output, null, 2)}\n`;
  if (typeof args.output === "string") {
    const outputPath = path.isAbsolute(args.output) ? path.resolve(args.output) : path.resolve(root, args.output);
    const resolvedRoot = path.resolve(root);
    if (outputPath !== resolvedRoot && !outputPath.startsWith(`${resolvedRoot}${path.sep}`)) throw new Error("--output must stay inside the project root.");
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, serialized);
    console.log(`Frontend autonomy decision request written: ${outputPath}`);
  } else {
    process.stdout.write(serialized);
  }
} catch (error) {
  console.error(`Frontend autonomy routing failed: ${error.message}`);
  process.exit(1);
}
