#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const validator = path.join(path.dirname(fileURLToPath(import.meta.url)), "validate-feature-package.mjs");

function write(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function packageAt(directory, extras = {}) {
  const req = "REQ-GATE-001";
  const ac = "AC-GATE-001";
  const scn = "SCN-GATE-001";
  const at = "AT-GATE-001";
  const task = "T-GATE-001";
  write(path.join(directory, "00-intent.md"), extras.intent || `# Intent\n\n${req}: package.\n`);
  write(path.join(directory, "01-spec.md"), `# Spec\n\n${req}: contract.\n`);
  write(path.join(directory, "02-assumptions.md"), `# Assumptions\n\nNenhuma.\n`);
  write(path.join(directory, "applicability.md"), "```text\ncomplexity: small\ncriticality: low\nfrontend: not-applicable\nbackend: not-applicable\npersistence: not-applicable\npublic-api: unchanged\nauth: not-applicable\ntenancy: not-applicable\nconcurrency: not-applicable\nmigration: not-applicable\nnew-service-or-subsystem: not-applicable\nmaterial-operational-cost: not-applicable\nperformance: standard\naccessibility: not-applicable\nfrontend-representative-gate: not-applicable\nbackend-representative-gate: not-applicable\nbrowser-evidence: not-applicable\ncontract-drift-check: not-applicable\ninterface-contract: not-applicable\nbehavioral-ux: not-applicable\nbehavioral-ux-risk: none\noutcome-evidence: not-applicable\n```\n");
  write(path.join(directory, "03-acceptance-criteria.md"), extras.acceptance || `# Acceptance\n\n### ${ac}\n\n- Requisitos: ${req}.\n`);
  write(path.join(directory, "04-behavior-scenarios.feature"), `Funcionalidade: gate\n  @${scn} @${ac} @${req}\n  Cenário: ok\n    Então passa\n`);
  write(path.join(directory, "05-executable-acceptance-tests.md"), extras.executable || `# AT\n\n| ${at} | ${req} / ${ac} / ${scn} | unit | setup | RED | runner |\n`);
  write(path.join(directory, "08-test-plan.md"), extras.plan || `# Plan\n\n${at} covered.\n`);
  write(path.join(directory, "09-tasks.md"), `# Tasks\n\n### \`${task}\` — implement ${req} ${ac} ${scn} ${at}\n\n- Status: pending.\n`);
}

function run(directory) {
  return spawnSync(process.execPath, [validator, directory], { encoding: "utf8" });
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), "sde-gate-p0-"));

const plain = path.join(root, "plain");
packageAt(plain);
const plainResult = run(plain);
assert.equal(plainResult.status, 0, plainResult.stdout);

const uncertain = path.join(root, "uncertain");
packageAt(uncertain, { plan: "# Plan\n\nAT-GATE-001 covered.\n\nThe gate probably passed.\n" });
const uncertainResult = run(uncertain);
assert.notEqual(uncertainResult.status, 0);
assert.match(uncertainResult.stdout, /uncertain language near gate statuses/);

const bareNotRun = path.join(root, "bare-not-run");
packageAt(bareNotRun, { plan: "# Plan\n\nAT-GATE-001 covered.\n\nGate status: not-run.\n" });
const bareResult = run(bareNotRun);
assert.notEqual(bareResult.status, 0);
assert.match(bareResult.stdout, /not-run without a command or probe/);

const probed = path.join(root, "probed");
packageAt(probed, { plan: "# Plan\n\nAT-GATE-001 covered.\n\nGate status: not-run. command: `node scripts/probe.mjs`\n" });
const probedResult = run(probed);
assert.equal(probedResult.status, 0, probedResult.stdout);

const proseP0 = path.join(root, "prose-p0");
packageAt(proseP0, { intent: "# Intent\n\nREQ-GATE-001 is important, even called P0 in prose, but it has no priority cell.\n" });
const proseResult = run(proseP0);
assert.equal(proseResult.status, 0, proseResult.stdout);
assert.doesNotMatch(proseResult.stdout, /P0 requirement/);

const marked = path.join(root, "marked-p0");
packageAt(marked, {
  intent: "# Intent\n\n| `REQ-GATE-001` | P0 | Must hold. |\n",
  acceptance: "# Acceptance\n\n### AC-GATE-001\n\n- Outro requisito.\n",
  executable: "# AT\n\n| AT-GATE-002 | REQ-OTHER-001 | unit | setup | RED | runner |\n"
});
const markedResult = run(marked);
assert.notEqual(markedResult.status, 0);
assert.match(markedResult.stdout, /P0 requirement has no acceptance criterion reference: REQ-GATE-001/);
assert.match(markedResult.stdout, /P0 requirement has no executable test or non-automatable justification: REQ-GATE-001/);

const justified = path.join(root, "justified-p0");
packageAt(justified, {
  intent: "# Intent\n\n| `REQ-GATE-001` | P0 | Must hold. |\n",
  executable: "# AT\n\n| AT-GATE-001 | SCN-GATE-001 | unit | setup | RED | runner |\n\nREQ-GATE-001: teste não automatizável porque depende de julgamento visual humano.\n"
});
const justifiedResult = run(justified);
assert.equal(justifiedResult.status, 0, justifiedResult.stdout);

console.log("feature package gate status and P0 trace: errors and non-inference hold");
