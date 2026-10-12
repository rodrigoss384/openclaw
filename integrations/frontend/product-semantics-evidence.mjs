#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateJsonSchema } from "../../skills/spec-driven-engineering/scripts/lib/json-schema.mjs";
import { validateNavigationCapability } from "./navigation-capability.mjs";
import { validateGlobalRetrieval } from "./global-retrieval.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.join(SCRIPT_DIR, "product-semantics-evidence.schema.json");
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, "../..");
const DEFAULT_RETRIEVAL_REF = "docs/frontend/global-retrieval.json";
const EVIDENCE_SIGNAL = "productSemantics.evidenceRef";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function normalizeRepoPath(value) {
  return String(value || "").split("#", 1)[0].replaceAll("\\", "/").replace(/^\.\//, "");
}

function relativeRepoPath(root, filePath) {
  return path.relative(root, filePath).replaceAll("\\", "/");
}

function resolveRepoRef(root, ref, label, errors) {
  const relative = normalizeRepoPath(ref);
  if (!relative) {
    errors.push({ code: "PRODUCT_SEMANTICS_REF_INVALID", message: `${label} must resolve to a repository path.` });
    return null;
  }
  const absolute = path.resolve(root, relative);
  const normalizedRoot = path.resolve(root);
  if (absolute !== normalizedRoot && !absolute.startsWith(`${normalizedRoot}${path.sep}`)) {
    errors.push({ code: "PRODUCT_SEMANTICS_REF_ESCAPE", message: `${label} escapes the repository root: ${ref}` });
    return null;
  }
  if (!fs.existsSync(absolute)) {
    errors.push({ code: "PRODUCT_SEMANTICS_REF_MISSING", message: `${label} does not exist: ${ref}` });
    return null;
  }
  return absolute;
}

function push(errors, code, message) {
  errors.push({ code, message });
}

function contractCandidates({ root, screen, screenRef, errors }) {
  const refs = new Set(asArray(screen?.architecture?.integrationContracts).map(normalizeRepoPath).filter(Boolean));
  if (fs.existsSync(path.join(root, DEFAULT_RETRIEVAL_REF))) refs.add(DEFAULT_RETRIEVAL_REF);

  let navigation = null;
  let retrieval = null;
  for (const ref of refs) {
    const absolute = path.resolve(root, ref);
    if (!absolute.startsWith(`${path.resolve(root)}${path.sep}`) || !fs.existsSync(absolute)) continue;
    let value;
    try {
      value = readJson(absolute);
    } catch {
      continue;
    }
    if (!navigation && value && typeof value === "object" && Array.isArray(value.modules) && typeof value.navigationMode === "string") {
      if (normalizeRepoPath(value.applicationShellScreenRef) === normalizeRepoPath(screenRef)) {
        navigation = { ref, path: absolute, value };
      }
    }
    if (!retrieval && value?.artifactKind === "global-retrieval-applicability") {
      const sameShell = normalizeRepoPath(value.applicationShellScreenRef) === normalizeRepoPath(screenRef);
      const sameProduct = normalizeRepoPath(value.productContextRef) === normalizeRepoPath(screen?.productContext?.source);
      const explicitAbsence = value.applicability === "not-applicable"
        || (value.applicability === "optional" && value.invocation?.mode === "none");
      if (sameShell || (explicitAbsence && sameProduct)) {
        retrieval = { ref, path: absolute, value };
      }
    }
  }
  return { navigation, retrieval };
}

function companionRefFromEvidence(evidence, errors) {
  const matches = asArray(evidence?.presenceSignals).filter((entry) => entry?.signal === EVIDENCE_SIGNAL);
  if (matches.length > 1) {
    push(errors, "PRODUCT_SEMANTICS_EVIDENCE_REF_DUPLICATE", `${EVIDENCE_SIGNAL} must appear at most once in presenceSignals.`);
  }
  const value = matches[0]?.value;
  return typeof value === "string" && value.trim() ? value : null;
}

function validateSemanticSection({ craft, evidence, companion, errors }) {
  const assignments = asArray(craft?.dimensions?.semanticPresentation?.assignments)
    .filter((assignment) => assignment?.presentationSignature);
  const section = companion.semanticDifferentiation;

  if (assignments.length === 0) {
    if (section.applicability !== "not-applicable" || section.observations.length !== 0) {
      push(errors, "PRODUCT_SEMANTICS_SIGNATURE_NA_DRIFT", "semanticDifferentiation must be not-applicable with no observations when the craft contract has no presentation signatures.");
    }
    return;
  }

  if (section.applicability !== "required") {
    push(errors, "PRODUCT_SEMANTICS_SIGNATURE_REQUIRED", "semanticDifferentiation evidence is required when the craft contract carries presentation signatures.");
    return;
  }

  const assignmentByTarget = new Map(assignments.map((assignment) => [assignment.targetId, assignment]));
  const renderedTargets = new Set(
    asArray(evidence?.elements)
      .filter((element) => element?.componentUsageId && element.rendered !== false)
      .map((element) => element.componentUsageId)
  );
  const observations = new Map();
  for (const observation of section.observations) {
    if (observations.has(observation.componentUsageId)) {
      push(errors, "PRODUCT_SEMANTICS_SIGNATURE_DUPLICATE", `Duplicate semantic observation for componentUsageId '${observation.componentUsageId}'.`);
      continue;
    }
    observations.set(observation.componentUsageId, observation);
    const assignment = assignmentByTarget.get(observation.componentUsageId);
    if (!assignment) {
      push(errors, "PRODUCT_SEMANTICS_SIGNATURE_UNKNOWN_TARGET", `Semantic observation '${observation.componentUsageId}' has no craft semanticPresentation assignment.`);
      continue;
    }
    if (observation.semanticRole !== assignment.semanticRole) {
      push(errors, "PRODUCT_SEMANTICS_SIGNATURE_ROLE_DRIFT", `Semantic observation '${observation.componentUsageId}' reports role '${observation.semanticRole}', expected '${assignment.semanticRole}'.`);
    }
    if (!sameJson(observation.presentationSignature, assignment.presentationSignature)) {
      push(errors, "PRODUCT_SEMANTICS_SIGNATURE_DRIFT", `Semantic observation '${observation.componentUsageId}' presentationSignature drifted from the craft contract.`);
    }
    const rendered = renderedTargets.has(observation.componentUsageId);
    if (observation.rendered !== rendered) {
      push(errors, "PRODUCT_SEMANTICS_SIGNATURE_RENDER_DRIFT", `Semantic observation '${observation.componentUsageId}' rendered=${observation.rendered}, but visual evidence rendered=${rendered}.`);
    }
  }

  for (const assignment of assignments) {
    if (renderedTargets.has(assignment.targetId) && !observations.has(assignment.targetId)) {
      push(errors, "PRODUCT_SEMANTICS_SIGNATURE_OBSERVATION_MISSING", `Rendered semantic target '${assignment.targetId}' requires a full presentationSignature observation.`);
    }
  }
}

function validateNavigationSection({ root, candidate, companion, errors }) {
  const section = companion.navigation;
  if (!candidate) {
    if (section.applicability !== "not-applicable" || section.contractRef !== null || section.contractSha256 !== null || section.modules.length !== 0) {
      push(errors, "PRODUCT_SEMANTICS_NAVIGATION_NA_DRIFT", "navigation evidence must be explicitly not-applicable with no contract/modules when no navigation contract applies to this screen.");
    }
    return;
  }

  if (section.applicability !== "required") {
    push(errors, "PRODUCT_SEMANTICS_NAVIGATION_REQUIRED", "navigation evidence is required for the application-shell navigation capability contract.");
    return;
  }

  const navigationValidation = validateNavigationCapability({ root, contractPath: candidate.path });
  for (const error of navigationValidation.errors) {
    push(errors, "PRODUCT_SEMANTICS_NAVIGATION_CONTRACT_INVALID", `Navigation contract invalid: ${error}`);
  }
  const expectedRef = relativeRepoPath(root, candidate.path);
  if (normalizeRepoPath(section.contractRef) !== expectedRef) {
    push(errors, "PRODUCT_SEMANTICS_NAVIGATION_REF_DRIFT", `navigation.contractRef must be '${expectedRef}'.`);
  }
  if (section.contractSha256 !== sha256(candidate.path)) {
    push(errors, "PRODUCT_SEMANTICS_NAVIGATION_HASH_DRIFT", "navigation.contractSha256 is stale or does not match the canonical navigation contract.");
  }

  const evidenceById = new Map();
  for (const item of section.modules) {
    if (evidenceById.has(item.id)) {
      push(errors, "PRODUCT_SEMANTICS_NAVIGATION_DUPLICATE", `Duplicate navigation evidence for module '${item.id}'.`);
      continue;
    }
    evidenceById.set(item.id, item);
  }

  for (const module of candidate.value.modules) {
    const observed = evidenceById.get(module.id);
    if (!observed) {
      push(errors, "PRODUCT_SEMANTICS_NAVIGATION_MODULE_MISSING", `Navigation module '${module.id}' has no rendered evidence entry.`);
      continue;
    }
    for (const field of ["capabilityRef", "availability", "presentation"]) {
      if (observed[field] !== module[field]) {
        push(errors, "PRODUCT_SEMANTICS_NAVIGATION_STATE_DRIFT", `Navigation module '${module.id}' ${field}='${observed[field]}' but contract requires '${module[field]}'.`);
      }
    }

    if (module.presentation === "navigate") {
      if (!observed.rendered || !observed.navigable || observed.destination !== module.route || observed.reasonVisible) {
        push(errors, "PRODUCT_SEMANTICS_NAVIGATION_ACTIVE_DRIFT", `Active navigation module '${module.id}' must be rendered, navigable to its exact route, and not expose an unavailable reason.`);
      }
    } else if (module.presentation === "hidden") {
      if (observed.rendered || observed.navigable || observed.destination !== null || observed.reasonVisible) {
        push(errors, "PRODUCT_SEMANTICS_NAVIGATION_HIDDEN_DRIFT", `Hidden navigation module '${module.id}' must remain absent and non-navigable.`);
      }
    } else {
      if (!observed.rendered || observed.navigable || observed.destination !== null || !observed.reasonVisible) {
        push(errors, "PRODUCT_SEMANTICS_NAVIGATION_UNAVAILABLE_DRIFT", `Unavailable navigation module '${module.id}' must be visibly non-active, non-navigable, and expose its reason.`);
      }
    }
  }

  for (const id of evidenceById.keys()) {
    if (!candidate.value.modules.some((module) => module.id === id)) {
      push(errors, "PRODUCT_SEMANTICS_NAVIGATION_UNKNOWN_MODULE", `Navigation evidence contains unknown module '${id}'.`);
    }
  }
}

function validateRetrievalSection({ root, candidate, companion, errors }) {
  const section = companion.globalRetrieval;
  if (!candidate) {
    if (section.applicability !== "not-applicable" || section.contractRef !== null || section.contractSha256 !== null || section.trigger !== null || section.observedState !== "not-applicable" || section.resultAuthorization !== null) {
      push(errors, "PRODUCT_SEMANTICS_RETRIEVAL_NA_DRIFT", "globalRetrieval evidence must be explicitly not-applicable when no retrieval contract applies to this product context.");
    }
    return;
  }

  const retrievalValidation = validateGlobalRetrieval({ root, contractPath: candidate.path });
  for (const error of retrievalValidation.errors) {
    push(errors, "PRODUCT_SEMANTICS_RETRIEVAL_CONTRACT_INVALID", `Global retrieval contract invalid: ${error}`);
  }
  const expectedRef = relativeRepoPath(root, candidate.path);
  if (section.applicability !== candidate.value.applicability) {
    push(errors, "PRODUCT_SEMANTICS_RETRIEVAL_APPLICABILITY_DRIFT", `globalRetrieval.applicability='${section.applicability}' but contract requires '${candidate.value.applicability}'.`);
  }
  if (normalizeRepoPath(section.contractRef) !== expectedRef) {
    push(errors, "PRODUCT_SEMANTICS_RETRIEVAL_REF_DRIFT", `globalRetrieval.contractRef must be '${expectedRef}'.`);
  }
  if (section.contractSha256 !== sha256(candidate.path)) {
    push(errors, "PRODUCT_SEMANTICS_RETRIEVAL_HASH_DRIFT", "globalRetrieval.contractSha256 is stale or does not match the canonical retrieval contract.");
  }

  const optionalAbsent = candidate.value.applicability === "optional" && candidate.value.invocation?.mode === "none";
  if (candidate.value.applicability === "not-applicable" || optionalAbsent) {
    if (section.trigger !== null || section.observedState !== "not-applicable" || section.resultAuthorization !== null) {
      const code = optionalAbsent ? "PRODUCT_SEMANTICS_RETRIEVAL_OPTIONAL_ABSENCE_DRIFT" : "PRODUCT_SEMANTICS_RETRIEVAL_NA_RENDERED";
      const label = optionalAbsent ? "optional absent" : "not-applicable";
      push(errors, code, `${label} global retrieval must have no trigger, no runtime state and no result authorization evidence.`);
    }
    return;
  }

  const trigger = section.trigger;
  if (!trigger) {
    push(errors, "PRODUCT_SEMANTICS_RETRIEVAL_TRIGGER_MISSING", "Implemented global retrieval requires structural trigger evidence.");
  } else {
    if (candidate.value.invocation.globalEntryRequired && !trigger.rendered) {
      push(errors, "PRODUCT_SEMANTICS_RETRIEVAL_TRIGGER_NOT_RENDERED", "Implemented global retrieval requires its global entry to be rendered.");
    }
    if (trigger.invocationMode !== candidate.value.invocation.mode) {
      push(errors, "PRODUCT_SEMANTICS_RETRIEVAL_INVOCATION_DRIFT", `Observed retrieval invocation '${trigger.invocationMode}' differs from contract '${candidate.value.invocation.mode}'.`);
    }
    if (candidate.value.invocation.accessibleTriggerRequired && !(typeof trigger.accessibleName === "string" && trigger.accessibleName.trim())) {
      push(errors, "PRODUCT_SEMANTICS_RETRIEVAL_ACCESSIBLE_NAME_MISSING", "Global retrieval trigger requires a non-empty accessible name.");
    }
    if (candidate.value.invocation.focusManagementRequired && !trigger.focusManaged) {
      push(errors, "PRODUCT_SEMANTICS_RETRIEVAL_FOCUS_DRIFT", "Global retrieval focus-management evidence is required by the contract.");
    }
    if (trigger.shortcutObserved !== candidate.value.shortcut) {
      push(errors, "PRODUCT_SEMANTICS_RETRIEVAL_SHORTCUT_DRIFT", `Observed shortcut '${trigger.shortcutObserved}' differs from contract '${candidate.value.shortcut}'.`);
    }
  }

  if (!candidate.value.resultContract?.requiredStates?.includes(section.observedState)) {
    push(errors, "PRODUCT_SEMANTICS_RETRIEVAL_STATE_DRIFT", `Observed retrieval state '${section.observedState}' is not required by the global retrieval result contract.`);
  }

  const authorization = section.resultAuthorization;
  if (!authorization) {
    push(errors, "PRODUCT_SEMANTICS_RETRIEVAL_AUTH_EVIDENCE_MISSING", "Implemented retrieval requires authorization-aware result-state evidence even when the current screenshot captures another state.");
    return;
  }
  if (authorization.authorizationMode !== candidate.value.authorizationMode) {
    push(errors, "PRODUCT_SEMANTICS_RETRIEVAL_AUTH_MODE_DRIFT", `Result authorization mode '${authorization.authorizationMode}' differs from contract '${candidate.value.authorizationMode}'.`);
  }
  const allowedEntityIds = new Set(candidate.value.searchableEntityTypes.map((entry) => entry.id));
  for (const entityId of authorization.observedEntityTypes) {
    if (!allowedEntityIds.has(entityId)) {
      push(errors, "PRODUCT_SEMANTICS_RETRIEVAL_ENTITY_LEAK", `Authorization-aware result evidence contains undeclared entity type '${entityId}'.`);
    }
  }
  if (section.observedState === "results" && authorization.observedEntityTypes.length === 0) {
    push(errors, "PRODUCT_SEMANTICS_RETRIEVAL_RESULTS_EMPTY", "observedState=results requires at least one observed authorized entity type.");
  }

  if (!candidate.value.backendContractRef) return;
  const backendPath = resolveRepoRef(root, candidate.value.backendContractRef, "global retrieval backendContractRef", errors);
  if (!backendPath) return;
  let backend;
  try {
    backend = readJson(backendPath);
  } catch (error) {
    push(errors, "PRODUCT_SEMANTICS_RETRIEVAL_BACKEND_INVALID", `Cannot parse retrieval backend contract: ${error.message}`);
    return;
  }
  const requiredNegativeRef = normalizeRepoPath(backend?.tenantIsolation?.negativeTestRef);
  const allowedRefs = new Set([
    requiredNegativeRef,
    ...asArray(backend?.evidenceRefs).map(normalizeRepoPath)
  ].filter(Boolean));
  const observedRefs = authorization.authorizationEvidenceRefs.map(normalizeRepoPath);
  if (requiredNegativeRef && !observedRefs.includes(requiredNegativeRef)) {
    push(errors, "PRODUCT_SEMANTICS_RETRIEVAL_TENANT_NEGATIVE_MISSING", `Authorization evidence must include tenant isolation negative test '${requiredNegativeRef}'.`);
  }
  if (!observedRefs.some((ref) => asArray(backend?.evidenceRefs).map(normalizeRepoPath).includes(ref))) {
    push(errors, "PRODUCT_SEMANTICS_RETRIEVAL_BACKEND_EVIDENCE_MISSING", "Authorization-aware results must reference at least one backend retrieval evidence artifact.");
  }
  for (const [index, ref] of observedRefs.entries()) {
    if (!allowedRefs.has(ref)) {
      push(errors, "PRODUCT_SEMANTICS_RETRIEVAL_EVIDENCE_UNBOUND", `authorizationEvidenceRefs[${index}] is not declared by the backend retrieval contract: ${ref}`);
      continue;
    }
    resolveRepoRef(root, ref, `authorizationEvidenceRefs[${index}]`, errors);
  }
}

export function validateProductSemanticsEvidence({ root, screenRef, screen, designSystem, craft, evidence }) {
  const errors = [];
  const { navigation, retrieval } = contractCandidates({ root, screen, screenRef, errors });
  const semanticRelevant = asArray(craft?.dimensions?.semanticPresentation?.assignments).some((assignment) => assignment?.presentationSignature);
  const relevant = semanticRelevant || Boolean(navigation) || Boolean(retrieval);
  const companionRef = companionRefFromEvidence(evidence, errors);

  if (!relevant && !companionRef) return errors;
  if (!companionRef) {
    push(errors, "PRODUCT_SEMANTICS_EVIDENCE_REF_MISSING", `${EVIDENCE_SIGNAL} is required in visual-composition-evidence.presenceSignals when Phase 10 product semantics apply.`);
    return errors;
  }

  const companionPath = resolveRepoRef(root, companionRef, EVIDENCE_SIGNAL, errors);
  if (!companionPath) return errors;
  let companion;
  try {
    companion = readJson(companionPath);
  } catch (error) {
    push(errors, "PRODUCT_SEMANTICS_EVIDENCE_JSON_INVALID", `Product semantics evidence is not valid JSON: ${error.message}`);
    return errors;
  }
  const schema = readJson(SCHEMA_PATH);
  for (const error of validateJsonSchema(companion, schema)) {
    push(errors, "PRODUCT_SEMANTICS_EVIDENCE_SCHEMA", error);
  }
  if (errors.some((error) => error.code === "PRODUCT_SEMANTICS_EVIDENCE_SCHEMA")) return errors;

  if (companion.screenId !== evidence?.meta?.screenId || companion.screenId !== screen?.screen?.id) {
    push(errors, "PRODUCT_SEMANTICS_SCREEN_DRIFT", `Product semantics evidence screenId '${companion.screenId}' does not match visual/screen contracts.`);
  }
  if (companion.stateId !== evidence?.meta?.stateId) {
    push(errors, "PRODUCT_SEMANTICS_STATE_DRIFT", `Product semantics evidence stateId '${companion.stateId}' does not match visual evidence state '${evidence?.meta?.stateId}'.`);
  }

  validateSemanticSection({ designSystem, craft, evidence, companion, errors });
  validateNavigationSection({ root, candidate: navigation, companion, errors });
  validateRetrievalSection({ root, candidate: retrieval, companion, errors });
  return errors;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      index += 1;
    } else args[key] = true;
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = path.resolve(String(args.root || DEFAULT_ROOT));
  for (const required of ["screen", "design-system", "craft", "evidence"]) {
    if (!args[required]) {
      process.stderr.write(`--${required} is required.\n`);
      process.exit(2);
    }
  }
  const screenPath = path.resolve(root, String(args.screen));
  const designPath = path.resolve(root, String(args["design-system"]));
  const craftPath = path.resolve(root, String(args.craft));
  const evidencePath = path.resolve(root, String(args.evidence));
  try {
    const errors = validateProductSemanticsEvidence({
      root,
      screenRef: relativeRepoPath(root, screenPath),
      screen: readJson(screenPath),
      designSystem: readJson(designPath),
      craft: readJson(craftPath),
      evidence: readJson(evidencePath)
    });
    if (errors.length) {
      for (const error of errors) process.stderr.write(`[${error.code}] ${error.message}\n`);
      process.exit(1);
    }
    process.stdout.write("Product semantics evidence valid.\n");
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
