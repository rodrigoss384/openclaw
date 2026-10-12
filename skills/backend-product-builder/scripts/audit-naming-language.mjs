#!/usr/bin/env node

// Audits the language of generated backend domain identifiers.
//
// rules.md#backend-como-produto requires three layers:
//   1. product-domain identifiers  -> pt-BR, ASCII without accents, snake_case
//   2. technical/protocol vocabulary -> English (page, limit, cursor, tenant,
//      DATABASE_URL, HTTP semantics, error.rs/state.rs/config.rs, AppError::*)
//   3. control-plane governance enums and IDs -> unchanged
//
// This auditor only enforces layer 1, and only against an explicit, short
// denylist of unambiguous English domain nouns plus the two timestamp spellings.
// A narrow list is deliberate: a broad heuristic would flag layer-2 vocabulary
// and train people to ignore the check.

import fs from "node:fs";
import path from "node:path";

const USAGE = [
  "node audit-naming-language.mjs <backend-change-manifest.json>",
  "  [--root <project-root>]",
  "  [--json]"
].join("\n");

// Unambiguous English domain nouns. Singular and plural are both listed so the
// match stays a whole-word comparison rather than a substring search.
const DOMAIN_NOUNS = new Set([
  "user", "users",
  "order", "orders",
  "customer", "customers",
  "client", "clients",
  "product", "products",
  "invoice", "invoices",
  "payment", "payments",
  "address", "addresses",
  "employee", "employees",
  "supplier", "suppliers",
  "company", "companies",
  "account", "accounts"
]);

// Timestamp and lifecycle field spellings, in both casings.
const DOMAIN_FIELDS = new Set([
  "created_at", "createdat",
  "updated_at", "updatedat",
  "deleted_at", "deletedat",
  "created_by", "createdby",
  "updated_by", "updatedby"
]);

// Layer 2. These stay English by rule, so they must never be reported.
const TECHNICAL_ALLOWLIST = new Set([
  "api", "v1", "v2", "v3", "health", "healthz", "readyz", "metrics", "openapi",
  "page", "limit", "offset", "cursor", "sort", "order_by", "per_page",
  "tenant", "tenant_id", "auth", "token", "scope", "role", "permission",
  "id", "uuid", "etag", "cache", "schema", "components", "paths", "info",
  "get", "post", "put", "patch", "delete", "head", "options",
  "request", "response", "body", "query", "header", "path",
  "error", "errors", "state", "config", "status_code"
]);

const ERROR_CODE_SUFFIXES = [
  "_NOT_FOUND",
  "_ALREADY_EXISTS",
  "_INVALID",
  "_FORBIDDEN"
];

function parseArgs(argv) {
  const options = { positional: [], root: process.cwd(), json: false };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--json") {
      options.json = true;
      continue;
    }

    if (argument === "--root") {
      const value = argv[index + 1];
      if (!value) throw new Error("--root requires a directory path.");
      options.root = path.resolve(value);
      index += 1;
      continue;
    }

    if (argument.startsWith("--root=")) {
      options.root = path.resolve(argument.slice("--root=".length));
      continue;
    }

    if (argument.startsWith("--")) {
      throw new Error(`Unsupported option: ${argument}\n${USAGE}`);
    }

    options.positional.push(argument);
  }

  return options;
}

// Splits an identifier into comparable word tokens without losing the
// underscore-joined spellings the field denylist relies on.
function tokenize(identifier) {
  const normalized = String(identifier ?? "")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase();

  const words = normalized.split(/[^a-z0-9_]+/).filter(Boolean);
  const tokens = new Set();

  for (const word of words) {
    tokens.add(word);
    for (const part of word.split("_").filter(Boolean)) {
      tokens.add(part);
    }
  }

  return tokens;
}

function violationsFor(identifier) {
  const tokens = tokenize(identifier);
  const found = [];

  for (const token of tokens) {
    if (TECHNICAL_ALLOWLIST.has(token)) continue;
    if (DOMAIN_NOUNS.has(token)) found.push({ token, kind: "domain-noun" });
    if (DOMAIN_FIELDS.has(token)) found.push({ token, kind: "domain-field" });
  }

  const upper = String(identifier ?? "").toUpperCase();
  for (const suffix of ERROR_CODE_SUFFIXES) {
    if (!upper.endsWith(suffix)) continue;
    const stem = upper.slice(0, -suffix.length).toLowerCase();
    for (const token of tokenize(stem)) {
      if (TECHNICAL_ALLOWLIST.has(token)) continue;
      if (DOMAIN_NOUNS.has(token)) {
        found.push({ token, kind: "error-code" });
      }
    }
  }

  return found;
}

// Route path segments and object keys are the two shapes that actually reach a
// consumer, so those are what this scans. Templated segments ({id}, :id) are
// skipped because their name belongs to the operation, not the wire contract.
function scanContractFile(absolutePath, relativePath) {
  const issues = [];
  const lines = fs.readFileSync(absolutePath, "utf8").split(/\r?\n/);

  lines.forEach((line, index) => {
    const lineNumber = index + 1;

    for (const match of line.matchAll(/(?:"|')?(\/[A-Za-z0-9_\-/{}:.]+)(?:"|')?\s*:/g)) {
      const route = match[1];
      for (const segment of route.split("/").filter(Boolean)) {
        if (segment.startsWith("{") || segment.startsWith(":")) continue;
        for (const violation of violationsFor(segment)) {
          issues.push({
            severity: "error",
            code: "BACKEND_NAMING_LANGUAGE_ROUTE",
            message:
              `Route segment '${segment}' in '${route}' uses the English ` +
              `domain term '${violation.token}'. Domain identifiers are pt-BR ` +
              `ASCII snake_case (rules.md#backend-como-produto).`,
            location: `${relativePath}:${lineNumber}`
          });
        }
      }
    }

    for (const match of line.matchAll(/(?:"([A-Za-z_][A-Za-z0-9_]*)"|^\s*([a-z_][A-Za-z0-9_]*))\s*:/g)) {
      const key = match[1] ?? match[2];
      if (!key) continue;
      for (const violation of violationsFor(key)) {
        if (violation.kind === "error-code") continue;
        issues.push({
          severity: "error",
          code: "BACKEND_NAMING_LANGUAGE_FIELD",
          message:
            `Contract property '${key}' uses the English domain term ` +
            `'${violation.token}'. Domain identifiers are pt-BR ASCII ` +
            `snake_case (rules.md#backend-como-produto).`,
          location: `${relativePath}:${lineNumber}`
        });
      }
    }
  });

  return issues;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const manifestArgument = options.positional[0];

  if (!manifestArgument) {
    throw new Error(`Provide the backend change manifest path.\n${USAGE}`);
  }

  const manifestPath = path.resolve(manifestArgument);

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Backend change manifest not found: ${manifestPath}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const interfaces = Array.isArray(manifest.interfaces) ? manifest.interfaces : [];
  const issues = [];
  const scanned = [];

  for (const entry of interfaces) {
    for (const violation of violationsFor(entry?.id)) {
      issues.push({
        severity: "error",
        code: "BACKEND_NAMING_LANGUAGE_INTERFACE_ID",
        message:
          `Interface id '${entry.id}' uses the English domain term ` +
          `'${violation.token}'. Domain identifiers are pt-BR ASCII ` +
          `snake_case (rules.md#backend-como-produto).`,
        location: `${path.basename(manifestPath)}#interfaces`
      });
    }

    const contractReference = entry?.contractPath;
    if (typeof contractReference !== "string" || !contractReference.trim()) continue;

    const absolute = path.isAbsolute(contractReference)
      ? contractReference
      : path.resolve(options.root, contractReference);

    // A missing contract file is backend-change-manifest-contract's finding,
    // not this auditor's; do not double-report it.
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) continue;

    // Several interfaces commonly share one contract file; scan it once.
    if (scanned.includes(contractReference)) continue;

    scanned.push(contractReference);
    issues.push(...scanContractFile(absolute, contractReference));
  }

  const summary = {
    errors: issues.filter((issue) => issue.severity === "error").length,
    warnings: issues.filter((issue) => issue.severity === "warning").length,
    information: 0
  };
  summary.total = summary.errors + summary.warnings;

  const report = {
    title: "Backend Naming Language Audit",
    summary,
    issues,
    scannedContracts: scanned
  };

  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write("Backend Naming Language Audit\n");
    process.stdout.write("=============================\n");
    for (const issue of issues) {
      process.stdout.write(`[${issue.severity.toUpperCase()}] ${issue.code} at ${issue.location}: ${issue.message}\n`);
    }
    process.stdout.write(
      `\nScanned contracts: ${scanned.length} | Errors: ${summary.errors} | Warnings: ${summary.warnings}\n`
    );
  }

  process.exitCode = summary.errors > 0 ? 1 : 0;
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
