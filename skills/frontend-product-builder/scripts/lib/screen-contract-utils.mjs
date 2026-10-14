import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PLACEHOLDER_PATTERN = /<[^<>]+>/;
const PORTABLE_SKILL_ROOT = "~/.agents/skills/frontend-product-builder";
const CURRENT_SKILL_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);

export function parseCliArgs(argv) {
  const options = {
    positional: [],
    json: false,
    structuralOnly: false,
    strictWarnings: false,
    schema: null,
    knownRoutes: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--json") {
      options.json = true;
      continue;
    }

    if (argument === "--structural-only") {
      options.structuralOnly = true;
      continue;
    }

    if (argument === "--strict-warnings") {
      options.strictWarnings = true;
      continue;
    }

    if (argument === "--schema") {
      const value = argv[index + 1];

      if (!value) {
        throw new Error("--schema requires a file path.");
      }

      options.schema = value;
      index += 1;
      continue;
    }

    if (argument.startsWith("--schema=")) {
      options.schema = argument.slice("--schema=".length);
      continue;
    }

    if (argument === "--known-routes") {
      const value = argv[index + 1];

      if (!value) {
        throw new Error("--known-routes requires a file path.");
      }

      options.knownRoutes = value;
      index += 1;
      continue;
    }

    if (argument.startsWith("--known-routes=")) {
      options.knownRoutes = argument.slice("--known-routes=".length);
      continue;
    }

    if (argument.startsWith("--")) {
      throw new Error(`Unsupported option: ${argument}`);
    }

    options.positional.push(argument);
  }

  return options;
}

export class IssueCollector {
  constructor() {
    this.issues = [];
  }

  add(severity, code, message, location = null, detail = null) {
    this.issues.push({
      severity,
      code,
      message,
      location,
      detail
    });
  }

  error(code, message, location = null, detail = null) {
    this.add("error", code, message, location, detail);
  }

  warning(code, message, location = null, detail = null) {
    this.add("warning", code, message, location, detail);
  }

  info(code, message, location = null, detail = null) {
    this.add("info", code, message, location, detail);
  }

  count(severity) {
    return this.issues.filter((issue) => issue.severity === severity).length;
  }

  hasErrors() {
    return this.count("error") > 0;
  }

  shouldFail(strictWarnings = false) {
    return this.hasErrors() || (
      strictWarnings && this.count("warning") > 0
    );
  }

  summary() {
    return {
      errors: this.count("error"),
      warnings: this.count("warning"),
      information: this.count("info"),
      total: this.issues.length
    };
  }

  print(title, { json = false } = {}) {
    const result = {
      title,
      summary: this.summary(),
      issues: this.issues
    };

    if (json) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }

    process.stdout.write(`${title}\n`);
    process.stdout.write(`${"=".repeat(title.length)}\n`);

    if (this.issues.length === 0) {
      process.stdout.write("No issues found.\n");
    }

    for (const issue of this.issues) {
      const location = issue.location
        ? ` at ${issue.location}`
        : "";

      process.stdout.write(
        `[${issue.severity.toUpperCase()}] ${issue.code}${location}: ` +
        `${issue.message}\n`
      );

      if (issue.detail) {
        const detail = typeof issue.detail === "string"
          ? issue.detail
          : JSON.stringify(issue.detail);

        process.stdout.write(`  ${detail}\n`);
      }
    }

    const summary = this.summary();

    process.stdout.write("\n");
    process.stdout.write(
      `Errors: ${summary.errors} | ` +
      `Warnings: ${summary.warnings} | ` +
      `Information: ${summary.information}\n`
    );
  }
}

export function expandHomePath(filePath) {
  if (filePath === "~") {
    return os.homedir();
  }

  if (filePath.startsWith("~/")) {
    return path.join(
      os.homedir(),
      filePath.slice(2)
    );
  }

  return filePath;
}

export function resolveFromCwd(filePath) {
  if (
    filePath === PORTABLE_SKILL_ROOT ||
    filePath.startsWith(`${PORTABLE_SKILL_ROOT}/`)
  ) {
    const relative = filePath
      .slice(PORTABLE_SKILL_ROOT.length)
      .replace(/^\/+/, "");

    return relative
      ? path.resolve(CURRENT_SKILL_ROOT, relative)
      : CURRENT_SKILL_ROOT;
  }

  const expandedPath = expandHomePath(filePath);

  return path.isAbsolute(expandedPath)
    ? path.normalize(expandedPath)
    : path.resolve(process.cwd(), expandedPath);
}

export async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readJsonFile(filePath) {
  const resolvedPath = resolveFromCwd(filePath);
  let content;

  try {
    content = await fs.readFile(resolvedPath, "utf8");
  } catch (error) {
    throw new Error(
      `Unable to read JSON file '${resolvedPath}': ${error.message}`
    );
  }

  try {
    return {
      path: resolvedPath,
      value: JSON.parse(content)
    };
  } catch (error) {
    throw new Error(
      `Invalid JSON syntax in '${resolvedPath}': ${error.message}`
    );
  }
}

export function isObject(value) {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value);
}

export function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function getByPath(value, propertyPath) {
  return propertyPath
    .split(".")
    .reduce((current, segment) => {
      if (!isObject(current) && !Array.isArray(current)) {
        return undefined;
      }

      return current[segment];
    }, value);
}

export function findDuplicateValues(items, selector) {
  const occurrences = new Map();

  for (const item of asArray(items)) {
    const selected = selector(item);

    if (
      selected === null ||
      selected === undefined ||
      selected === ""
    ) {
      continue;
    }

    const current = occurrences.get(selected) ?? [];
    current.push(item);
    occurrences.set(selected, current);
  }

  return [...occurrences.entries()]
    .filter(([, values]) => values.length > 1)
    .map(([value, values]) => ({
      value,
      occurrences: values.length,
      items: values
    }));
}

export function findPlaceholders(value, currentPath = "$") {
  const matches = [];

  if (typeof value === "string") {
    if (PLACEHOLDER_PATTERN.test(value)) {
      matches.push({
        path: currentPath,
        value
      });
    }

    return matches;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      matches.push(
        ...findPlaceholders(item, `${currentPath}[${index}]`)
      );
    });

    return matches;
  }

  if (isObject(value)) {
    for (const [key, item] of Object.entries(value)) {
      matches.push(
        ...findPlaceholders(item, `${currentPath}.${key}`)
      );
    }
  }

  return matches;
}

export function getScreenRegionIds(specification) {
  return asArray(specification?.recipe?.regions)
    .map((region) => region?.screenRegionId)
    .filter(Boolean);
}

export function getComponentUsageIds(specification) {
  return asArray(specification?.componentMap)
    .map((usage) => usage?.id)
    .filter(Boolean);
}

export function getActionIds(specification) {
  return asArray(specification?.actions)
    .map((action) => action?.id)
    .filter(Boolean);
}

export function getStateIds(specification) {
  return asArray(specification?.states)
    .map((state) => state?.id)
    .filter(Boolean);
}

export function getDataDependencyIds(specification) {
  return asArray(specification?.dataDependencies)
    .map((dependency) => dependency?.id)
    .filter(Boolean);
}

export function findCatalogComponent(catalog, componentName) {
  if (!isObject(catalog?.components)) {
    return null;
  }

  if (catalog.components[componentName]) {
    return catalog.components[componentName];
  }

  return Object.values(catalog.components).find((component) => {
    return component?.name === componentName ||
      component?.id === componentName;
  }) ?? null;
}

export async function resolveSchemaPath({
  specification,
  specificationPath,
  explicitSchemaPath
}) {
  const candidates = [];

  if (explicitSchemaPath) {
    candidates.push(resolveFromCwd(explicitSchemaPath));
  }

  if (specification?.validation?.schema) {
    candidates.push(
      resolveFromCwd(specification.validation.schema)
    );
  }

  if (
    typeof specification?.$schema === "string" &&
    !specification.$schema.startsWith("http://") &&
    !specification.$schema.startsWith("https://")
  ) {
    const schemaReference = expandHomePath(
      specification.$schema
    );

    candidates.push(
      path.isAbsolute(schemaReference)
        ? path.normalize(schemaReference)
        : path.resolve(
          path.dirname(specificationPath),
          schemaReference
        )
    );
  }

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  return candidates[0] ?? null;
}

export function setExitCode(
  collector,
  { strictWarnings = false } = {}
) {
  process.exitCode = collector.shouldFail(strictWarnings)
    ? 1
    : 0;
}

export function requireInputPath(options, usage) {
  const inputPath = options.positional[0];

  if (!inputPath) {
    throw new Error(`Missing input file.\nUsage: ${usage}`);
  }

  return inputPath;
}

export function addDuplicateIssues({
  collector,
  items,
  selector,
  code,
  label,
  location
}) {
  const duplicates = findDuplicateValues(items, selector);

  for (const duplicate of duplicates) {
    collector.error(
      code,
      `${label} '${duplicate.value}' appears ` +
      `${duplicate.occurrences} times.`,
      location
    );
  }
}

export function normalizeComparablePath(filePath) {
  return path.normalize(resolveFromCwd(filePath));
}

export function isRemoteReference(reference) {
  return typeof reference === "string" &&
    (
      reference.startsWith("http://") ||
      reference.startsWith("https://")
    );
}

export async function checkReferencedFile({
  collector,
  reference,
  code,
  label,
  location,
  severity = "error"
}) {
  if (!reference || isRemoteReference(reference)) {
    return;
  }

  const resolvedPath = resolveFromCwd(reference);

  if (await pathExists(resolvedPath)) {
    collector.info(
      `${code}_FOUND`,
      `${label} exists.`,
      location,
      resolvedPath
    );

    return;
  }

  collector[severity](
    code,
    `${label} does not exist.`,
    location,
    resolvedPath
  );
}
