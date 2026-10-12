#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scripts = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(scripts, "..");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "styling-authority-cli-"));
let assertions = 0;

function run(script, args, expectedStatus) {
  const result = spawnSync("node", [path.join(scripts, script), ...args], { cwd: tempRoot, encoding: "utf8" });
  assert.equal(result.status, expectedStatus, `${script} unexpected result:\n${result.stdout}\n${result.stderr}`);
  assertions += 1;
  return result;
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

try {
  const fixture = JSON.parse(fs.readFileSync(path.join(skillRoot, "evals/files/contracts/valid/styling-authority.valid.json"), "utf8"));
  fixture.version = "1.0.0";
  delete fixture.visualResearch;
  fixture.visualReferences = [{
    id: "VREF-EXAMPLE-001",
    kind: "existing-product",
    source: "docs/frontend/reference.svg",
    status: "approved",
    approvedAspects: ["layout-rhythm"],
    excludedAspects: ["brand-identity"],
    evidence: ["docs/frontend/reference-approval.md"]
  }];
  fixture.status = "approved";
  fixture.authority.globalStylesheets[0].path = "src/globals.css";
  fixture.repositoryEvidence.inspectedFiles = ["docs/frontend/authority-input.md"];
  const contractPath = path.join(tempRoot, "docs/frontend/styling-authority.json");
  const cssPath = path.join(tempRoot, "src/globals.css");
  fs.mkdirSync(path.dirname(cssPath), { recursive: true });
  fs.writeFileSync(cssPath, ":root { --surface: white; }\n.dark { color-scheme: dark; }\nbody { margin: 0; }\n");
  fs.mkdirSync(path.join(tempRoot, "docs/frontend"), { recursive: true });
  fs.writeFileSync(path.join(tempRoot, "docs/frontend/authority-input.md"), "# Authority input\n");
  fs.writeFileSync(path.join(tempRoot, "docs/frontend/reference.svg"), "<svg xmlns=\"http://www.w3.org/2000/svg\"/>\n");
  fs.writeFileSync(path.join(tempRoot, "docs/frontend/reference-approval.md"), "# Approved reference\n");
  writeJson(contractPath, fixture);

  run("validate-styling-authority.mjs", [contractPath], 0);
  run("validate-styling-authority.mjs", [contractPath, "--check-references"], 0);
  run("audit-styling-authority.mjs", [contractPath, tempRoot], 0);

  fs.appendFileSync(cssPath, ".a2i-cliente-section__title { margin: 13px; }\n");
  const audit = run("audit-styling-authority.mjs", [contractPath, tempRoot], 1);
  assert.match(audit.stdout, /UNAUTHORIZED_GLOBAL_CLASS_SELECTOR/);
  assertions += 1;

  fs.writeFileSync(cssPath, ":root { --surface: white; }\n.dark { color-scheme: dark; }\nbody { margin: 0; }\n");
  const undeclaredStylesheet = path.join(tempRoot, "src/feature.css");
  fs.writeFileSync(undeclaredStylesheet, ".a2i-cliente-origin { color: red; }\n");
  const undeclaredAudit = run("audit-styling-authority.mjs", [contractPath, tempRoot], 1);
  assert.match(undeclaredAudit.stdout, /UNREGISTERED_GLOBAL_STYLESHEET/);
  assertions += 1;
  fs.rmSync(undeclaredStylesheet);

  // WF-SOS-004: restricted arbitrary/inline policies must fail on feature sources, not only authority JSON.
  const featureDir = path.join(tempRoot, "src/features/demo");
  fs.mkdirSync(featureDir, { recursive: true });
  const dirtyFeature = path.join(featureDir, "Panel.tsx");
  fs.writeFileSync(
    dirtyFeature,
    "export function Panel(){return <div className=\"max-w-[42rem]\" style={{color:'red'}}/>}\n"
  );
  const featureAudit = run("audit-styling-authority.mjs", [contractPath, tempRoot], 1);
  assert.match(featureAudit.stdout, /FEATURE_ARBITRARY_UTILITY|FEATURE_INLINE_STYLE/);
  assertions += 1;
  fs.rmSync(featureDir, { recursive: true, force: true });

  const unresolved = structuredClone(fixture);
  unresolved.authority.tokenSources = ["{{TOKEN_SOURCE}}"];
  const unresolvedPath = path.join(tempRoot, "unresolved.json");
  writeJson(unresolvedPath, unresolved);
  run("validate-styling-authority.mjs", [unresolvedPath], 1);

  const noApprovedReference = structuredClone(fixture);
  noApprovedReference.visualReferences[0].status = "candidate";
  const noReferencePath = path.join(tempRoot, "no-approved-reference.json");
  writeJson(noReferencePath, noApprovedReference);
  run("validate-styling-authority.mjs", [noReferencePath], 1);

  const transientReference = structuredClone(fixture);
  transientReference.visualReferences[0].source = ".field-test/inputs/reference.svg";
  transientReference.visualReferences[0].evidence = [".field-test/inputs/reference-approval.md"];
  const transientReferencePath = path.join(tempRoot, "transient-reference.json");
  fs.mkdirSync(path.join(tempRoot, ".field-test/inputs"), { recursive: true });
  fs.writeFileSync(path.join(tempRoot, ".field-test/inputs/reference.svg"), "<svg/>\n");
  fs.writeFileSync(path.join(tempRoot, ".field-test/inputs/reference-approval.md"), "approved\n");
  writeJson(transientReferencePath, transientReference);
  const transientResult = run("validate-styling-authority.mjs", [transientReferencePath, "--check-references"], 1);
  assert.match(transientResult.stdout, /TRANSIENT_REFERENCE_FORBIDDEN/);
  assertions += 1;

  const missingReference = structuredClone(fixture);
  missingReference.visualReferences[0].source = "docs/frontend/missing-reference.svg";
  const missingReferencePath = path.join(tempRoot, "missing-reference.json");
  writeJson(missingReferencePath, missingReference);
  const missingResult = run("validate-styling-authority.mjs", [missingReferencePath, "--check-references"], 1);
  assert.match(missingResult.stdout, /RETAINED_REFERENCE_MISSING/);
  assertions += 1;

  console.log(`Styling authority CLI tests: passed (${assertions} assertions)`);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
