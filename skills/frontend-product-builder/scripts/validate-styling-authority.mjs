#!/usr/bin/env node
import fs from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { IssueCollector, parseCliArgs, resolveFromCwd } from "./lib/screen-contract-utils.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultSchema = path.resolve(scriptDirectory, "../assets/schemas/styling-authority.schema.json");
const collector = new IssueCollector();
const PRODUCT_DESIGN_VOLATILE_KEYS = new Set(["absolutePath", "capturedAt", "completedAt", "generatedAt", "originalPath", "startedAt", "timestamp"]);

function canonicalProductDesignValue(value) {
  if (Array.isArray(value)) return value.map(canonicalProductDesignValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => key !== "semanticDigest" && !PRODUCT_DESIGN_VOLATILE_KEYS.has(key))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => [key, canonicalProductDesignValue(child)]));
}

function productDesignDigest(value) {
  return crypto.createHash("sha256").update(JSON.stringify(canonicalProductDesignValue(value))).digest("hex");
}

function containsPlaceholder(value) {
  if (typeof value === "string") return /<[^<>]+>|\{\{[^}]+\}\}/.test(value);
  if (Array.isArray(value)) return value.some(containsPlaceholder);
  if (value && typeof value === "object") return Object.values(value).some(containsPlaceholder);
  return false;
}

function isExternalReference(value) {
  return /^https?:\/\//i.test(value);
}

async function validateRetainedReference(reference, location, root, collector) {
  if (isExternalReference(reference)) return;

  const referencePath = String(reference).split("#", 1)[0].replaceAll("\\", "/");
  const normalized = path.posix.normalize(referencePath);
  if (path.posix.isAbsolute(normalized) || normalized === ".." || normalized.startsWith("../")) {
    collector.error("REFERENCE_OUTSIDE_REPOSITORY", "Retained authority evidence must use a repository-relative path or an external URL.", location);
    return;
  }
  if (normalized === ".field-test" || normalized.startsWith(".field-test/")) {
    collector.error("TRANSIENT_REFERENCE_FORBIDDEN", "Canonical styling authority cannot depend on transient .field-test evidence; copy the approved evidence into a canonical retained path.", location);
    return;
  }

  try {
    const stat = await fs.stat(path.resolve(root, normalized));
    if (!stat.isFile() || stat.size === 0) {
      collector.error("RETAINED_REFERENCE_INVALID", "Retained authority evidence must resolve to a non-empty file.", location);
    }
  } catch {
    collector.error("RETAINED_REFERENCE_MISSING", "Retained authority evidence does not resolve inside the repository.", location);
  }
}

try {
  const rawArguments = process.argv.slice(2);
  const skipReferences = rawArguments.includes("--skip-references");
  const checkReferences = !skipReferences;
  const options = parseCliArgs(rawArguments.filter(
    (argument) => argument !== "--check-references" && argument !== "--skip-references"
  ));
  const contractArgument = options.positional[0];
  if (!contractArgument) throw new Error("Provide the styling-authority JSON path as the first positional argument.");

  const contractPath = resolveFromCwd(contractArgument);
  const schemaPath = options.schema ? resolveFromCwd(options.schema) : defaultSchema;
  const contract = JSON.parse(await fs.readFile(contractPath, "utf8"));
  const schema = JSON.parse(await fs.readFile(schemaPath, "utf8"));
  const ajv = new Ajv2020({ allErrors: true, strict: true, validateFormats: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);

  if (!validate(contract)) {
    for (const error of validate.errors || []) {
      collector.error("SCHEMA_VIOLATION", error.message || "Schema violation.", error.instancePath || "/", error.params);
    }
  }
  if (containsPlaceholder(contract)) {
    collector.error("UNRESOLVED_PLACEHOLDER", "The styling authority contains unresolved placeholders.", contractPath);
  }

  const isV2 = contract.version === "2.0.0";
  const approvedReferences = (contract.visualReferences || []).filter((item) => item.status === (isV2 ? "adopted" : "approved"));
  if (["ready", "approved"].includes(contract.status) && approvedReferences.length === 0) {
    collector.error("APPROVED_REFERENCE_MISSING", "Ready or approved styling authority requires at least one approved visual reference.", "/visualReferences");
  }
  if (contract.version === "1.0.0") {
    collector.warning("STYLING_AUTHORITY_V1_SHADOW_ONLY", "Styling Authority v1 remains valid only for explicit legacy/shadow consumption; migrate explicitly before Product Design Authority promotion.", "/version");
  }

  for (const stylesheet of contract.authority?.globalStylesheets || []) {
    if (stylesheet.allowedRoles?.includes("legacy-global-components") && stylesheet.componentSelectors === "forbidden") {
      collector.error("LEGACY_POLICY_CONTRADICTION", "A stylesheet owning legacy global components cannot declare all component selectors forbidden.", stylesheet.path);
    }
    if (stylesheet.componentSelectors !== "forbidden") {
      const approvedException = (contract.exceptions || []).some((item) => item.status === "approved" && item.scope.includes(stylesheet.path));
      const legacyAuthority = contract.authority?.primaryMechanism === "global-css-legacy" && stylesheet.componentSelectors === "legacy-only";
      if (!approvedException && !legacyAuthority) {
        collector.error("GLOBAL_COMPONENT_SELECTOR_UNAUTHORIZED", "Component selectors in a global stylesheet require legacy authority or an approved scoped exception.", stylesheet.path);
      }
    }
  }

  for (const exception of contract.exceptions || []) {
    if (exception.status === "approved" && (!exception.approvedBy || !exception.approvedAt)) {
      collector.error("EXCEPTION_APPROVAL_INCOMPLETE", "Approved styling exceptions require approver and timestamp.", exception.id);
    }
  }

  if (checkReferences) {
    const referenceRoot = process.cwd();
    for (const [index, reference] of (contract.repositoryEvidence?.inspectedFiles || []).entries()) {
      await validateRetainedReference(reference, `/repositoryEvidence/inspectedFiles/${index}`, referenceRoot, collector);
    }
    if (isV2) {
      await validateRetainedReference(contract.visualResearch?.ref, "/visualResearch/ref", referenceRoot, collector);
      try {
        const research = JSON.parse(await fs.readFile(path.resolve(referenceRoot, contract.visualResearch.ref), "utf8"));
        const currentDigest = productDesignDigest(research);
        if (research.artifactKind !== "visual-research" || currentDigest !== research.semanticDigest
          || currentDigest !== contract.visualResearch.semanticDigest) {
          collector.error("VISUAL_RESEARCH_DIGEST_STALE", "Styling Authority v2 must point to a current visual-research artifact with the exact semantic digest.", "/visualResearch");
        }
        const referenceIds = new Set((research.references || []).map((item) => item.id));
        for (const [index, reference] of approvedReferences.entries()) {
          if (reference.visualResearchDigest !== currentDigest) {
            collector.error("VISUAL_REFERENCE_DIGEST_STALE", "Adopted reference digest does not match visual-research.", `/visualReferences/${index}/visualResearchDigest`);
          }
          if (!referenceIds.has(reference.referenceId)) {
            collector.error("VISUAL_REFERENCE_NOT_FOUND", "Adopted reference ID is absent from visual-research.", `/visualReferences/${index}/referenceId`);
          }
        }
      } catch (error) {
        collector.error("VISUAL_RESEARCH_INVALID", `Cannot validate visual-research: ${error.message}`, "/visualResearch/ref");
      }
    } else {
      for (const [index, reference] of approvedReferences.entries()) {
        await validateRetainedReference(reference.source, `/visualReferences/${index}/source`, referenceRoot, collector);
        for (const [evidenceIndex, evidence] of (reference.evidence || []).entries()) {
          await validateRetainedReference(evidence, `/visualReferences/${index}/evidence/${evidenceIndex}`, referenceRoot, collector);
        }
      }
    }
  }

  if (!collector.hasErrors()) {
    collector.info("STYLING_AUTHORITY_VALID", "Styling authority is structurally and semantically valid.", contractPath);
  }
  collector.print("Frontend Styling Authority Validation", { json: options.json });
  process.exitCode = collector.shouldFail(options.strictWarnings) ? 1 : 0;
} catch (error) {
  collector.error("VALIDATION_FAILED", error.message);
  collector.print("Frontend Styling Authority Validation");
  process.exitCode = 1;
}
