#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  canonicalProductDesignDigest,
  compileProductDesignBrief,
  deriveProductDesignProfile
} from "./product-design-control.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "../..");
const CLI = path.join(SCRIPT_DIR, "product-design-control.mjs");
let assertions = 0;

function equal(actual, expected, message) {
  assertions += 1;
  assert.deepEqual(actual, expected, message);
}

function ok(value, message) {
  assertions += 1;
  assert.ok(value, message);
}

function findingIds(value) {
  return [...new Set((value.findings ?? value).map((finding) => finding.id))].sort();
}

function validInput() {
  return {
    subject: { project: "fixture", commit: "a".repeat(40) },
    feature: "delegated-product-design-authority",
    product: { name: "Radar jurídico", maturity: "greenfield" },
    audience: { primary: "analista jurídico", knowledge: "especialista" },
    task: { dominant: "priorizar uma execução para análise", reversibility: "reversible" },
    context: { emotional: "confiança com baixa distração", visitorMode: "Operate", risk: "standard" },
    content: {
      representativeCopy: ["Priorizar execução"],
      claims: []
    },
    states: ["loading", "empty", "ready", "error"],
    userEvidence: [{
      id: "UE-001",
      grade: "hypothesis",
      statement: "Analistas precisam comparar urgência e valor.",
      validationPlan: "Validar ordem de leitura com cinco analistas antes do release amplo."
    }],
    localSources: [{ id: "design-system", kind: "design-system", status: "insufficient" }],
    openCapabilities: ["open-web", "openverse", "fontsource", "lucide", "iconify-open-sets"]
  };
}

const profile = deriveProductDesignProfile(validInput());
equal(profile.findings, [], "A complete product context must profile without findings.");
equal(profile.profile.visitorMode, "Operate", "Visitor mode must remain explicit.");
equal(profile.researchPlan.intensity, "targeted-research", "Operate greenfield work must default to targeted research.");
equal(profile.researchPlan.minimumReferences, 3, "Targeted research must require three references.");
equal(profile.researchPlan.minimumOrigins, 2, "Targeted research must require two origins.");

const authenticatedProvider = validInput();
authenticatedProvider.openCapabilities.push("figma-authenticated");
equal(findingIds(deriveProductDesignProfile(authenticatedProvider)), ["PDA-05"], "Unknown/authenticated providers must fail closed outside the initial open allowlist.");

const compiled = compileProductDesignBrief(validInput(), profile.profile, profile.researchPlan);
equal(compiled.findings, [], "A reversible hypothesis with validation plan must compile.");
equal(compiled.brief.userEvidence[0].grade, "hypothesis", "Evidence grade must not be promoted.");
equal(compiled.brief.visualPreferenceQuestions, [], "A valid brief must not transfer visual preference.");

const missing = validInput();
delete missing.audience;
delete missing.task;
equal(findingIds(compileProductDesignBrief(missing)), ["PDA-01"], "Missing audience/task must fail with PDA-01.");

const preference = validInput();
preference.questions = [{ kind: "visual-preference", text: "Qual cor e layout você prefere?" }];
equal(findingIds(compileProductDesignBrief(preference)), ["PDA-02"], "Resolvable visual preference must fail with PDA-02.");

const criticalHypothesis = validInput();
criticalHypothesis.context.risk = "critical";
criticalHypothesis.context.consequentialAreas = ["consent"];
equal(findingIds(compileProductDesignBrief(criticalHypothesis)), ["PDA-12"], "Critical consent cannot rely only on hypothesis.");

const unsupportedClaim = validInput();
unsupportedClaim.content.claims = [{ id: "claim-1", text: "Reduz o tempo em 80%" }];
equal(findingIds(compileProductDesignBrief(unsupportedClaim)), ["PDA-11"], "A factual claim without source must fail with PDA-11.");

equal(
  canonicalProductDesignDigest({ b: 2, a: 1, generatedAt: "today", absolutePath: "/tmp/a" }),
  canonicalProductDesignDigest({ absolutePath: "/elsewhere", a: 1, generatedAt: "tomorrow", b: 2 }),
  "Volatile fields, paths and key order must not change product-design digests."
);

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "product-design-control-"));
try {
  const inputPath = path.join(temp, "input.json");
  const outputDir = path.join(temp, "profile");
  fs.writeFileSync(inputPath, `${JSON.stringify(validInput(), null, 2)}\n`);
  const profileResult = spawnSync(process.execPath, [CLI, "profile", "--input", inputPath, "--output-dir", outputDir], {
    cwd: ROOT,
    encoding: "utf8"
  });
  equal(profileResult.status, 0, `profile CLI failed:\n${profileResult.stderr}`);
  ok(fs.existsSync(path.join(outputDir, "product-design-profile.json")), "Profile artifact must be emitted.");
  ok(fs.existsSync(path.join(outputDir, "visual-research-plan.json")), "Research plan must be emitted.");

  const compileDir = path.join(temp, "compile");
  const compileResult = spawnSync(process.execPath, [CLI, "compile", "--input", inputPath, "--output-dir", compileDir], {
    cwd: ROOT,
    encoding: "utf8"
  });
  equal(compileResult.status, 0, `compile CLI failed:\n${compileResult.stderr}`);
  const briefPath = path.join(compileDir, "product-design-brief.json");
  ok(fs.existsSync(briefPath), "Product Design Brief must be emitted.");
  const cliBrief = JSON.parse(fs.readFileSync(briefPath, "utf8"));
  equal(cliBrief.semanticDigest, compiled.brief.semanticDigest, "Programmatic and CLI compilation must agree.");
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

console.log(`Product design control tests passed (${assertions} assertions).`);
