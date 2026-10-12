#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { parseArgs, printReport } from "./lib/workflow-utils.mjs";

const USAGE = "node validate-applicability-contract.mjs <applicability.md> [--root <project-root>] [--base-ref <ref>]";

// Declaring frontend/backend `not-applicable` used to remove every RULE-FE-*/
// RULE-BE-* enforcement from requiredEnforcements with nothing cross-checking
// that against what actually changed. This closes that hole: it diffs the
// working tree (and, when --base-ref is given, the committed range too) and
// flags an applicability field that contradicts what was actually touched.
// Narrow, unambiguous signals only — this must never fire on ordinary
// non-frontend/non-backend file churn (docs, scripts, config).
const FRONTEND_SIGNAL_EXTENSIONS = /\.(tsx|jsx|vue|svelte)$/i;
const FRONTEND_SIGNAL_BASENAMES = new Set([
  "screen-spec.json",
  "design-system.json",
  "composition-proof.json",
  "visual-composition-evidence.json",
  "visual-quality-scorecard.json",
  "styling-authority.json",
  "craft-contract.json"
]);
const BACKEND_SIGNAL_EXTENSIONS = /\.rs$/i;
let sourceDirectories = { frontendPaths: [], backendPaths: [] };
const under = (file, roots) => roots.some(root => file === root || file.startsWith(`${root.replace(/\/$/, "")}/`));
const BACKEND_SIGNAL_BASENAMES = new Set(["backend-change-manifest.json", "cargo.toml"]);

function isFrontendSignal(filePath) {
  const normalized = filePath.replaceAll("\\", "/");
  if (FRONTEND_SIGNAL_EXTENSIONS.test(normalized) || under(normalized, sourceDirectories.frontendPaths)) return true;
  if (normalized.startsWith("docs/frontend/")) return true;
  return FRONTEND_SIGNAL_BASENAMES.has(path.basename(normalized));
}

function directorySegments(filePath) {
  return filePath.replaceAll("\\", "/").split("/").slice(0, -1);
}

function hasDirectorySegment(filePath, names) {
  return directorySegments(filePath).some(segment => names.has(segment));
}

function isBackendSignal(filePath) {
  const normalized = filePath.replaceAll("\\", "/");
  if (BACKEND_SIGNAL_EXTENSIONS.test(normalized) || under(normalized, sourceDirectories.backendPaths) || /^(?:apps|services)\/(?:api|backend)\//.test(normalized)) return true;
  if (normalized.startsWith("docs/backend/")) return true;
  if (normalized.startsWith("openapi/") || normalized.startsWith("asyncapi/") || normalized.startsWith("proto/")) return true;
  return BACKEND_SIGNAL_BASENAMES.has(path.basename(normalized).toLowerCase());
}

function runGit(root, gitArgs) {
  const result = spawnSync("git", gitArgs, { cwd: root, encoding: "utf8" });
  if (result.error || result.status !== 0) return null;
  return result.stdout.split("\0").filter(Boolean);
}

// Returns null when git itself is unavailable (no repo, no binary) so the
// caller can report the check as not-run instead of silently passing.
function collectChangedFiles(root, baseRef) {
  const collected = [];
  const uncommitted = runGit(root, ["diff", "--name-only", "-z", "HEAD"]);
  if (uncommitted) collected.push(...uncommitted);
  const untracked = runGit(root, ["ls-files", "-z", "--others", "--exclude-standard"]);
  if (untracked) collected.push(...untracked);
  if (uncommitted === null || untracked === null) return null;
  if (baseRef) {
    const committedRange = runGit(root, ["diff", "--name-only", "-z", `${baseRef}...HEAD`]);
    if (committedRange === null) throw new Error(`Cannot compare frozen baseline ${baseRef}`);
    collected.push(...committedRange);
  }
  return [...new Set(collected)];
}

const FIELD_ENUMS = {
  complexity: ["quick", "small", "medium", "large", "complex"],
  criticality: ["low", "standard", "critical"],
  frontend: ["not-applicable", "lightweight", "substantial"],
  backend: ["not-applicable", "lightweight", "substantial"],
  persistence: ["not-applicable", "affected"],
  "public-api": ["unchanged", "compatible", "breaking", "new"],
  auth: ["not-applicable", "affected"],
  tenancy: ["not-applicable", "affected"],
  concurrency: ["not-applicable", "affected"],
  migration: ["not-applicable", "required"],
  "new-service-or-subsystem": ["not-applicable", "applicable"],
  "material-operational-cost": ["not-applicable", "applicable"],
  performance: ["not-applicable", "standard", "critical"],
  accessibility: ["not-applicable", "required"],
  "frontend-representative-gate": ["not-required", "required"],
  "backend-representative-gate": ["not-required", "required"],
  "browser-evidence": ["not-required", "hard-required"],
  "contract-drift-check": ["not-applicable", "required"],
  "interface-contract": ["not-applicable", "applicable"],
  "interface-contract-kind": ["none", "http", "event", "graphql", "grpc", "job", "cli"],
  "interface-contract-type": ["none", "openapi", "asyncapi", "graphql-sdl", "protobuf", "arazzo", "custom"],
  "behavioral-ux": ["not-applicable", "applicable"],
  "behavioral-ux-risk": ["none", "standard", "high-risk"],
  "outcome-evidence": ["not-applicable", "applicable"]
};

const ALLOWED_CONTRACT_TYPES_BY_KIND = {
  none: ["none"],
  http: ["openapi", "arazzo", "custom"],
  event: ["asyncapi", "arazzo", "custom"],
  graphql: ["graphql-sdl", "custom"],
  grpc: ["protobuf", "custom"],
  job: ["arazzo", "custom"],
  cli: ["custom"]
};

const args = parseArgs(process.argv.slice(2));
const inputPath = args._[0];
const errors = [];
const warnings = [];
const information = [];

if (!inputPath) {
  errors.push(`Missing input file.\nUsage: ${USAGE}`);
} else {
  const resolvedPath = path.resolve(inputPath);

  if (!fs.existsSync(resolvedPath)) {
    errors.push(`applicability.md not found: ${resolvedPath}`);
  } else {
    const content = fs.readFileSync(resolvedPath, "utf8");

    const unresolvedPlaceholders = [...content.matchAll(/\{\{[A-Z][A-Z0-9_]*\}\}/g)].map((match) => match[0]);
    if (unresolvedPlaceholders.length > 0) {
      errors.push(`Unresolved placeholders remain: ${[...new Set(unresolvedPlaceholders)].join(", ")}`);
    }

    const fieldPattern = /^([a-z][a-z-]*):\s*(.+)$/gm;
    const values = new Map();
    for (const match of content.matchAll(fieldPattern)) {
      const [, field, rawValue] = match;
      if (!(field in FIELD_ENUMS)) continue;
      const value = rawValue.trim().replace(/^<|>$/g, "");
      values.set(field, value);
    }

    for (const field of Object.keys(FIELD_ENUMS)) {
      if (!values.has(field)) {
        errors.push(`Required field is missing: ${field}`);
        continue;
      }
      const value = values.get(field);
      if (value.startsWith("<") || value.includes("|")) {
        errors.push(`Field '${field}' still has an unresolved template value: ${value}`);
        continue;
      }
      if (!FIELD_ENUMS[field].includes(value)) {
        errors.push(`Field '${field}' has an invalid value '${value}'. Allowed: ${FIELD_ENUMS[field].join(", ")}`);
      }
    }

    if (values.size > 0) {
      if (values.get("frontend") === "substantial" && values.get("frontend-representative-gate") !== "required") {
        errors.push("frontend: substantial requires frontend-representative-gate: required");
      }
      if (values.get("frontend") && values.get("frontend") !== "not-applicable" && values.get("browser-evidence") !== "hard-required") {
        errors.push("frontend != not-applicable requires browser-evidence: hard-required");
      }
      if (values.get("frontend") === "not-applicable" && values.get("accessibility") === "required") {
        warnings.push("accessibility: required is unusual when frontend: not-applicable — confirm this is intentional");
      }
      const backendGateTriggers = [
        "public-api", "persistence", "auth", "tenancy", "criticality",
        "complexity", "new-service-or-subsystem", "material-operational-cost"
      ];
      const backendGateShouldBeRequired = values.get("backend") === "substantial" && (
        (values.get("public-api") && values.get("public-api") !== "unchanged") ||
        values.get("persistence") === "affected" ||
        values.get("auth") === "affected" ||
        values.get("tenancy") === "affected" ||
        values.get("criticality") === "critical" ||
        ["large", "complex"].includes(values.get("complexity")) ||
        values.get("new-service-or-subsystem") === "applicable" ||
        values.get("material-operational-cost") === "applicable"
      );
      if (backendGateShouldBeRequired && values.get("backend-representative-gate") !== "required") {
        errors.push(`backend: substantial with a material boundary (${backendGateTriggers.join("/")}) requires backend-representative-gate: required — see deriveBackendRepresentativeGate in applicability-contract.md`);
      }

      const interfaceContractApplicable = values.get("interface-contract") === "applicable";
      if (interfaceContractApplicable) {
        const kind = values.get("interface-contract-kind");
        const contractType = values.get("interface-contract-type");
        if (!kind || kind === "none") errors.push("interface-contract: applicable requires interface-contract-kind other than none");
        if (!contractType || contractType === "none") errors.push("interface-contract: applicable requires interface-contract-type other than none");
        if (kind && contractType && kind !== "none" && contractType !== "none") {
          const allowed = ALLOWED_CONTRACT_TYPES_BY_KIND[kind] || [];
          if (!allowed.includes(contractType)) {
            errors.push(`interface-contract-kind '${kind}' is incompatible with interface-contract-type '${contractType}' (allowed: ${allowed.join(", ")})`);
          }
        }
      } else {
        if (values.get("interface-contract-kind") && values.get("interface-contract-kind") !== "none") {
          errors.push("interface-contract: not-applicable requires interface-contract-kind: none");
        }
        if (values.get("interface-contract-type") && values.get("interface-contract-type") !== "none") {
          errors.push("interface-contract: not-applicable requires interface-contract-type: none");
        }
      }

      if (values.get("behavioral-ux") === "not-applicable" && values.get("behavioral-ux-risk") && values.get("behavioral-ux-risk") !== "none") {
        errors.push("behavioral-ux: not-applicable requires behavioral-ux-risk: none");
      }
      if (values.get("behavioral-ux") === "applicable" && values.get("behavioral-ux-risk") === "none") {
        errors.push("behavioral-ux: applicable requires behavioral-ux-risk other than none");
      }

      if (values.get("behavioral-ux") === "applicable" && values.get("outcome-evidence") !== "applicable") {
        errors.push("behavioral-ux: applicable requires outcome-evidence: applicable — a behavioral hypothesis without an outcome-evidence artifact never gets checked against real usage");
      }

      const materialBoundary = values.get("auth") === "affected"
        || values.get("tenancy") === "affected"
        || values.get("persistence") === "affected"
        || values.get("migration") === "required"
        || values.get("material-operational-cost") === "applicable"
        || values.get("public-api") === "breaking"
        || values.get("public-api") === "new";
      if (values.get("criticality") === "low" && materialBoundary) {
        errors.push("criticality: low contradicts a material auth, tenancy, persistence, migration, cost, or public-api field");
      }

      const diffRoot = args.root ? path.resolve(String(args.root)) : process.cwd();
      const baseRef = typeof args["base-ref"] === "string" ? args["base-ref"] : null;
      let changedFiles = null;
      try {
        if (args.context) {
          const context = JSON.parse(fs.readFileSync(path.resolve(diffRoot, String(args.context)), "utf8"));
          if (!baseRef || context.baseCommit !== baseRef) throw new Error("Applicability baseline differs from frozen execution context");
          sourceDirectories = context;
        }
        changedFiles = collectChangedFiles(diffRoot, baseRef);
      } catch (error) { errors.push(error.message); }
      if (changedFiles === null) {
        errors.push("Diff cross-check not-run: git is unavailable, baseline is invalid or the project root is not a Git repository.");
      } else {
        const frontendTouched = changedFiles.filter(isFrontendSignal);
        const backendTouched = changedFiles.filter(isBackendSignal);
        if (values.get("frontend") === "not-applicable" && frontendTouched.length > 0) {
          errors.push(`Applicability declares frontend: not-applicable, but the diff touches frontend-shaped file(s): ${frontendTouched.slice(0, 10).join(", ")}${frontendTouched.length > 10 ? ", ..." : ""}. Update applicability.md or confirm these are not frontend changes.`);
        }
        if (values.get("backend") === "not-applicable" && backendTouched.length > 0) {
          errors.push(`Applicability declares backend: not-applicable, but the diff touches backend-shaped file(s): ${backendTouched.slice(0, 10).join(", ")}${backendTouched.length > 10 ? ", ..." : ""}. Update applicability.md or confirm these are not backend changes.`);
        }
        const migrationTouched = changedFiles.filter(file => hasDirectorySegment(file, new Set(["migrations"])));
        if (migrationTouched.length > 0 && (values.get("migration") === "not-applicable" || values.get("persistence") === "not-applicable")) {
          errors.push(`Applicability declares migration or persistence not-applicable, but the diff touches migrations/: ${migrationTouched.slice(0, 10).join(", ")}`);
        }
        const authTouched = changedFiles.filter(file => hasDirectorySegment(file, new Set(["auth", "authn", "authentication"])));
        if (values.get("auth") === "not-applicable" && authTouched.length > 0) {
          errors.push(`Applicability declares auth: not-applicable, but the diff touches auth/: ${authTouched.slice(0, 10).join(", ")}`);
        }
        const tenancyTouched = changedFiles.filter(file => hasDirectorySegment(file, new Set(["tenancy"])));
        if (values.get("tenancy") === "not-applicable" && tenancyTouched.length > 0) {
          errors.push(`Applicability declares tenancy: not-applicable, but the diff touches tenancy/: ${tenancyTouched.slice(0, 10).join(", ")}`);
        }
      }
    }

    information.push(`Fields recognized: ${values.size}/${Object.keys(FIELD_ENUMS).length}`);
  }
}

const ok = printReport("Spec-Driven Engineering — Applicability Contract Validation", errors, warnings, information);
process.exitCode = ok ? 0 : 1;
