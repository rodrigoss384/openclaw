#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateJsonSchema, validateSchemaSupport } from "../../skills/spec-driven-engineering/scripts/lib/json-schema.mjs";
import { FINDING_CLASSES } from "./finding-router.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, "../..");
const SOURCES = new Set(["impeccable-critique", "objective-audit", "manual-review", "impeccable-detector"]);
const DEFECT_KINDS = new Set(["implementation", "contract"]);
const SEVERITIES = new Set(["p0", "p1", "p2", "p3", "info"]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function kebab(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function validateRawFinding(finding, index) {
  const errors = [];
  if (!finding || typeof finding !== "object" || Array.isArray(finding)) return [`findings[${index}] must be an object`];
  if (!FINDING_CLASSES.includes(finding.class)) errors.push(`findings[${index}].class must be an explicit governed taxonomy class`);
  if (!DEFECT_KINDS.has(finding.defectKind)) errors.push(`findings[${index}].defectKind must be explicitly implementation or contract`);
  if (typeof finding.summary !== "string" || !finding.summary.trim()) errors.push(`findings[${index}].summary must be non-empty`);
  if (typeof finding.material !== "boolean") errors.push(`findings[${index}].material must be an explicit boolean`);
  if (finding.severity != null && !SEVERITIES.has(finding.severity)) errors.push(`findings[${index}].severity is not governed`);
  if (finding.evidenceRefs != null && (!Array.isArray(finding.evidenceRefs) || finding.evidenceRefs.some((item) => typeof item !== "string" || !item.trim()))) {
    errors.push(`findings[${index}].evidenceRefs must be an array of non-empty strings`);
  }
  return errors;
}

function loadSchema(root, policy) {
  const schemaPath = path.resolve(root, policy.repairLoop.normalizedFindingBatchSchema);
  const schema = readJson(schemaPath);
  const supportErrors = validateSchemaSupport(schema);
  if (supportErrors.length) throw new Error(`Normalized finding schema uses unsupported keywords:\n- ${supportErrors.join("\n- ")}`);
  return { schema, schemaPath };
}

export function normalizeFindingBatch({ root = DEFAULT_ROOT, policy, envelope }) {
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) throw new Error("Critique finding envelope must be an object.");
  if (!SOURCES.has(envelope.source)) throw new Error("Critique finding envelope source is not governed.");
  if (typeof envelope.screenId !== "string" || !envelope.screenId.trim()) throw new Error("Critique finding envelope requires screenId.");
  if (!Array.isArray(envelope.findings)) throw new Error("Critique finding envelope requires findings[].");
  if (envelope.source === "impeccable-critique") {
    if (envelope.provider?.id !== policy.provider.id || envelope.provider?.version !== policy.provider.version) {
      throw new Error(`Impeccable critique provider must be exactly ${policy.provider.id}@${policy.provider.version}.`);
    }
    if (envelope.command !== policy.representativeReview.command) throw new Error(`Impeccable critique command must be '${policy.representativeReview.command}'.`);
  }

  const errors = envelope.findings.flatMap((finding, index) => validateRawFinding(finding, index));
  if (errors.length) throw new Error(`Critique findings are not explicitly normalized:\n- ${errors.join("\n- ")}\nThe normalizer never infers class, defectKind, or materiality from free text.`);

  const used = new Set();
  const findings = envelope.findings.map((finding, index) => {
    const fingerprint = sha256(JSON.stringify({
      screenId: envelope.screenId,
      source: envelope.source,
      class: finding.class,
      defectKind: finding.defectKind,
      summary: finding.summary.trim(),
      target: finding.target || null,
      evidenceRefs: finding.evidenceRefs || []
    }));
    let id = kebab(finding.id);
    if (!id) id = `finding-${fingerprint.slice(0, 12)}`;
    if (used.has(id)) id = `${id}-${index + 1}`;
    used.add(id);
    return {
      id,
      class: finding.class,
      defectKind: finding.defectKind,
      summary: finding.summary.trim(),
      source: envelope.source,
      severity: finding.severity || "p2",
      material: finding.material,
      target: finding.target || null,
      sourceArtifact: envelope.sourceArtifact || null,
      evidenceRefs: [...(finding.evidenceRefs || [])],
      fingerprint
    };
  });

  const batch = {
    $schema: "normalized-finding-batch.schema.json",
    schemaVersion: "1.0.0",
    generated: true,
    generatedAt: new Date().toISOString(),
    screenId: envelope.screenId,
    source: envelope.source,
    provider: envelope.provider || null,
    command: envelope.command || null,
    sourceArtifact: envelope.sourceArtifact || null,
    findings
  };
  const { schema } = loadSchema(root, policy);
  const schemaErrors = validateJsonSchema(batch, schema);
  if (schemaErrors.length) throw new Error(`Normalized finding batch is invalid:\n- ${schemaErrors.join("\n- ")}`);
  return batch;
}

export function normalizeFindingBatchToFile({ root = DEFAULT_ROOT, policy, envelopePath, outputPath }) {
  const envelope = readJson(envelopePath);
  const batch = normalizeFindingBatch({ root, policy, envelope });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(batch, null, 2)}\n`);
  return batch;
}
