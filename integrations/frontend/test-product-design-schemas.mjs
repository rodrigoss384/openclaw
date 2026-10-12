#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const runtimeRequire = createRequire(path.join(ROOT, "skills/frontend-product-builder/package.json"));
const Ajv2020 = runtimeRequire("ajv/dist/2020");
const addFormats = runtimeRequire("ajv-formats");
const schema = JSON.parse(fs.readFileSync(path.join(ROOT, "integrations/frontend/product-design-control.schema.json"), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);
const digest = "a".repeat(64);
const subject = { project: "fixture", commit: "b".repeat(40) };
let assertions = 0;

function valid(value, message) {
  assertions += 1;
  assert.equal(validate(value), true, `${message}: ${ajv.errorsText(validate.errors)}`);
}

function invalid(value, message) {
  assertions += 1;
  assert.equal(validate(value), false, message);
}

const base = (artifactKind) => ({ artifactKind, schemaVersion: "1.0.0", semanticDigest: digest, subject });

valid({
  ...base("product-design-brief"),
  feature: "fixture",
  profileDigest: digest,
  researchPlanDigest: digest,
  product: { name: "Produto", maturity: "greenfield" },
  audience: { primary: "analista" },
  task: { dominant: "decidir" },
  context: { visitorMode: "Operate", emotional: "confiança" },
  content: { representativeCopy: ["Decidir"], claims: [] },
  states: ["ready", "error"],
  userEvidence: [{ id: "UE-1", grade: "hypothesis", statement: "Hipótese", validationPlan: "Validar" }],
  evidenceGaps: [],
  visualPreferenceQuestions: []
}, "Product Design Brief must validate");

valid({
  ...base("visual-research"),
  briefDigest: digest,
  intensity: "targeted-research",
  queries: [{ id: "Q-1", query: "autenticação jurídica com baixa distração", objective: "hierarquia" }],
  references: [{
    id: "REF-1", queryId: "Q-1", url: "https://example.com/reference", origin: "official-design-system",
    accessedAt: "2026-08-26", usage: "reference-only", category: "real-product", taskObserved: "autenticar",
    usefulPatterns: ["hierarquia"], antiPatterns: ["ruído"], adoptedAspects: ["foco"], excludedAspects: ["branding"],
    templateRisk: "low", license: { status: "reference-only", retention: "metadata-only" }, affectedScreens: ["login"], affectedDecisionIds: ["DD-1"]
  }],
  rejectedCandidates: [],
  coverage: { references: 3, origins: 2, categories: ["real-product"] },
  network: { mode: "fixture", status: "passed" }
}, "Visual Research must validate");

valid({
  ...base("design-authority-decision"), briefDigest: digest, researchDigest: digest,
  thesis: "Confiança operacional por hierarquia documental", signatureElement: "linha de decisão",
  alternatives: [{ id: "A", status: "selected", rationale: "mais específica" }, { id: "B", status: "rejected", rationale: "genérica" }],
  criteria: [
    { id: "specificity", weight: 3, score: 9, rationale: "Alinha a direção ao domínio." },
    { id: "accessibility", weight: 3, score: 9, rationale: "Preserva contraste e hierarquia." },
    { id: "task-fit", weight: 4, score: 8, rationale: "Prioriza a decisão dominante." }
  ],
  selectedCandidateId: "A", risks: [{ id: "density", mitigation: "Aplicar disclosure progressivo." }],
  evidenceRefs: ["REF-1", "BRIEF-1", "COMPARE-1"], adoptedAspects: ["foco"], excludedAspects: ["template"],
  visualDirectionSelectedBy: "agent", autonomyDecisionId: "DEC-0123456789ABCDEF",
  policyProvenance: { autonomyPolicy: { ref: "policy", sha256: digest }, effectivePolicy: { ref: "effective", sha256: digest } }
}, "Design decision must validate");

valid({
  ...base("asset-requirements"), briefDigest: digest, decisionDigest: digest,
  assets: [{ id: "hero", function: "estabelecer contexto", essentiality: "expressive", equivalentAvailable: false, materialLossWithoutAsset: true,
    acceptance: { type: "illustration", aspectRatio: "16:9", minimumWidth: 1600, minimumHeight: 900, maximumBytes: 1000000 } }]
}, "Asset requirements must validate");

valid({
  ...base("asset-acquisition-request"), assetId: "hero", attempt: 1, requirementsDigest: digest, researchDigest: digest,
  purpose: "contexto", targetScreen: "home", message: "controle e clareza", type: "illustration", subjectDescription: "documentos organizados",
  environment: "abstrato", action: "organização", emotion: "confiança", realism: "editorial", composition: { aspectRatio: "16:9", orientation: "landscape", focalPoint: "left", safeAreas: ["right"] },
  palette: { tokenRefs: ["surface.canvas"] }, requiredElements: ["documentos"], prohibitedElements: ["logos", "texto"], representationRisks: ["falsa associação"],
  generationConstraints: ["sem texto", "sem marcas"], delivery: { minimumWidth: 1600, minimumHeight: 900, formats: ["png"], transparency: false, maximumBytes: 1000000 },
  crops: [{ target: "mobile", aspectRatio: "4:5" }], positivePrompt: "ilustração editorial", negativePrompt: "texto, logos", recommendedVariations: 3,
  altTextIntent: "Documentos organizados", acceptanceChecklist: ["foco preservado"], expectedFileName: "hero.png", expectedDestination: "docs/frontend/assets/hero.png",
  rightsDeclarationRequired: true, rejectionReasonCodes: ["NO_RESULTS"]
}, "Asset acquisition request must validate");

valid({
  ...base("approved-product-asset"), assetId: "hero", requestDigest: digest, fileDigest: digest,
  mime: "image/png", width: 1600, height: 900, bytes: 250000,
  license: { id: "CC-BY-4.0", sourceUrl: "https://creativecommons.org/licenses/by/4.0/", verifiedAt: "2026-08-26" },
  rightsAttestation: { origin: "upstream", rightToUse: true, attestedAt: "2026-08-26" }, attribution: "Fixture Creator",
  variants: [{ id: "mobile", fileName: "hero.mobile.png", fileDigest: digest, mime: "image/png", width: 720, height: 900,
    crop: { x: 440, y: 0, width: 720, height: 900, aspectRatio: "4:5" }, meaningPreserved: true }],
  altText: "Documentos organizados", sensitiveMetadataRemoved: true
}, "Approved asset sidecar with a generated crop must validate");

valid({
  ...base("product-design-readiness"), briefDigest: digest, researchDigest: digest, decisionDigest: digest, assetDigests: [], policyDigest: digest,
  status: "passed", visualDirectionSelectedBy: "agent", blockingFindingIds: [], dependencyDigests: { product: digest, direction: digest, research: digest, policy: digest }
}, "Product Design Readiness must validate");

const invalidResearch = {
  ...base("visual-research"), briefDigest: digest, intensity: "targeted-research", queries: [], references: [{ id: "REF-1" }], rejectedCandidates: [], coverage: {}, network: {}
};
invalid(invalidResearch, "Reference without provenance must fail");

console.log(`Product design schemas passed (${assertions} assertions).`);
