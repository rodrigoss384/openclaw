#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import {
  spawnSync
} from "node:child_process";
import {
  fileURLToPath
} from "node:url";

const SCRIPT_DIRECTORY = path.dirname(
  fileURLToPath(import.meta.url)
);

const DEFAULT_SKILL_ROOT = path.resolve(
  SCRIPT_DIRECTORY,
  ".."
);

const EXCLUDED_DIRECTORIES = new Set([
  ".git",
  ".adjustment-backups",
  "node_modules"
]);

const REQUIRED_DIRECTORIES = [
  "references",
  "agents",
  "assets",
  "assets/schemas",
  "assets/templates",
  "assets/recipes",
  "assets/catalog",
  "scripts",
  "scripts/lib",
  "evals",
  "evals/files"
];

const REQUIRED_FILES = [
  "SKILL.md",
  "agents/openai.yaml",

  "references/01-product-discovery.md",
  "references/02-design-direction.md",
  "references/03-frontend-architecture.md",
  "references/04-design-system.md",
  "references/05-component-composition.md",
  "references/06-layout-recipes.md",
  "references/07-data-and-forms.md",
  "references/08-screen-planning.md",
  "references/09-screen-contract-validation.md",
  "references/10-small-slice-execution.md",
  "references/11-small-slice-validation.md",
  "references/12-styling-authority.md",

  "assets/schemas/design-system.schema.json",
  "assets/schemas/styling-authority.schema.json",
  "assets/schemas/layout-recipe.schema.json",
  "assets/schemas/component-catalog.schema.json",
  "assets/schemas/screen-specification.schema.json",
  "assets/schemas/small-slice-manifest.schema.json",

  "assets/templates/product-context.template.md",
  "assets/templates/design-direction.template.md",
  "assets/templates/frontend-architecture.template.md",
  "assets/templates/api-integration-contract.template.md",
  "assets/templates/design-system.template.json",
  "assets/templates/styling-authority.template.json",
  "assets/templates/component-contract.template.md",
  "assets/templates/token-contract.template.md",
  "assets/templates/layout-recipe.template.json",
  "assets/templates/component-catalog.template.json",
  "assets/templates/screen-contract.template.md",
  "assets/templates/component-map.template.md",
  "assets/templates/screen-specification.template.json",
  "assets/templates/screen-state-matrix.template.md",
  "assets/templates/screen-component-map.template.md",
  "assets/templates/screen-implementation-plan.template.md",
  "assets/templates/repository-inspection.template.md",
  "assets/templates/fixture-strategy.template.md",
  "assets/templates/small-slice-manifest.template.json",
  "assets/templates/small-slice-implementation-journal.template.md",
  "assets/templates/browser-validation.template.md",
  "assets/templates/screenshot-evidence.template.json",
  "assets/templates/design-system-audit.template.md",
  "assets/templates/defect-log.template.md",

  "assets/recipes/application-shell.recipe.json",
  "assets/recipes/dashboard.recipe.json",
  "assets/recipes/searchable-list.recipe.json",
  "assets/recipes/entity-detail.recipe.json",
  "assets/recipes/form-workflow.recipe.json",
  "assets/recipes/administration.recipe.json",
  "assets/recipes/authentication.recipe.json",
  "assets/recipes/review-approval.recipe.json",

  "assets/catalog/foundational-components.json",
  "assets/catalog/layout-components.json",
  "assets/catalog/feedback-components.json",
  "assets/catalog/data-display-collection-components.json",
  "assets/catalog/data-display-analytical-components.json",
  "assets/catalog/form-field-foundation-components.json",
  "assets/catalog/form-field-control-components.json",
  "assets/catalog/form-workflow-components.json",

  "scripts/lib/screen-contract-utils.mjs",
  "scripts/validate-screen-specification.mjs",
  "scripts/validate-styling-authority.mjs",
  "scripts/audit-styling-authority.mjs",
  "scripts/audit-screen-spec-references.mjs",
  "scripts/audit-screen-component-coverage.mjs",
  "scripts/audit-screen-action-state-coverage.mjs",
  "scripts/audit-screen-data-ownership.mjs",
  "scripts/audit-representative-gate.mjs",
  "scripts/report-screen-readiness.mjs",
  "scripts/validate-small-slice-manifest.mjs",
  "scripts/audit-small-slice-files.mjs",
  "scripts/audit-small-slice-scope.mjs",
  "scripts/audit-small-slice-evidence.mjs",
  "scripts/prepare-representative-gate.mjs",
  "scripts/validate-visual-composition-contract.mjs",
  "scripts/audit-visual-composition-evidence.mjs",
  "scripts/validate-visual-quality-scorecard.mjs",
  "scripts/audit-theme-operational-evidence.mjs",
  "scripts/validate-skill-structure.mjs",
  "scripts/test-styling-authority-cli.mjs"
];

const INTENTIONAL_DETECTORS = {
  "scripts/validate-small-slice-manifest.mjs": {
    staging: 1,
    workspace: 1
  },
  "scripts/audit-small-slice-scope.mjs": {
    staging: 1,
    workspace: 1
  }
};

const STAGING_REFERENCE =
  "skills-src/frontend-product-builder";

const WORKSPACE_REFERENCE =
  "node .agents/skills/frontend-product-builder";

const EXPECTED_SMALL_SLICE_SCHEMA =
  "../schemas/small-slice-manifest.schema.json";

const TEMPORARY_FILE_PATTERN =
  /(?:\.bak|\.orig|\.rej|\.tmp)$/i;

const INCORRECT_COPY_PATTERN =
  /(?:incorrect-content|schema-copy|path-fix)/i;

function parseArguments(argv) {
  const options = {
    root: DEFAULT_SKILL_ROOT,
    json: false,
    strictWarnings: false
  };

  for (
    let index = 0;
    index < argv.length;
    index += 1
  ) {
    const argument = argv[index];

    switch (argument) {
      case "--root": {
        const value = argv[index + 1];

        if (!value) {
          throw new Error(
            "--root requires a directory path."
          );
        }

        options.root = path.resolve(value);
        index += 1;
        break;
      }

      case "--json":
        options.json = true;
        break;

      case "--strict-warnings":
        options.strictWarnings = true;
        break;

      default:
        throw new Error(
          `Unknown option '${argument}'.`
        );
    }
  }

  return options;
}

function createCollector() {
  const issues = [];

  return {
    issues,

    error(code, message, location, detail = null) {
      issues.push({
        severity: "error",
        code,
        message,
        location,
        detail
      });
    },

    warning(code, message, location, detail = null) {
      issues.push({
        severity: "warning",
        code,
        message,
        location,
        detail
      });
    },

    info(code, message, location, detail = null) {
      issues.push({
        severity: "information",
        code,
        message,
        location,
        detail
      });
    }
  };
}

async function pathType(targetPath) {
  try {
    const stats = await fs.stat(targetPath);

    if (stats.isDirectory()) {
      return "directory";
    }

    if (stats.isFile()) {
      return "file";
    }

    return "other";
  } catch {
    return "missing";
  }
}

async function walkFiles(rootDirectory) {
  const files = [];

  async function visit(directory) {
    const entries = await fs.readdir(
      directory,
      {
        withFileTypes: true
      }
    );

    for (const entry of entries) {
      if (
        entry.isDirectory() &&
        EXCLUDED_DIRECTORIES.has(entry.name)
      ) {
        continue;
      }

      const absolutePath = path.join(
        directory,
        entry.name
      );

      if (entry.isDirectory()) {
        await visit(absolutePath);
        continue;
      }

      if (entry.isFile()) {
        files.push(absolutePath);
      }
    }
  }

  await visit(rootDirectory);

  return files.sort();
}

function relativePath(root, filePath) {
  return path
    .relative(root, filePath)
    .replaceAll("\\", "/");
}

function countOccurrences(content, searchValue) {
  if (!searchValue) {
    return 0;
  }

  let count = 0;
  let offset = 0;

  while (true) {
    const index = content.indexOf(
      searchValue,
      offset
    );

    if (index === -1) {
      break;
    }

    count += 1;
    offset = index + searchValue.length;
  }

  return count;
}

async function checkRoot(
  skillRoot,
  collector
) {
  const rootType = await pathType(skillRoot);

  if (rootType !== "directory") {
    collector.error(
      "SKILL_ROOT_INVALID",
      "The skill root does not exist or is not a directory.",
      skillRoot
    );

    return false;
  }

  collector.info(
    "SKILL_ROOT_VALID",
    "The skill root exists.",
    skillRoot
  );

  return true;
}

async function checkRequiredDirectories(
  skillRoot,
  collector
) {
  for (
    const relativeDirectory of
    REQUIRED_DIRECTORIES
  ) {
    const absolutePath = path.join(
      skillRoot,
      relativeDirectory
    );

    const type = await pathType(absolutePath);

    if (type !== "directory") {
      collector.error(
        "SKILL_DIRECTORY_MISSING",
        `Required directory '${relativeDirectory}' is missing.`,
        absolutePath
      );
    }
  }
}

async function checkRequiredFiles(
  skillRoot,
  collector
) {
  for (
    const relativeFile of
    REQUIRED_FILES
  ) {
    const absolutePath = path.join(
      skillRoot,
      relativeFile
    );

    const type = await pathType(absolutePath);

    if (type !== "file") {
      collector.error(
        "SKILL_FILE_MISSING",
        `Required file '${relativeFile}' is missing.`,
        absolutePath
      );

      continue;
    }

    const stats = await fs.stat(absolutePath);

    if (stats.size === 0) {
      collector.error(
        "SKILL_FILE_EMPTY",
        `Required file '${relativeFile}' is empty.`,
        absolutePath
      );
    }
  }
}

async function checkAllFilesNonEmpty({
  skillRoot,
  files,
  collector
}) {
  for (const filePath of files) {
    const stats = await fs.stat(filePath);

    if (stats.size !== 0) {
      continue;
    }

    collector.warning(
      "SKILL_EMPTY_FILE",
      "A non-required file is empty.",
      relativePath(skillRoot, filePath)
    );
  }
}

async function checkJsonSyntax({
  skillRoot,
  jsonFiles,
  collector
}) {
  const parsedJson = new Map();

  for (const filePath of jsonFiles) {
    const relative = relativePath(
      skillRoot,
      filePath
    );

    try {
      const content = await fs.readFile(
        filePath,
        "utf8"
      );

      const value = JSON.parse(content);

      parsedJson.set(relative, value);

      collector.info(
        "SKILL_JSON_VALID",
        "JSON syntax is valid.",
        relative
      );
    } catch (error) {
      collector.error(
        "SKILL_JSON_INVALID",
        `Invalid JSON: ${error.message}`,
        relative
      );
    }
  }

  return parsedJson;
}

function runNodeCheck(filePath) {
  return spawnSync(
    process.execPath,
    [
      "--check",
      filePath
    ],
    {
      encoding: "utf8",
      windowsHide: true
    }
  );
}

function checkJavaScriptSyntax({
  skillRoot,
  moduleFiles,
  collector
}) {
  for (const filePath of moduleFiles) {
    const relative = relativePath(
      skillRoot,
      filePath
    );

    const result = runNodeCheck(filePath);

    if (result.error) {
      collector.error(
        "SKILL_MJS_CHECK_EXECUTION",
        result.error.message,
        relative
      );

      continue;
    }

    if (result.status !== 0) {
      collector.error(
        "SKILL_MJS_INVALID",
        "JavaScript syntax validation failed.",
        relative,
        {
          stdout: result.stdout?.trim(),
          stderr: result.stderr?.trim(),
          exitCode: result.status
        }
      );

      continue;
    }

    collector.info(
      "SKILL_MJS_VALID",
      "JavaScript syntax is valid.",
      relative
    );
  }
}

function collectRelativeImports(content) {
  const imports = new Set();

  const patterns = [
    /(?:import|export)\s+(?:[^"'()]*?\s+from\s+)?["'](\.[^"']+)["']/g,
    /import\(\s*["'](\.[^"']+)["']\s*\)/g
  ];

  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      imports.add(match[1]);
    }
  }

  return [
    ...imports
  ];
}

async function resolveLocalImport(
  importerPath,
  specifier
) {
  const cleanSpecifier = specifier
    .split("?")[0]
    .split("#")[0];

  const basePath = path.resolve(
    path.dirname(importerPath),
    cleanSpecifier
  );

  const candidates = [
    basePath,
    `${basePath}.mjs`,
    `${basePath}.js`,
    path.join(basePath, "index.mjs"),
    path.join(basePath, "index.js")
  ];

  for (const candidate of candidates) {
    if (
      await pathType(candidate) === "file"
    ) {
      return candidate;
    }
  }

  return null;
}

async function checkLocalImports({
  skillRoot,
  moduleFiles,
  collector
}) {
  for (const filePath of moduleFiles) {
    const relative = relativePath(
      skillRoot,
      filePath
    );

    const content = await fs.readFile(
      filePath,
      "utf8"
    );

    const imports =
      collectRelativeImports(content);

    for (const specifier of imports) {
      const resolved =
        await resolveLocalImport(
          filePath,
          specifier
        );

      if (!resolved) {
        collector.error(
          "SKILL_LOCAL_IMPORT_MISSING",
          `Local import '${specifier}' cannot be resolved.`,
          relative
        );

        continue;
      }

      collector.info(
        "SKILL_LOCAL_IMPORT_VALID",
        `Local import '${specifier}' resolves correctly.`,
        relativePath(skillRoot, resolved)
      );
    }
  }
}

// SKILL.md used to list six of the nine runners that run-integration-suite.mjs
// actually executes, while claiming the consolidated runner "executes all"
// integration tests. A reader trusting that list skipped three suites without
// knowing it. The list is a claim about code, so derive the check from code.
async function checkIntegrationSuiteIsDocumented({
  skillRoot,
  collector
}) {
  const suitePath = path.join(skillRoot, "scripts", "run-integration-suite.mjs");
  const skillPath = path.join(skillRoot, "SKILL.md");
  let suiteSource;
  let skillSource;
  try {
    suiteSource = await fs.readFile(suitePath, "utf8");
    skillSource = await fs.readFile(skillPath, "utf8");
  } catch (error) {
    collector.error(
      "INTEGRATION_SUITE_UNREADABLE",
      `Cannot compare the documented integration suite with its implementation: ${error.message}`,
      "scripts/run-integration-suite.mjs"
    );
    return;
  }

  const executed = new Set(suiteSource.match(/test-[a-z0-9-]+\.mjs/g) || []);
  const documented = new Set(
    (skillSource.match(/- `scripts\/(test-[a-z0-9-]+\.mjs)`/g) || [])
      .map((entry) => entry.replace(/^- `scripts\//, "").replace(/`$/, ""))
  );

  for (const runner of executed) {
    if (documented.has(runner)) continue;
    collector.error(
      "INTEGRATION_SUITE_UNDOCUMENTED_RUNNER",
      `run-integration-suite.mjs executes '${runner}' but SKILL.md does not list it, so the documented suite understates what runs.`,
      "SKILL.md"
    );
  }

  for (const runner of documented) {
    if (executed.has(runner)) continue;
    collector.error(
      "INTEGRATION_SUITE_PHANTOM_RUNNER",
      `SKILL.md lists '${runner}' as part of the integration suite but run-integration-suite.mjs never executes it.`,
      "SKILL.md"
    );
  }
}

async function checkLegacyReferences({
  skillRoot,
  files,
  collector
}) {
  const textFiles = files.filter((filePath) => {
    return [
      ".md",
      ".json",
      ".mjs"
    ].includes(
      path.extname(filePath).toLowerCase()
    );
  });

  for (const filePath of textFiles) {
    const relative = relativePath(
      skillRoot,
      filePath
    );

    if (
      relative ===
      "scripts/validate-skill-structure.mjs"
    ) {
      continue;
    }

    const content = await fs.readFile(
      filePath,
      "utf8"
    );

    const absoluteUserPaths =
      content.match(
        /\/home\/[^/"'\s]+\/\.agents\/skills\/frontend-product-builder/g
      ) ?? [];

    if (absoluteUserPaths.length > 0) {
      collector.error(
        "SKILL_USER_HOME_HARDCODED",
        "A user-specific absolute installation path is persisted.",
        relative,
        [
          ...new Set(absoluteUserPaths)
        ]
      );
    }

    const stagingCount = countOccurrences(
      content,
      STAGING_REFERENCE
    );

    const workspaceCount = countOccurrences(
      content,
      WORKSPACE_REFERENCE
    );

    if (relative === "SKILL.md") {
      if (stagingCount > 0) {
        collector.info(
          "SKILL_SOURCE_PATH_DOCUMENTED",
          "SKILL.md documents the source construction path.",
          relative,
          {
            occurrences: stagingCount
          }
        );
      }

      if (workspaceCount > 0) {
        collector.error(
          "SKILL_WORKSPACE_COMMAND_PERSISTED",
          "SKILL.md contains a workspace-relative installed-skill command.",
          relative,
          {
            occurrences: workspaceCount
          }
        );
      }

      continue;
    }

    const expected =
      INTENTIONAL_DETECTORS[relative];

    if (expected) {
      if (
        stagingCount !== expected.staging
      ) {
        collector.error(
          "SKILL_STAGING_DETECTOR_COUNT",
          "The intentional staging-path detector count is unexpected.",
          relative,
          {
            expected: expected.staging,
            actual: stagingCount
          }
        );
      } else {
        collector.info(
          "SKILL_STAGING_DETECTOR_VALID",
          "The intentional staging-path detector is present.",
          relative
        );
      }

      if (
        workspaceCount !== expected.workspace
      ) {
        collector.error(
          "SKILL_WORKSPACE_DETECTOR_COUNT",
          "The intentional workspace-path detector count is unexpected.",
          relative,
          {
            expected: expected.workspace,
            actual: workspaceCount
          }
        );
      } else {
        collector.info(
          "SKILL_WORKSPACE_DETECTOR_VALID",
          "The intentional workspace-path detector is present.",
          relative
        );
      }

      continue;
    }

    if (stagingCount > 0) {
      collector.error(
        "SKILL_STAGING_REFERENCE_PERSISTED",
        "A staging source path is persisted outside an intentional detector.",
        relative,
        {
          occurrences: stagingCount
        }
      );
    }

    if (workspaceCount > 0) {
      collector.error(
        "SKILL_WORKSPACE_REFERENCE_PERSISTED",
        "A workspace-relative installed-skill command is persisted.",
        relative,
        {
          occurrences: workspaceCount
        }
      );
    }
  }
}

async function checkBackupArtifacts({
  skillRoot,
  files,
  collector
}) {
  const adjustmentBackups = path.join(
    skillRoot,
    ".adjustment-backups"
  );

  if (
    await pathType(adjustmentBackups) ===
    "directory"
  ) {
    collector.warning(
      "SKILL_BACKUP_DIRECTORY_PRESENT",
      "The construction backup directory is still present.",
      ".adjustment-backups",
      "Keep it until validation finishes, then remove it before final release."
    );
  }

  for (const filePath of files) {
    const relative = relativePath(
      skillRoot,
      filePath
    );

    const basename = path.basename(filePath);

    if (
      TEMPORARY_FILE_PATTERN.test(basename) ||
      INCORRECT_COPY_PATTERN.test(basename)
    ) {
      collector.warning(
        "SKILL_TEMPORARY_ARTIFACT_PRESENT",
        "A backup, repair, or temporary artifact exists outside the excluded backup directory.",
        relative
      );
    }
  }
}

const TEMPLATE_PLACEHOLDER_PATTERN = /<[A-Z][A-Z0-9_]*(\s*\|[^>]*)?>/;
const TEMPLATE_FRONTMATTER_PATTERN = /^---\s*\nartifact:/;

async function checkReferenceDocsAreNotTemplateCopies({
  skillRoot,
  markdownFiles,
  collector
}) {
  for (const filePath of markdownFiles) {
    const relative = relativePath(
      skillRoot,
      filePath
    );

    if (!relative.startsWith("references/")) {
      continue;
    }

    const content = await fs.readFile(
      filePath,
      "utf8"
    );

    if (TEMPLATE_FRONTMATTER_PATTERN.test(content)) {
      collector.error(
        "SKILL_REFERENCE_IS_TEMPLATE_FRONTMATTER",
        `'${relative}' opens with template YAML frontmatter ('artifact: ...'). A reference doc under references/ must contain guidance prose, never a project fill-in template's frontmatter — that belongs only under assets/templates/. This is the exact defect class that put frontend-architecture template content inside 07-data-and-forms.md.`,
        filePath
      );

      continue;
    }

    if (TEMPLATE_PLACEHOLDER_PATTERN.test(content)) {
      collector.error(
        "SKILL_REFERENCE_CONTAINS_TEMPLATE_PLACEHOLDER",
        `'${relative}' contains an unresolved template placeholder (e.g. '<PROJECT_NAME>'). A reference doc is read as-is by the agent; placeholder fill-in syntax belongs only to assets/templates/*.md.`,
        filePath
      );
    }
  }
}

function checkSmallSliceSeparation({
  parsedJson,
  collector
}) {
  const schemaPath =
    "assets/schemas/small-slice-manifest.schema.json";

  const templatePath =
    "assets/templates/small-slice-manifest.template.json";

  const schema = parsedJson.get(schemaPath);
  const template = parsedJson.get(templatePath);

  if (!schema || !template) {
    return;
  }

  if (
    JSON.stringify(schema) ===
    JSON.stringify(template)
  ) {
    collector.error(
      "SKILL_SMALL_SLICE_TEMPLATE_EQUALS_SCHEMA",
      "The small-slice template is identical to its schema.",
      templatePath
    );
  }

  if (
    template.$schema ===
    "https://json-schema.org/draft/2020-12/schema"
  ) {
    collector.error(
      "SKILL_SMALL_SLICE_TEMPLATE_META_SCHEMA",
      "The small-slice template points to the JSON Schema meta-schema.",
      templatePath
    );
  }

  if (
    template.$schema !==
    EXPECTED_SMALL_SLICE_SCHEMA
  ) {
    collector.error(
      "SKILL_SMALL_SLICE_SCHEMA_REFERENCE",
      "The small-slice template has an unexpected $schema reference.",
      templatePath,
      {
        expected:
          EXPECTED_SMALL_SLICE_SCHEMA,
        actual:
          template.$schema
      }
    );
  }
}

function summarize(issues) {
  const summary = {
    errors: 0,
    warnings: 0,
    information: 0,
    total: issues.length
  };

  for (const issue of issues) {
    switch (issue.severity) {
      case "error":
        summary.errors += 1;
        break;

      case "warning":
        summary.warnings += 1;
        break;

      default:
        summary.information += 1;
        break;
    }
  }

  return summary;
}

function printTextReport(report) {
  process.stdout.write(
    "Frontend Product Builder — Structural Validation\n"
  );

  process.stdout.write(
    "===============================================\n"
  );

  process.stdout.write(
    `Skill root: ${report.meta.skillRoot}\n`
  );

  process.stdout.write(
    `Files inspected: ${report.metrics.files}\n`
  );

  process.stdout.write(
    `JSON files: ${report.metrics.jsonFiles}\n`
  );

  process.stdout.write(
    `MJS files: ${report.metrics.moduleFiles}\n`
  );

  process.stdout.write(
    `Markdown files: ${report.metrics.markdownFiles}\n\n`
  );

  const visibleIssues = report.issues.filter(
    (issue) => {
      return issue.severity !== "information";
    }
  );

  if (visibleIssues.length === 0) {
    process.stdout.write(
      "No errors or warnings were found.\n\n"
    );
  } else {
    for (const issue of visibleIssues) {
      process.stdout.write(
        `[${issue.severity.toUpperCase()}] ` +
        `${issue.code}\n`
      );

      process.stdout.write(
        `Location: ${issue.location}\n`
      );

      process.stdout.write(
        `${issue.message}\n`
      );

      if (issue.detail !== null) {
        process.stdout.write(
          `${JSON.stringify(issue.detail, null, 2)}\n`
        );
      }

      process.stdout.write("\n");
    }
  }

  process.stdout.write(
    "Summary\n"
  );

  process.stdout.write(
    "-------\n"
  );

  process.stdout.write(
    `Errors: ${report.summary.errors}\n`
  );

  process.stdout.write(
    `Warnings: ${report.summary.warnings}\n`
  );

  process.stdout.write(
    `Information: ${report.summary.information}\n`
  );

  process.stdout.write(
    `Total: ${report.summary.total}\n`
  );
}

async function main() {
  let options;

  try {
    options = parseArguments(
      process.argv.slice(2)
    );
  } catch (error) {
    process.stderr.write(
      `${error.message}\n`
    );

    process.exitCode = 1;
    return;
  }

  const collector = createCollector();
  const skillRoot = options.root;

  const rootValid = await checkRoot(
    skillRoot,
    collector
  );

  if (!rootValid) {
    const summary = summarize(
      collector.issues
    );

    const report = {
      meta: {
        skillRoot,
        generatedAt:
          new Date().toISOString(),
        strictWarnings:
          options.strictWarnings
      },
      metrics: {
        files: 0,
        jsonFiles: 0,
        moduleFiles: 0,
        markdownFiles: 0
      },
      summary,
      issues: collector.issues
    };

    if (options.json) {
      process.stdout.write(
        `${JSON.stringify(report, null, 2)}\n`
      );
    } else {
      printTextReport(report);
    }

    process.exitCode = 1;
    return;
  }

  await checkRequiredDirectories(
    skillRoot,
    collector
  );

  await checkRequiredFiles(
    skillRoot,
    collector
  );

  const files = await walkFiles(
    skillRoot
  );

  const jsonFiles = files.filter(
    (filePath) => {
      return path.extname(filePath) ===
        ".json";
    }
  );

  const moduleFiles = files.filter(
    (filePath) => {
      return path.extname(filePath) ===
        ".mjs";
    }
  );

  const markdownFiles = files.filter(
    (filePath) => {
      return path.extname(filePath) ===
        ".md";
    }
  );

  await checkAllFilesNonEmpty({
    skillRoot,
    files,
    collector
  });

  const parsedJson = await checkJsonSyntax({
    skillRoot,
    jsonFiles,
    collector
  });

  checkJavaScriptSyntax({
    skillRoot,
    moduleFiles,
    collector
  });

  await checkLocalImports({
    skillRoot,
    moduleFiles,
    collector
  });

  await checkLegacyReferences({
    skillRoot,
    files,
    collector
  });

  await checkBackupArtifacts({
    skillRoot,
    files,
    collector
  });

  checkSmallSliceSeparation({
    parsedJson,
    collector
  });

  await checkReferenceDocsAreNotTemplateCopies({
    skillRoot,
    markdownFiles,
    collector
  });

  await checkIntegrationSuiteIsDocumented({
    skillRoot,
    collector
  });

  const summary = summarize(
    collector.issues
  );

  const report = {
    meta: {
      skillRoot,
      generatedAt:
        new Date().toISOString(),
      strictWarnings:
        options.strictWarnings
    },
    metrics: {
      files: files.length,
      jsonFiles: jsonFiles.length,
      moduleFiles: moduleFiles.length,
      markdownFiles: markdownFiles.length
    },
    summary,
    issues: collector.issues
  };

  if (options.json) {
    process.stdout.write(
      `${JSON.stringify(report, null, 2)}\n`
    );
  } else {
    printTextReport(report);
  }

  process.exitCode = (
    summary.errors > 0 ||
    (
      options.strictWarnings &&
      summary.warnings > 0
    )
  )
    ? 1
    : 0;
}

main().catch((error) => {
  process.stderr.write(
    `${error.stack ?? error.message}\n`
  );

  process.exitCode = 1;
});
