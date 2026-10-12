#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

import {
  IssueCollector,
  asArray,
  parseCliArgs,
  pathExists,
  readJsonFile,
  requireInputPath,
  resolveFromCwd,
  setExitCode
} from "./lib/screen-contract-utils.mjs";

const USAGE = [
  "node audit-small-slice-evidence.mjs",
  "<small-slice-manifest.json>",
  "[--strict-warnings]",
  "[--json]"
].join(" ");

const REQUIRED_EXECUTION_EVIDENCE_TYPES = [
  "implementation-journal",
  "browser-validation",
  "screenshot-registry",
  "design-system-audit",
  "defect-log"
];

const COMPLETED_EVIDENCE_STATUSES = new Set([
  "available",
  "passed"
]);

const CAPTURE_COMPLETED_STATUSES = new Set([
  "captured",
  "approved"
]);

const COMPLETED_CHECK_STATUSES = new Set([
  "passed",
  "not-applicable"
]);

const PLACEHOLDER_PATTERN = /<[^<>\n]+>/g;

function isRemoteReference(value) {
  return typeof value === "string" &&
    (
      value.startsWith("http://") ||
      value.startsWith("https://")
    );
}

function resolveProjectPath(
  repositoryRoot,
  reference
) {
  if (
    typeof reference !== "string" ||
    reference.trim() === ""
  ) {
    return null;
  }

  if (
    reference === "~" ||
    reference.startsWith("~/") ||
    path.isAbsolute(reference)
  ) {
    return resolveFromCwd(reference);
  }

  return path.resolve(
    repositoryRoot,
    reference
  );
}

async function readTextFile(filePath) {
  return await fs.readFile(
    filePath,
    "utf8"
  );
}

async function nonEmptyFile(filePath) {
  try {
    const stats = await fs.stat(filePath);

    return stats.isFile() &&
      stats.size > 0;
  } catch {
    return false;
  }
}

function findPlaceholders(content) {
  return content.match(
    PLACEHOLDER_PATTERN
  ) ?? [];
}

async function inspectMarkdownEvidence({
  evidence,
  filePath,
  manifestStatus,
  collector
}) {
  const content = await readTextFile(filePath);

  const placeholders =
    findPlaceholders(content);

  if (placeholders.length > 0) {
    const severity =
      manifestStatus === "validated"
        ? "error"
        : "warning";

    collector[severity](
      "SLICE_EVIDENCE_PLACEHOLDER",
      `Evidence '${evidence.id}' contains unresolved placeholders.`,
      filePath,
      [
        ...new Set(placeholders)
      ].slice(0, 20)
    );
  }

  // Each evidence entry already carries a schema-validated, enum-constrained
  // `status` field (small-slice-manifest.schema.json). That field, not a magic
  // "**Gate status:** `validated`" string in the narrative body, is the source
  // of truth: the body is read only for placeholder scanning above. Typing the
  // marker string into an otherwise-empty file used to satisfy this check.
  switch (evidence.type) {
    case "implementation-journal": {
      if (evidence.status !== "passed") {
        collector.error(
          "SLICE_EVIDENCE_JOURNAL_NOT_VALIDATED",
          "The implementation journal evidence is not recorded as passed (evidence.status).",
          filePath
        );
      }

      break;
    }

    case "browser-validation": {
      if (evidence.status !== "passed") {
        collector.error(
          "SLICE_EVIDENCE_BROWSER_NOT_VALIDATED",
          "Browser validation evidence is not recorded as passed (evidence.status).",
          filePath
        );
      }

      break;
    }

    case "design-system-audit": {
      if (evidence.status !== "passed") {
        collector.error(
          "SLICE_EVIDENCE_DESIGN_AUDIT_NOT_VALIDATED",
          "Design-system audit evidence is not recorded as passed (evidence.status).",
          filePath
        );
      }

      break;
    }

    case "defect-log": {
      if (evidence.status !== "passed") {
        collector.error(
          "SLICE_EVIDENCE_DEFECT_LOG_NOT_VALIDATED",
          "Defect-log evidence is not recorded as passed (evidence.status).",
          filePath
        );
      }

      break;
    }

    default:
      break;
  }

  return content;
}

async function inspectScreenshotRegistry({
  registryEvidence,
  registryPath,
  repositoryRoot,
  manifest,
  browserValidationContent,
  collector
}) {
  let registryFile;

  try {
    registryFile = await readJsonFile(
      registryPath
    );
  } catch (error) {
    collector.error(
      "SLICE_EVIDENCE_SCREENSHOT_JSON",
      error.message,
      registryPath
    );

    return null;
  }

  const registry = registryFile.value;
  const manifestValidated =
    manifest?.meta?.status === "validated";

  const policy = registry?.policy ?? {};

  if (policy.containsProductionData !== false) {
    collector.error(
      "SLICE_EVIDENCE_SCREENSHOT_PRODUCTION_DATA",
      "Screenshot policy must explicitly declare containsProductionData false.",
      `${registryPath}#policy.containsProductionData`
    );
  }

  if (policy.containsSecrets !== false) {
    collector.error(
      "SLICE_EVIDENCE_SCREENSHOT_SECRETS",
      "Screenshot policy must explicitly declare containsSecrets false.",
      `${registryPath}#policy.containsSecrets`
    );
  }

  if (policy.syntheticFixturesOnly !== true) {
    collector.error(
      "SLICE_EVIDENCE_SCREENSHOT_SYNTHETIC",
      "Screenshot policy must require synthetic fixtures.",
      `${registryPath}#policy.syntheticFixturesOnly`
    );
  }

  if (
    policy.redactionRequired === true &&
    asArray(policy.redactionNotes).length === 0
  ) {
    collector.error(
      "SLICE_EVIDENCE_SCREENSHOT_REDACTION",
      "Redaction is required but no redaction notes are recorded.",
      `${registryPath}#policy.redactionNotes`
    );
  }

  const captures =
    asArray(registry?.captures);

  const captureMap = new Map(
    captures.map((capture) => [
      capture?.id,
      capture
    ])
  );

  const requiredCaptureIds =
    asArray(registry?.requiredCaptureIds);

  const requiredIdSet = new Set();

  for (
    const [
      index,
      captureId
    ] of requiredCaptureIds.entries()
  ) {
    if (requiredIdSet.has(captureId)) {
      collector.error(
        "SLICE_EVIDENCE_CAPTURE_ID_DUPLICATE",
        `Required capture ID '${captureId}' is duplicated.`,
        `${registryPath}#requiredCaptureIds[${index}]`
      );
    }

    requiredIdSet.add(captureId);

    if (!captureMap.has(captureId)) {
      collector.error(
        "SLICE_EVIDENCE_CAPTURE_MISSING",
        `Required capture '${captureId}' is not present in captures.`,
        `${registryPath}#requiredCaptureIds[${index}]`
      );
    }
  }

  const capturePaths = new Set();

  for (
    const [
      index,
      capture
    ] of captures.entries()
  ) {
    const location =
      `${registryPath}#captures[${index}]`;

    if (capture?.path) {
      capturePaths.add(capture.path);
    }

    if (
      manifestValidated &&
      requiredIdSet.has(capture?.id) &&
      capture?.status !== "approved"
    ) {
      collector.error(
        "SLICE_EVIDENCE_CAPTURE_NOT_APPROVED",
        `Required capture '${capture?.id}' is not approved.`,
        `${location}.status`,
        capture?.status
      );
    }

    if (
      !CAPTURE_COMPLETED_STATUSES.has(
        capture?.status
      )
    ) {
      continue;
    }

    const imagePath = resolveProjectPath(
      repositoryRoot,
      capture?.path
    );

    if (
      !imagePath ||
      !(await nonEmptyFile(imagePath))
    ) {
      collector.error(
        "SLICE_EVIDENCE_CAPTURE_FILE_MISSING",
        `Capture '${capture?.id}' does not resolve to a non-empty image file.`,
        `${location}.path`,
        imagePath
      );
    }

    if (!capture?.capturedAt) {
      collector.error(
        "SLICE_EVIDENCE_CAPTURE_TIME_MISSING",
        `Capture '${capture?.id}' has no capturedAt timestamp.`,
        `${location}.capturedAt`
      );
    }

    if (capture?.status === "approved") {
      if (!capture?.approvedBy) {
        collector.error(
          "SLICE_EVIDENCE_CAPTURE_APPROVER_MISSING",
          `Approved capture '${capture?.id}' has no approvedBy value.`,
          `${location}.approvedBy`
        );
      }

      if (!capture?.approvedAt) {
        collector.error(
          "SLICE_EVIDENCE_CAPTURE_APPROVAL_TIME_MISSING",
          `Approved capture '${capture?.id}' has no approvedAt value.`,
          `${location}.approvedAt`
        );
      }

      for (
        const [
          checkName,
          checkStatus
        ] of Object.entries(
          capture?.checks ?? {}
        )
      ) {
        if (
          !COMPLETED_CHECK_STATUSES.has(
            checkStatus
          )
        ) {
          collector.error(
            "SLICE_EVIDENCE_CAPTURE_CHECK_INCOMPLETE",
            `Approved capture '${capture?.id}' has incomplete check ` +
            `'${checkName}' with status '${checkStatus}'.`,
            `${location}.checks.${checkName}`
          );
        }
      }
    }

    if (
      browserValidationContent &&
      capture?.id &&
      !browserValidationContent.includes(
        capture.id
      )
    ) {
      collector.warning(
        "SLICE_EVIDENCE_CAPTURE_NOT_REFERENCED",
        `Capture '${capture.id}' is not referenced by browser-validation.md.`,
        location
      );
    }
  }

  if (
    manifestValidated &&
    registry?.meta?.status !== "validated"
  ) {
    collector.error(
      "SLICE_EVIDENCE_REGISTRY_NOT_VALIDATED",
      "Screenshot registry meta.status must be validated when the " +
      "small-slice manifest is validated.",
      `${registryPath}#meta.status`,
      registry?.meta?.status
    );
  }

  for (const evidence of asArray(manifest?.evidence)) {
    if (
      evidence?.type === "screenshot" &&
      evidence?.path &&
      !capturePaths.has(evidence.path)
    ) {
      collector.error(
        "SLICE_EVIDENCE_SCREENSHOT_NOT_REGISTERED",
        `Screenshot evidence '${evidence.id}' is not registered in ` +
        "screenshot-evidence.json.",
        "$.evidence",
        evidence.path
      );
    }
  }

  collector.info(
    "SLICE_EVIDENCE_CAPTURE_COUNT",
    `${captures.length} screenshot capture or captures are registered.`,
    registryPath,
    {
      required: requiredCaptureIds.length
    }
  );

  return registry;
}

async function main() {
  const options = parseCliArgs(
    process.argv.slice(2)
  );

  const inputPath = requireInputPath(
    options,
    USAGE
  );

  const collector = new IssueCollector();

  let manifestFile;

  try {
    manifestFile = await readJsonFile(inputPath);
  } catch (error) {
    collector.error(
      "SLICE_EVIDENCE_MANIFEST_JSON",
      error.message,
      inputPath
    );

    collector.print(
      "Small Slice Evidence Audit",
      {
        json: options.json
      }
    );

    setExitCode(collector, options);
    return;
  }

  const manifest = manifestFile.value;
  const manifestStatus =
    manifest?.meta?.status;

  const repositoryRoot =
    resolveFromCwd(
      manifest?.repository?.root ?? "."
    );

  const evidenceItems =
    asArray(manifest?.evidence);

  const evidenceByType = new Map();

  for (const evidence of evidenceItems) {
    const list =
      evidenceByType.get(evidence?.type) ?? [];

    list.push(evidence);

    evidenceByType.set(
      evidence?.type,
      list
    );
  }

  for (
    const requiredType of
    REQUIRED_EXECUTION_EVIDENCE_TYPES
  ) {
    if (
      asArray(
        evidenceByType.get(requiredType)
      ).length === 0
    ) {
      collector.error(
        "SLICE_EVIDENCE_TYPE_MISSING",
        `Required execution evidence type '${requiredType}' is missing.`,
        "$.evidence"
      );
    }
  }

  const resolvedEvidence = new Map();

  for (
    const [
      index,
      evidence
    ] of evidenceItems.entries()
  ) {
    const location =
      `$.evidence[${index}]`;

    if (
      evidence?.required === true &&
      manifestStatus === "validated" &&
      !COMPLETED_EVIDENCE_STATUSES.has(
        evidence?.status
      )
    ) {
      collector.error(
        "SLICE_EVIDENCE_REQUIRED_INCOMPLETE",
        `Required evidence '${evidence?.id}' is incomplete.`,
        `${location}.status`,
        evidence?.status
      );
    }

    if (
      !COMPLETED_EVIDENCE_STATUSES.has(
        evidence?.status
      )
    ) {
      continue;
    }

    if (isRemoteReference(evidence?.path)) {
      collector.warning(
        "SLICE_EVIDENCE_REMOTE",
        `Evidence '${evidence?.id}' is remote and was not checked locally.`,
        `${location}.path`,
        evidence?.path
      );

      continue;
    }

    const resolvedPath = resolveProjectPath(
      repositoryRoot,
      evidence?.path
    );

    if (
      !resolvedPath ||
      !(await nonEmptyFile(resolvedPath))
    ) {
      collector.error(
        "SLICE_EVIDENCE_FILE_MISSING",
        `Evidence '${evidence?.id}' does not resolve to a non-empty file.`,
        `${location}.path`,
        resolvedPath
      );

      continue;
    }

    resolvedEvidence.set(
      evidence?.id,
      {
        evidence,
        path: resolvedPath
      }
    );

    collector.info(
      "SLICE_EVIDENCE_FILE_FOUND",
      `Evidence '${evidence?.id}' exists.`,
      resolvedPath
    );
  }

  const markdownContents = new Map();

  for (
    const evidence of evidenceItems
  ) {
    if (
      ![
        "implementation-journal",
        "browser-validation",
        "design-system-audit",
        "defect-log"
      ].includes(evidence?.type)
    ) {
      continue;
    }

    const resolved =
      resolvedEvidence.get(evidence?.id);

    if (!resolved) {
      continue;
    }

    const content =
      await inspectMarkdownEvidence({
        evidence,
        filePath: resolved.path,
        manifestStatus,
        collector
      });

    markdownContents.set(
      evidence.type,
      content
    );
  }

  const registryEvidence =
    asArray(
      evidenceByType.get(
        "screenshot-registry"
      )
    )[0];

  if (registryEvidence) {
    const resolved =
      resolvedEvidence.get(
        registryEvidence.id
      );

    if (resolved) {
      await inspectScreenshotRegistry({
        registryEvidence,
        registryPath: resolved.path,
        repositoryRoot,
        manifest,
        browserValidationContent:
          markdownContents.get(
            "browser-validation"
          ) ?? null,
        collector
      });
    }
  }

  collector.print(
    "Small Slice Evidence Audit",
    {
      json: options.json
    }
  );

  setExitCode(collector, options);
}

main().catch((error) => {
  process.stderr.write(
    `${error.stack ?? error.message}\n`
  );

  process.exitCode = 1;
});
