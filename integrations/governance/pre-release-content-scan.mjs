#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const PLANNING_PHRASES = [
  "não faz parte deste incremento",
  "nao faz parte deste incremento",
  "sem ação operacional neste incremento",
  "sem acao operacional neste incremento",
  "built with v0",
  "built with bolt",
  "made with lovable",
  "placeholder logo"
];

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) parsed[key] = true;
    else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function fail(message, code = 1) {
  console.error(`pre-release-content-scan: ${message}`);
  process.exit(code);
}

function outputLanguage(root) {
  const project = path.join(root, ".specs", "project", "PROJECT.md");
  if (!fs.existsSync(project)) return "";
  const match = fs.readFileSync(project, "utf8").match(/^language:\s*([^\s#]+)/m);
  return match ? match[1].trim() : "";
}

function languageMismatch(text, language) {
  const normalized = language.toLowerCase();
  const portuguese = (text.match(/\b(não|nao|uma|para|com|que|dos|das|este|esta)\b/gi) || []).length
    + (text.match(/[ãõáéíóúâêôç]/gi) || []).length;
  const english = (text.match(/\b(the|and|with|this|from|that|your|have|been|which|their)\b/gi) || []).length;
  if (normalized.startsWith("pt") && english >= 12 && portuguese === 0) {
    return "rendered text does not match output-language pt";
  }
  if (normalized.startsWith("en") && portuguese >= 12 && english === 0) {
    return "rendered text does not match output-language en";
  }
  if (!normalized.startsWith("pt") && !normalized.startsWith("en")) {
    return `output-language '${language || "<missing>"}' has no scan`;
  }
  return null;
}

function containedFile(featureDirectory, ref) {
  if (typeof ref !== "string" || !ref.trim() || path.isAbsolute(ref)) return null;
  const root = path.resolve(featureDirectory);
  const resolved = path.resolve(root, ref);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) return null;
  return resolved;
}

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(String(args.root || ""));
const featureRef = String(args["feature-directory"] || "");
if (!args.root || !featureRef) fail("requires --root and --feature-directory");

const featureDirectory = path.resolve(root, featureRef);
if (featureDirectory !== root && !featureDirectory.startsWith(`${root}${path.sep}`)) {
  fail("feature directory escapes project root");
}
if (!fs.existsSync(featureDirectory) || !fs.statSync(featureDirectory).isDirectory()) {
  fail(`feature directory not found: ${featureRef}`);
}

const markerPath = path.join(featureDirectory, "external-build.json");
if (!fs.existsSync(markerPath)) {
  console.log("pre-release-content-scan: not-applicable");
  process.exit(0);
}

let marker;
try {
  marker = JSON.parse(fs.readFileSync(markerPath, "utf8"));
} catch (error) {
  fail(`external-build.json is not JSON: ${error.message}`);
}
if (!marker || marker.declared !== true) {
  console.log("pre-release-content-scan: not-applicable");
  process.exit(0);
}

const renderedPath = containedFile(featureDirectory, marker.renderedEvidence);
if (!renderedPath) fail("external build is declared without a feature-local renderedEvidence path", 3);
if (!fs.existsSync(renderedPath) || !fs.statSync(renderedPath).isFile()) {
  fail("external build is declared but rendered evidence is missing", 3);
}
const rendered = fs.readFileSync(renderedPath, "utf8");
if (!rendered.trim()) fail("external build is declared but rendered evidence is empty", 3);

const hits = [];
const lowered = rendered.toLowerCase();
for (const phrase of PLANNING_PHRASES) {
  if (lowered.includes(phrase)) hits.push(phrase);
}
const language = outputLanguage(root);
const mismatch = languageMismatch(rendered, language);
if (mismatch) hits.push(mismatch);

if (hits.length === 0) {
  console.log("pre-release-content-scan: passed");
  process.exit(0);
}

const exception = typeof marker.exception === "string" ? marker.exception.trim() : "";
if (exception.length >= 8) {
  console.log(`pre-release-content-scan: exception-recorded ${hits.join("; ")}`);
  process.exit(0);
}

fail(hits.join("; "));
