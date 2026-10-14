#!/usr/bin/env node
import assert from "node:assert/strict";
import { validateVisualResearch } from "./product-design-control.mjs";

const digest = "a".repeat(64);
const subject = { project: "fixture", commit: "b".repeat(40) };
let assertions = 0;

function equal(actual, expected, message) {
  assertions += 1;
  assert.deepEqual(actual, expected, message);
}

function findingIds(value) {
  return [...new Set(value.findings.map((finding) => finding.id))].sort();
}

function reference(id, origin, category = "real-product") {
  return {
    id,
    queryId: "Q-1",
    url: `https://${origin}.example/${id}`,
    origin,
    accessedAt: "2026-08-26",
    usage: "reference-only",
    category,
    taskObserved: "priorizar um item jurídico",
    usefulPatterns: ["hierarquia de decisão"],
    antiPatterns: ["ruído decorativo"],
    adoptedAspects: ["foco no próximo passo"],
    excludedAspects: ["branding e layout literal"],
    templateRisk: "low",
    license: { status: "reference-only", retention: "metadata-only" },
    affectedScreens: ["dashboard"],
    affectedDecisionIds: ["DD-1"]
  };
}

function targeted() {
  return {
    subject,
    briefDigest: digest,
    intensity: "targeted-research",
    minimumReferences: 3,
    minimumOrigins: 2,
    requiredCategories: [],
    queries: [{ id: "Q-1", query: "priorização jurídica com confiança", objective: "hierarquia" }],
    references: [reference("REF-1", "official"), reference("REF-2", "domain"), reference("REF-3", "domain")],
    rejectedCandidates: [],
    network: { mode: "fixture", status: "passed" }
  };
}

const valid = validateVisualResearch(targeted());
equal(valid.findings, [], "Targeted research with three references and two origins must pass.");
equal(valid.research.coverage.references, 3, "Coverage must be derived from references.");
equal(valid.research.coverage.origins, 2, "Coverage must count unique origins.");

const insufficient = targeted();
insufficient.references = insufficient.references.slice(0, 1);
equal(findingIds(validateVisualResearch(insufficient)), ["PDA-05"], "Insufficient research must fail with PDA-05.");

const missingProvenance = targeted();
delete missingProvenance.references[0].url;
delete missingProvenance.references[0].excludedAspects;
equal(findingIds(validateVisualResearch(missingProvenance)), ["PDA-06"], "Missing provenance or exclusions must fail with PDA-06.");

const copied = targeted();
copied.references[0].implementationDisposition = "copied";
equal(findingIds(validateVisualResearch(copied)), ["PDA-07"], "Copied reference implementation must fail with PDA-07.");

const production = targeted();
production.references[0].usage = "production-candidate";
production.references[0].origin = "openverse";
production.references[0].license = { id: "CC-BY-4.0", sourceUrl: "https://origin.example/license", verifiedAt: "2026-08-26", retention: "asset-and-metadata" };
equal(validateVisualResearch(production).findings, [], "Allowlisted production asset verified at origin must pass.");

delete production.references[0].license.sourceUrl;
equal(findingIds(validateVisualResearch(production)), ["PDA-08"], "Openverse without source license verification must fail with PDA-08.");
equal(validateVisualResearch(production).findings[0].decisionClass, "legal-consequential", "Unverified production licensing must route to legal-consequential authority.");

const font = targeted();
font.references[0].usage = "production-candidate";
font.references[0].origin = "fontsource";
font.references[0].license = { id: "OFL-1.1", verifiedAt: "2026-08-26", retention: "font-files-and-metadata" };
equal(findingIds(validateVisualResearch(font)), ["PDA-08"], "A Fontsource family without its individual origin-license URL must fail.");

const expanded = targeted();
expanded.intensity = "expanded-research";
expanded.minimumReferences = 5;
expanded.minimumOrigins = 3;
expanded.requiredCategories = ["real-product", "domain-reference", "material-or-asset"];
expanded.references = [
  reference("REF-1", "product", "real-product"),
  reference("REF-2", "domain", "domain-reference"),
  reference("REF-3", "material", "material-or-asset"),
  reference("REF-4", "product", "real-product"),
  reference("REF-5", "domain", "domain-reference")
];
equal(validateVisualResearch(expanded).findings, [], "Expanded research with all categories must pass.");

console.log(`Product design research tests passed (${assertions} assertions).`);
