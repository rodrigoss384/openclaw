#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDirectory, "../../..");
let assertions = 0;

for (const name of ["08-adversarial.prompt.md", "09-validate-evidence.prompt.md"]) {
  const content = fs.readFileSync(path.join(root, "prompts/spec-driven", name), "utf8");
  assert.match(content, /\$impeccable/, `${name} must declare Impeccable as primary craft authority.`);
  assert.doesNotMatch(content, /OBRIGATÓRIAS:[^\n]*(?:\$frontend-design|\$web-design-guidelines)/, `${name} must not require a competing visual authority.`);
  assert.match(content, /\$frontend-design[^\n]*fallback|fallback[^\n]*\$frontend-design/i, `${name} must label frontend-design as fallback.`);
  assert.match(content, /\$web-design-guidelines[^\n]*opcional|opcional[^\n]*\$web-design-guidelines/i, `${name} must label web-design-guidelines as optional.`);
  assertions += 4;
}

const manifest = JSON.parse(fs.readFileSync(path.join(root, "prompts/spec-driven/manifest.json"), "utf8"));
assert.deepEqual(manifest.frontendUiControlPolicy.ruleRollout, {
  "RULE-FE-UI-POLICY-001": "primary",
  "RULE-FE-UI-SOURCE-001": "primary",
  "RULE-FE-UI-RENDER-001": "primary",
  "RULE-FE-UI-INTEGRITY-001": "primary"
}, "Each UI control rule must have an independently reversible rollout state.");
assertions += 1;

console.log(`Frontend craft authority enforcement tests passed (${assertions} assertions).`);
