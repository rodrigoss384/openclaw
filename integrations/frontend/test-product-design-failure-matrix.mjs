#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  compileProductDesignBrief,
  compileProductDesignDecision,
  createAssetAcquisitionRequest,
  deriveAssetRequirements,
  ingestProductAsset,
  validateVisualResearch
} from "./product-design-control.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const matrix = JSON.parse(fs.readFileSync(path.join(scriptDirectory, "fixtures/product-design/failure-matrix.json"), "utf8"));
const digest = "a".repeat(64);
const subject = { project: "fixture", commit: "b".repeat(40) };
const PNG_1X1 = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
let assertions = 0;

function briefBase() {
  return {
    subject, feature: "fixture", product: { name: "Evidence Control", maturity: "greenfield" }, audience: { primary: "audit operator" },
    task: { dominant: "verify evidence before resolving a finding" }, changeMode: "new-direction", openCapabilities: ["open-web", "openverse"],
    context: { visitorMode: "Operate", emotional: "confiança", risk: "standard", consequentialAreas: [] },
    content: { representativeCopy: ["Verifique a evidência"], claims: [{ id: "CLAIM-1", text: "Retém trilha auditável", sourceRef: "REQ-1" }] },
    states: ["ready", "error"], userEvidence: [{ id: "UE-1", grade: "observed", statement: "Operadores verificam a evidência antes da decisão." }], questions: []
  };
}

function reference(id, origin) {
  return {
    id, queryId: "Q-1", url: `https://${origin}.example/${id}`, origin, accessedAt: "2026-08-26", usage: "reference-only",
    category: "real-product", taskObserved: "verificar evidência", usefulPatterns: ["evidência junto à ação"], antiPatterns: ["métrica decorativa"],
    adoptedAspects: ["proximidade"], excludedAspects: ["layout literal"], templateRisk: "low",
    license: { status: "reference-only", retention: "metadata-only" }, affectedScreens: ["review"], affectedDecisionIds: ["DD-1"]
  };
}

function researchBase() {
  return { subject, briefDigest: digest, intensity: "targeted-research", minimumReferences: 3, minimumOrigins: 2, queries: [],
    references: [reference("REF-1", "official"), reference("REF-2", "domain"), reference("REF-3", "domain")], rejectedCandidates: [], network: { mode: "fixture", status: "passed" } };
}

function candidate(id) {
  return {
    id, thesis: `${id} organiza evidência operacional ao redor da tarefa dominante de verificação.`, signatureElement: `${id}-evidence-rail`,
    contextuality: { productSignals: ["audit trail"], audienceSignals: ["operadores de revisão"], taskSignals: ["verificar antes de decidir"] },
    criteria: [
      { id: "task", weight: 4, score: 9, rationale: "Prioriza a sequência dominante de verificação." },
      { id: "trust", weight: 3, score: 8, rationale: "Mantém a evidência junto da decisão." },
      { id: "specificity", weight: 2, score: 8, rationale: "Usa uma assinatura específica do produto." }
    ],
    risks: [{ id: "density", mitigation: "Disclosure progressivo preserva leitura." }], evidenceRefs: ["visual-research.json", `${id}-comparison.json`],
    adoptedAspects: ["evidence rail"], excludedAspects: ["card grid genérico"], rationale: `${id} equilibra tarefa, confiança e especificidade.`,
    canonicalContractMatch: true, contractRefs: ["07-design.md"], precedentMatch: false, precedentRefs: [], changeSize: 3, complexity: 3, riskSurface: 2, reversible: true, equivalenceEvidenceRefs: []
  };
}

function decisionBase() {
  return {
    input: { subject, feature: "fixture", task: "T-1", stage: "implementation", effectivePolicyRef: "effective-policy.json", humanGateRequired: false,
      brief: { semanticDigest: "1".repeat(64) }, research: { semanticDigest: "2".repeat(64) }, candidates: [candidate("contextual"), candidate("alternative")],
      evidence: [{ source: "approved-product-context", ref: "brief.json" }, { source: "visual-research", ref: "research.json" }, { source: "candidate-comparison", ref: "comparison.json" }] },
    autonomy: { decisionId: "DEC-0123456789ABCDEF", decisionClass: "design-authority-bounded", disposition: "AUTONOMOUS_WITH_AUDIT", selectedOption: "contextual", reversible: true,
      evidenceRefs: ["brief.json", "research.json", "comparison.json"], policyProvenance: { autonomyPolicy: { ref: "autonomy-policy.json", sha256: "3".repeat(64) }, effectivePolicy: { ref: "effective-policy.json", sha256: "4".repeat(64) } } }
  };
}

function assetRequestBase() {
  const requirements = deriveAssetRequirements({ subject, briefDigest: digest, decisionDigest: digest, assets: [{ id: "hero", function: "estabelecer contexto documental", essentiality: "expressive", equivalentAvailable: false, materialLossWithoutAsset: true, acceptance: { type: "illustration", aspectRatio: "1:1" } }] }).requirements;
  return { subject, assetId: "hero", attempt: 1, requirements, research: { semanticDigest: digest, network: { mode: "fixture", status: "passed" }, rejectedCandidates: [{ assetId: "hero", candidateId: "C-1", reasonCode: "COMPOSITION_MISMATCH" }] },
    purpose: "estabelecer contexto documental", targetScreen: "home", message: "documentos complexos podem ser controlados", type: "illustration", subjectDescription: "documentos em camadas", environment: "editorial abstrato", action: "convergir para decisão", emotion: "confiança sóbria", realism: "editorial sem pessoas", composition: { aspectRatio: "1:1", focalPoint: "center" }, palette: { tokenRefs: ["surface.canvas"] }, requiredElements: ["documentos"], prohibitedElements: ["texto", "logos"], representationRisks: ["falsa associação"], generationConstraints: ["não gerar texto"], delivery: { minimumWidth: 1, minimumHeight: 1, formats: ["png"], transparency: true, maximumBytes: 100000 }, crops: [{ target: "mobile", aspectRatio: "1:1" }], positivePrompt: "ilustração editorial de documentos organizados em camadas", negativePrompt: "texto, logos, pessoas, marcas", recommendedVariations: 3, altTextIntent: "Documentos organizados", acceptanceChecklist: ["sem texto"], expectedFileName: "hero.png", expectedDestination: "docs/frontend/assets/hero.png", rightsDeclarationRequired: true };
}

function ingestBase(filePath) {
  return { subject, filePath, request: { semanticDigest: digest, assetId: "hero", attempt: 1, composition: { aspectRatio: "1:1" }, delivery: { minimumWidth: 1, minimumHeight: 1, formats: ["png"], maximumBytes: 100000 }, crops: [], altTextIntent: "Documentos organizados" },
    rightsAttestation: { origin: "generated-by-user", rightToUse: true, attestedAt: "2026-08-26" }, license: { id: "CC0-1.0", sourceUrl: "https://example.com/attestation", verifiedAt: "2026-08-26" },
    inspection: { provenance: "browser-derived", contentMatches: true, compositionMatches: true, visibleText: [], logos: [], persons: [], sensitiveMetadataDetected: [], altText: "Documentos organizados" } };
}

function ids(result) {
  return [...new Set((result.findings ?? []).map((item) => item.id))];
}

function runBrief(scenario) {
  const input = briefBase();
  if (scenario === "missing-task") delete input.task;
  if (scenario === "missing-audience") delete input.audience;
  if (scenario === "visual-question") input.questions = [{ kind: "visual-preference", text: "Qual layout você prefere?" }];
  if (scenario === "preference-phrase") input.questions = [{ kind: "open", text: "Qual cor visual você prefere?" }];
  if (scenario === "claim-without-source") delete input.content.claims[0].sourceRef;
  if (scenario === "testimonial-without-source") input.content.claims = [{ id: "TEST-1", text: "Clientes confiam mais" }];
  if (scenario === "critical-hypothesis-only") { input.context.risk = "critical"; input.userEvidence = [{ id: "UE-1", grade: "hypothesis", statement: "Hipótese", validationPlan: "Entrevistar antes da release" }]; }
  if (scenario === "observed-critical-evidence") input.context.risk = "critical";
  if (scenario === "hypothesis-without-plan") input.userEvidence = [{ id: "UE-1", grade: "hypothesis", statement: "Hipótese" }];
  return compileProductDesignBrief(input);
}

function runResearch(scenario) {
  const input = researchBase();
  if (scenario === "one-reference") input.references = input.references.slice(0, 1);
  if (scenario === "one-origin") input.references.forEach((item) => { item.origin = "same"; });
  if (scenario === "missing-origin-url") delete input.references[0].url;
  if (scenario === "missing-access-date") delete input.references[0].accessedAt;
  if (scenario === "copied-implementation") input.references[0].implementationDisposition = "copied";
  if (scenario === "mirrored-library") input.references[0].retention = "mirrored-library";
  if (["unverified-production-license", "verified-production-license", "share-alike-license"].includes(scenario)) {
    input.references[0].usage = "production-candidate";
    input.references[0].license = { id: scenario === "share-alike-license" ? "CC-BY-SA-4.0" : "CC-BY-4.0", sourceUrl: "https://example.com/license", verifiedAt: "2026-08-26", retention: "asset-and-metadata" };
    if (scenario === "unverified-production-license") delete input.references[0].license.sourceUrl;
  }
  return validateVisualResearch(input);
}

function runDecision(scenario) {
  const fixture = decisionBase();
  if (scenario === "missing-thesis") fixture.input.candidates[0].thesis = "";
  if (scenario === "missing-comparison-evidence") { fixture.input.candidates[0].evidenceRefs = []; fixture.autonomy.evidenceRefs = []; }
  if (scenario === "generic-context") fixture.input.candidates[0].contextuality = { productSignals: [], audienceSignals: [], taskSignals: [] };
  if (scenario === "missing-task-context") fixture.input.candidates[0].contextuality.taskSignals = [];
  if (scenario === "human-visual-selection") Object.assign(fixture.autonomy, { decisionClass: "brand-consequential", disposition: "HUMAN_REQUIRED", selectedOption: null, reversible: null });
  if (scenario === "wrong-autonomy-class") fixture.autonomy.decisionClass = "reversible-implementation";
  return compileProductDesignDecision(fixture.input, fixture.autonomy);
}

function runAssetRequest(scenario) {
  const input = assetRequestBase();
  if (scenario === "vague-request") { input.purpose = "imagem bonita"; input.message = "algo bacana"; input.positivePrompt = "imagem bacana"; input.acceptanceChecklist = []; }
  if (scenario === "equivalent-exists") input.requirements.assets[0].equivalentAvailable = true;
  return createAssetAcquisitionRequest(input);
}

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "pda-matrix-"));
try {
  const imagePath = path.join(temp, "hero.png");
  fs.writeFileSync(imagePath, PNG_1X1);
  function runAssetIngest(scenario) {
    const input = ingestBase(imagePath);
    if (scenario === "dimension-mismatch") input.request.delivery.minimumWidth = 2;
    if (scenario === "sensitive-metadata") input.inspection.sensitiveMetadataDetected = ["GPS"];
    return ingestProductAsset(input);
  }
  const runners = { brief: runBrief, research: runResearch, decision: runDecision, "asset-request": runAssetRequest, "asset-ingest": runAssetIngest };
  assert.deepEqual(matrix.cases.map((item) => item.id), Array.from({ length: 13 }, (_, index) => `PDA-${String(index + 1).padStart(2, "0")}`));
  assertions += 1;
  for (const testCase of matrix.cases) {
    const run = runners[testCase.runner];
    assert.ok(ids(run(testCase.invalid)).includes(testCase.id), `${testCase.id}: negative fixture did not produce its stable finding.`);
    assert.ok(!ids(run(testCase.valid)).includes(testCase.id), `${testCase.id}: positive fixture still produced its stable finding.`);
    assert.ok(ids(run(testCase.mutation)).includes(testCase.id), `${testCase.id}: mutation did not preserve its stable finding.`);
    assertions += 3;
  }
  console.log(`Product Design Authority failure matrix passed (${assertions} assertions across 39 fixtures).`);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
