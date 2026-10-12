#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeOpenResearchAdapters, validateVisualResearch } from "./product-design-control.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(fs.readFileSync(path.join(scriptDirectory, "fixtures/product-design/open-research-adapters.json"), "utf8"));
const subject = { project: "fixture", commit: "b".repeat(40) };
let assertions = 0;

function equal(actual, expected, message) {
  assertions += 1;
  assert.deepEqual(actual, expected, message);
}

const normalized = normalizeOpenResearchAdapters(fixture.adapterRuns);
equal(normalized.findings, [], "Deterministic open-web and Openverse adapter fixtures must normalize without findings.");
equal(normalized.references.length, 3, "Both adapters must contribute normalized references.");
equal(normalized.references[2].url, "https://commons.example.edu/work/ov-image-1", "Openverse provenance must retain the upstream landing page, not just the media URL.");
equal(normalized.references[2].license.id, "CC-BY-4.0", "Openverse license/version fields must normalize to the automatic allowlist ID.");
equal(normalized.references[2].license.sourceUrl, "https://creativecommons.org/licenses/by/4.0/", "Origin license URL must remain explicit.");
equal(normalized.network.adapters.map((adapter) => adapter.adapter), ["open-web", "openverse"], "Network evidence must retain adapter identity.");
assertions += 1;

const research = validateVisualResearch({
  subject,
  briefDigest: "a".repeat(64),
  intensity: "targeted-research",
  minimumReferences: 3,
  minimumOrigins: 2,
  queries: [
    { id: "Q-WEB", query: "autenticação jurídica com confiança e baixa distração", objective: "hierarquia" },
    { id: "Q-ASSET", query: "organized legal documents", objective: "asset discovery" }
  ],
  adapterRuns: fixture.adapterRuns,
  references: [],
  rejectedCandidates: []
});
equal(research.findings, [], "Normalized adapter output must pass the normal research contract.");
equal(research.research.network.mode, "adapter-fixture", "CI adapter execution must remain deterministic and network-independent.");
equal(research.research.coverage.references, 3, "Adapter references must count toward coverage.");

const invalidRuns = structuredClone(fixture.adapterRuns);
delete invalidRuns[1].results[0].foreign_landing_url;
delete invalidRuns[1].results[0].license_url;
const invalid = normalizeOpenResearchAdapters(invalidRuns);
equal([...new Set(invalid.findings.map((finding) => finding.id))].sort(), ["PDA-06", "PDA-08"], "Openverse without origin and origin-license verification must fail closed.");

console.log(`Product design research adapter tests passed (${assertions} assertions).`);
