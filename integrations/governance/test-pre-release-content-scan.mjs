#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), "pre-release-content-scan.mjs");
const RUNNER = path.join(path.dirname(fileURLToPath(import.meta.url)), "governance-control.mjs");

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function scan(root, feature) {
  return spawnSync(process.execPath, [
    SCRIPT,
    "--root", root,
    "--feature-directory", feature
  ], { encoding: "utf8" });
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), "pre-release-scan-"));
write(path.join(root, ".specs/project/PROJECT.md"), "language: pt-BR\n");
const feature = ".specs/features/scan-probe";
const featureDir = path.join(root, feature);

const absent = scan(root, feature);
assert.equal(absent.status, 1, "missing feature directory must fail closed");

fs.mkdirSync(featureDir, { recursive: true });
const plain = scan(root, feature);
assert.equal(plain.status, 0);
assert.match(plain.stdout, /not-applicable/);

write(path.join(featureDir, "external-build.json"), JSON.stringify({ declared: true }));
const missing = scan(root, feature);
assert.equal(missing.status, 3);
assert.match(missing.stderr, /not-run|rendered evidence|renderedEvidence/);

write(path.join(featureDir, "external-build.json"), JSON.stringify({
  declared: true,
  renderedEvidence: "evidence/rendered.txt"
}));
const emptyTarget = scan(root, feature);
assert.equal(emptyTarget.status, 3);

write(path.join(featureDir, "evidence/rendered.txt"), "Saldo disponível para consulta.\n");
const clean = scan(root, feature);
assert.equal(clean.status, 0, clean.stderr);
assert.match(clean.stdout, /passed/);

write(path.join(featureDir, "evidence/rendered.txt"), "Este item não faz parte deste incremento.\n");
const dirty = scan(root, feature);
assert.equal(dirty.status, 1);
assert.match(dirty.stderr, /não faz parte deste incremento/);

write(path.join(featureDir, "evidence/rendered.txt"), `${"the and with this from that your have been which their ".repeat(2)}\n`);
const foreign = scan(root, feature);
assert.equal(foreign.status, 1);
assert.match(foreign.stderr, /output-language/);

write(path.join(featureDir, "external-build.json"), JSON.stringify({
  declared: true,
  renderedEvidence: "evidence/rendered.txt",
  exception: "Cliente aceitou o texto interno neste piloto."
}));
const excused = scan(root, feature);
assert.equal(excused.status, 0, excused.stderr);
assert.match(excused.stdout, /exception-recorded/);

assert.match(fs.readFileSync(RUNNER, "utf8"), /exitCode === 3/);
assert.match(fs.readFileSync(RUNNER, "utf8"), /"not-run"/);

console.log("pre-release content scan: declaration, not-run, vocabulary, language, exception");
