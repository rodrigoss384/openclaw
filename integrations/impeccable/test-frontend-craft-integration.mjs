#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validateJsonSchema, validateSchemaSupport } from "../../skills/spec-driven-engineering/scripts/lib/json-schema.mjs";

const integrationDir = path.dirname(fileURLToPath(import.meta.url));
const workflowRoot = path.resolve(integrationDir, "../..");
const adapter = path.join(integrationDir, "frontend-craft.mjs");
const policyPath = path.join(workflowRoot, "prompts/spec-driven/frontend-craft-policy.json");
const schemaPath = path.join(integrationDir, "frontend-craft-policy.schema.json");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "frontend-craft-integration-"));

function run(args) {
  return spawnSync(process.execPath, [adapter, ...args], {
    cwd: workflowRoot,
    encoding: "utf8"
  });
}

try {
  const policy = JSON.parse(fs.readFileSync(policyPath, "utf8"));
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  assert.deepEqual(validateSchemaSupport(schema), [], "frontend craft policy schema must stay inside the workflow validator's supported subset");
  assert.deepEqual(validateJsonSchema(policy, schema), [], "committed frontend craft policy must satisfy its JSON Schema");

  const verify = run(["verify-policy", "--root", workflowRoot]);
  assert.equal(verify.status, 0, `verify-policy failed:\n${verify.stdout}\n${verify.stderr}`);
  assert.match(verify.stdout, /Impeccable 3\.5\.0/);
  assert.match(verify.stdout, /rollout=primary/);

  const featureDir = path.join(temp, "feature-example");
  const outputDir = path.join(temp, "provider-context");
  fs.mkdirSync(featureDir, { recursive: true });
  fs.writeFileSync(path.join(featureDir, "00-intent.md"), "# Intent\n\nPrimary job: review a representative record.\n");
  fs.writeFileSync(path.join(featureDir, "01-spec.md"), "# Spec\n\nREQ-CRAFT-001: preserve the approved product behavior.\n");

  const prepare = run([
    "prepare",
    "--root", workflowRoot,
    "--feature-dir", featureDir,
    "--output-dir", outputDir
  ]);
  assert.equal(prepare.status, 0, `prepare failed:\n${prepare.stdout}\n${prepare.stderr}`);

  const productProjection = path.join(outputDir, "PRODUCT.md");
  const designProjection = path.join(outputDir, "DESIGN.md");
  const provenancePath = path.join(outputDir, "frontend-craft-provenance.json");
  for (const filePath of [productProjection, designProjection, provenancePath]) {
    assert.ok(fs.existsSync(filePath), `missing generated context artifact: ${filePath}`);
  }

  const product = fs.readFileSync(productProjection, "utf8");
  assert.match(product, /NON-AUTHORITATIVE PROVIDER PROJECTION/);
  assert.match(product, /REQ-CRAFT-001/);
  assert.match(product, /SHA-256:/);

  let provenance = JSON.parse(fs.readFileSync(provenancePath, "utf8"));
  assert.equal(provenance.provider, "impeccable");
  assert.equal(provenance.providerVersion, "3.5.0");
  assert.equal(provenance.rolloutPhase, "primary");
  assert.ok(provenance.sourceFiles.length >= 2);
  assert.ok(provenance.sourceFiles.every((entry) => /^[a-f0-9]{64}$/.test(entry.sha256)));
  assert.deepEqual(provenance.runs, []);

  const record = run([
    "record",
    "--root", workflowRoot,
    "--context-dir", outputDir,
    "--provider-command", "critique",
    "--status", "passed-with-findings",
    "--visitor-mode", "operate",
    "--target", "feature-example"
  ]);
  assert.equal(record.status, 0, `record failed:\n${record.stdout}\n${record.stderr}`);
  provenance = JSON.parse(fs.readFileSync(provenancePath, "utf8"));
  assert.equal(provenance.runs.length, 1);
  assert.equal(provenance.runs[0].command, "critique");
  assert.equal(provenance.runs[0].visitorMode, "operate");
  assert.equal(provenance.runs[0].status, "passed-with-findings");

  const fakeSkill = path.join(temp, "fake-impeccable");
  fs.mkdirSync(path.join(fakeSkill, "scripts"), { recursive: true });
  fs.writeFileSync(
    path.join(fakeSkill, "scripts/detect.mjs"),
    [
      "const args = process.argv.slice(2);",
      "if (!args.includes('--json')) { console.error('missing --json'); process.exit(7); }",
      "const target = args.at(-1);",
      "process.stdout.write(JSON.stringify([{ antipattern: 'fixture-rule', file: target }]) + '\\n');"
    ].join("\n")
  );
  const target = path.join(temp, "target.tsx");
  fs.writeFileSync(target, "export function Target(){ return <main>Fixture</main>; }\n");

  const detect = run([
    "detect",
    "--root", workflowRoot,
    "--skill-dir", fakeSkill,
    "--target", target,
    "--scope", "layout"
  ]);
  assert.equal(detect.status, 0, `detector adapter failed:\n${detect.stdout}\n${detect.stderr}`);
  const findings = JSON.parse(detect.stdout);
  assert.equal(findings[0].antipattern, "fixture-rule");

  const invalidRoot = path.join(temp, "invalid-policy");
  const invalidPolicyDir = path.join(invalidRoot, "prompts/spec-driven");
  const invalidSchemaDir = path.join(invalidRoot, "integrations/impeccable");
  fs.mkdirSync(invalidPolicyDir, { recursive: true });
  fs.mkdirSync(invalidSchemaDir, { recursive: true });
  fs.copyFileSync(schemaPath, path.join(invalidSchemaDir, "frontend-craft-policy.schema.json"));
  const invalidPolicy = structuredClone(policy);
  invalidPolicy.representativeReview.mayApproveGate = true;
  fs.writeFileSync(path.join(invalidPolicyDir, "frontend-craft-policy.json"), `${JSON.stringify(invalidPolicy, null, 2)}\n`);
  const invalid = run([
    "verify-policy",
    "--root", workflowRoot,
    "--policy", path.join(invalidPolicyDir, "frontend-craft-policy.json")
  ]);
  assert.notEqual(invalid.status, 0, "policy that gives Impeccable representative-gate approval authority must be rejected");

  console.log("Frontend craft integration: passed (schema, context bridge, provenance, detector adapter, authority rejection). ");
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
