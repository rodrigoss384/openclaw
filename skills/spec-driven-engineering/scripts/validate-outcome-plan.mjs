#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { parseArgs, printReport } from "./lib/workflow-utils.mjs";

const USAGE = "node validate-outcome-plan.mjs <outcome-plan.md>";

const REQUIRED_PREREGISTRATION_FIELDS = [
  "Hipótese",
  "Metric Class",
  "primaryMetric",
  "guardrails",
  "Tamanho/duração mínima da amostra",
  "Limiar de confirmação vs refutação",
  "Método de análise",
  "Data planejada de início da janela de observação",
  "Data planejada de fechamento da janela de observação"
];

function extractSection(content, heading, nextHeadingPattern) {
  const start = content.indexOf(heading);
  if (start === -1) return null;
  const afterHeading = start + heading.length;
  const rest = content.slice(afterHeading);
  const nextMatch = rest.match(nextHeadingPattern);
  const end = nextMatch ? afterHeading + nextMatch.index : content.length;
  return content.slice(afterHeading, end).trim();
}

function extractFreezeField(freezeSection, field) {
  const pattern = new RegExp(`^-\\s*${field}:\\s*(.+)$`, "m");
  const match = freezeSection.match(pattern);
  if (!match) return null;
  return match[1].trim().replace(/^`|`$/g, "");
}

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
    errors.push(`outcome-plan.md not found: ${resolvedPath}`);
  } else {
    const content = fs.readFileSync(resolvedPath, "utf8");

    const unresolvedPlaceholders = [...content.matchAll(/\{\{[A-Z][A-Z0-9_]*\}\}/g)].map((match) => match[0]);
    if (unresolvedPlaceholders.length > 0) {
      errors.push(`Unresolved placeholders remain: ${[...new Set(unresolvedPlaceholders)].join(", ")}`);
    }

    const preregistration = extractSection(content, "## Preregistration", /\n##\s/);
    const freeze = extractSection(content, "## Freeze", /\n##\s/);

    if (!preregistration) {
      errors.push("Missing '## Preregistration' section.");
    } else {
      for (const field of REQUIRED_PREREGISTRATION_FIELDS) {
        const linePattern = new RegExp(`^-\\s*(\`?${field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\`?[^:]*):\\s*(.*)$`, "m");
        const match = preregistration.match(linePattern);
        if (!match) {
          errors.push(`Preregistration is missing field: ${field}`);
          continue;
        }
        const value = match[2].trim().replace(/^`|`$/g, "");
        if (!value || value.startsWith("<") || value.includes("|")) {
          errors.push(`Preregistration field '${field}' still has a placeholder or unresolved enum-hint value.`);
        }
      }
    }

    if (!freeze) {
      errors.push("Missing '## Freeze' section.");
    } else {
      const status = extractFreezeField(freeze, "status");
      const frozenAt = extractFreezeField(freeze, "frozenAt");
      const frozenSha256 = extractFreezeField(freeze, "frozenSha256");

      if (status !== "draft" && status !== "frozen") {
        errors.push(`Freeze status must be 'draft' or 'frozen', got: ${status}`);
      } else if (status === "draft") {
        if (frozenSha256 && !/^(Nenhum|)$/i.test(frozenSha256)) {
          errors.push("status: draft requires frozenSha256: Nenhum — a draft cannot carry a frozen hash.");
        }
        information.push("outcome-plan.md is a draft (not yet frozen) — 11-outcome-evidence.prompt.md must not run against it.");
      } else if (status === "frozen") {
        if (!frozenAt || Number.isNaN(Date.parse(frozenAt))) {
          errors.push("status: frozen requires a valid ISO-8601 frozenAt date.");
        }
        if (!frozenSha256 || !/^[a-f0-9]{64}$/i.test(frozenSha256)) {
          errors.push("status: frozen requires a 64-character hex frozenSha256.");
        } else if (preregistration) {
          const recomputed = crypto.createHash("sha256").update(preregistration, "utf8").digest("hex");
          if (recomputed.toLowerCase() !== frozenSha256.toLowerCase()) {
            errors.push(
              "The Preregistration block does not match its frozenSha256 — it was edited after freeze without following the reopening procedure in outcome-evidence.md. This is mechanically detected HARKing risk, not a formatting issue."
            );
          } else {
            information.push("Preregistration block hash matches frozenSha256 — no post-freeze edit detected.");
          }
        }
      }
    }
  }
}

const ok = printReport("Spec-Driven Engineering — Outcome Plan Validation", errors, warnings, information);
process.exitCode = ok ? 0 : 1;
