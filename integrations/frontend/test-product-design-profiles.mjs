#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import {
  compileProductDesignBrief,
  compileProductDesignDecision,
  createAssetAcquisitionRequest,
  deriveAssetFailureDisposition,
  deriveAssetRequirements,
  deriveProductDesignProfile,
  deriveProductDesignShadowComparison,
  evaluateProductDesignReadiness,
  ingestProductAsset,
  selectProductAssetCandidate,
  validateVisualResearch
} from "./product-design-control.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(fs.readFileSync(path.join(scriptDirectory, "fixtures/product-design/profiles.json"), "utf8"));
const subject = { project: "profile-fixture", commit: "c".repeat(40) };
const policyDigest = "d".repeat(64);
const PNG_A = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
let assertions = 0;

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const name = Buffer.from(type, "ascii");
  const chunk = Buffer.alloc(data.length + 12);
  chunk.writeUInt32BE(data.length, 0);
  name.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([name, data])), data.length + 8);
  return chunk;
}

function rgbaPixel(red, green, blue) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0);
  header.writeUInt32BE(1, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", zlib.deflateSync(Buffer.from([0, red, green, blue, 255]))),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

const PNG_B = rgbaPixel(180, 80, 40);

function reference(index, category) {
  const origin = ["official", "domain", "material"][index % 3];
  return { id: `REF-${index + 1}`, queryId: "Q-1", url: `https://${origin}.example/ref-${index + 1}`, origin, accessedAt: "2026-08-26",
    usage: "reference-only", category, taskObserved: "concluir a tarefa dominante", usefulPatterns: ["hierarquia orientada à tarefa"], antiPatterns: ["decoração genérica"],
    adoptedAspects: ["foco contextual"], excludedAspects: ["layout e identidade literais"], templateRisk: "low",
    license: { status: "reference-only", retention: "metadata-only" }, affectedScreens: ["representative"], affectedDecisionIds: ["DD-1"] };
}

function candidate(id, score) {
  return { id, thesis: `${id} organiza sinais específicos do produto ao redor da tarefa dominante e da confiança exigida.`, signatureElement: `${id}-context-rail`,
    contextuality: { productSignals: ["product evidence"], audienceSignals: ["primary audience"], taskSignals: ["dominant task"] },
    criteria: [
      { id: "task", weight: 4, score, rationale: "Prioriza a tarefa dominante do produto." },
      { id: "trust", weight: 3, score, rationale: "Preserva confiança e leitura verificável." },
      { id: "specificity", weight: 2, score, rationale: "Evita uma composição intercambiável." }
    ], risks: [{ id: "density", mitigation: "Disclosure progressivo mantém a leitura." }], evidenceRefs: ["research.json", `${id}-comparison.json`],
    adoptedAspects: ["context rail"], excludedAspects: ["generic card grid"], rationale: `${id} é a direção mais coerente com produto, público e tarefa.`,
    canonicalContractMatch: true, contractRefs: ["07-design.md"], precedentMatch: false, precedentRefs: [], changeSize: 3, complexity: 3, riskSurface: 2, reversible: true, equivalenceEvidenceRefs: [] };
}

function buildPipeline(profileFixture) {
  const input = { ...profileFixture, subject, audience: { primary: "operador responsável" }, task: { dominant: "concluir decisão com evidência" },
    content: { representativeCopy: ["Revise a evidência"], claims: [{ id: "CLAIM-1", text: "Decisão rastreável", sourceRef: "REQ-1" }] },
    states: ["ready", "error"], userEvidence: [{ id: "UE-1", grade: "proxy", statement: "Fluxo existente mostra revisão antes da decisão." }] };
  const compiled = compileProductDesignBrief(input);
  assert.deepEqual(compiled.findings, [], `${profileFixture.id}: brief must pass.`);
  const plan = compiled.researchPlan;
  const count = plan.minimumReferences;
  const categories = plan.requiredCategories.length > 0 ? plan.requiredCategories : ["real-product"];
  const references = Array.from({ length: count }, (_, index) => reference(index, categories[index % categories.length]));
  const researched = validateVisualResearch({ subject, briefDigest: compiled.brief.semanticDigest, intensity: plan.intensity,
    minimumReferences: plan.minimumReferences, minimumOrigins: plan.minimumOrigins, requiredCategories: plan.requiredCategories,
    queries: count > 0 ? [{ id: "Q-1", query: "task-specific research", objective: "contextual hierarchy" }] : [], references, rejectedCandidates: [], network: { mode: "fixture", status: "passed" } });
  assert.deepEqual(researched.findings, [], `${profileFixture.id}: research must pass.`);
  const direction = compileProductDesignDecision({ subject, feature: profileFixture.feature, task: "T-PROFILE", stage: "implementation", effectivePolicyRef: "effective-policy.json", humanGateRequired: false,
    brief: compiled.brief, research: researched.research, candidates: [candidate("contextual", 9), candidate("alternative", 7)],
    evidence: [{ source: "approved-product-context", ref: "brief.json" }, { source: "visual-research", ref: "research.json" }, { source: "candidate-comparison", ref: "comparison.json" }] },
  { decisionId: "DEC-0123456789ABCDEF", decisionClass: "design-authority-bounded", disposition: "AUTONOMOUS_WITH_AUDIT", selectedOption: "contextual", reversible: true,
    evidenceRefs: ["brief.json", "research.json", "comparison.json"], policyProvenance: { autonomyPolicy: { ref: "autonomy-policy.json", sha256: policyDigest }, effectivePolicy: { ref: "effective-policy.json", sha256: policyDigest } } });
  assert.deepEqual(direction.findings, [], `${profileFixture.id}: agent direction decision must pass.`);
  return { compiled, researched, direction };
}

const pipelines = new Map();
for (const profileFixture of fixture.profiles) {
  const derived = deriveProductDesignProfile({ ...profileFixture, subject });
  assert.equal(derived.researchPlan.intensity, profileFixture.expectedIntensity, `${profileFixture.id}: derived intensity mismatch.`);
  assertions += 1;
  const pipeline = buildPipeline(profileFixture);
  const gated = evaluateProductDesignReadiness({ subject, brief: pipeline.compiled.brief, research: pipeline.researched.research, decision: pipeline.direction.decision, policyDigest });
  assert.equal(gated.readiness.status, "passed", `${profileFixture.id}: product design readiness must pass.`);
  assert.equal(gated.readiness.visualDirectionSelectedBy, "agent", `${profileFixture.id}: direction owner must remain agent.`);
  assertions += 4;
  pipelines.set(profileFixture.id, pipeline);
}

const shadow = deriveProductDesignShadowComparison({ subject,
  legacy: { decisionKind: "probe-selection", decisionOwner: "human" },
  controller: { visualDirectionSelectedBy: "agent", autonomyClass: "design-authority-bounded", disposition: "AUTONOMOUS_WITH_AUDIT" } });
assert.equal(shadow.status, "passed");
assert.equal(shadow.delta, "legacy-human-aesthetic-gate-replaced-by-agent-audited-decision");
assert.deepEqual(shadow.rollout, { authority: "shadow", research: "shadow", assets: "shadow", "human-scope": "shadow" });
assertions += 3;

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "pda-human-asset-profile-"));
try {
  const pipeline = pipelines.get("human-asset");
  const requirements = deriveAssetRequirements({ subject, briefDigest: pipeline.compiled.brief.semanticDigest, decisionDigest: pipeline.direction.decision.semanticDigest,
    assets: [{ id: "hero", function: "estabelecer contexto documental sem competir com a tarefa", essentiality: "expressive", equivalentAvailable: false, materialLossWithoutAsset: true, acceptance: { type: "illustration", aspectRatio: "1:1" } }] });
  const researchWithRejections = { ...pipeline.researched.research, rejectedCandidates: [{ assetId: "hero", candidateId: "open-1", reasonCode: "COMPOSITION_MISMATCH" }] };
  const request = createAssetAcquisitionRequest({ subject, assetId: "hero", attempt: 1, requirements: requirements.requirements, research: researchWithRejections,
    purpose: "estabelecer contexto documental", targetScreen: "entry", message: "documentos complexos podem ser controlados", type: "illustration", subjectDescription: "documentos organizados em camadas", environment: "editorial abstrato", action: "convergir para uma decisão", emotion: "confiança sóbria", realism: "editorial sem pessoas", composition: { aspectRatio: "1:1", focalPoint: "center" }, palette: { tokenRefs: ["surface.canvas"] }, requiredElements: ["documentos"], prohibitedElements: ["texto", "logos"], representationRisks: ["falsa associação"], generationConstraints: ["não gerar texto"], delivery: { minimumWidth: 1, minimumHeight: 1, formats: ["png"], maximumBytes: 100000 }, crops: [{ target: "mobile", aspectRatio: "1:1" }], positivePrompt: "ilustração editorial de documentos organizados em camadas", negativePrompt: "texto, logos, pessoas e marcas", recommendedVariations: 2, altTextIntent: "Documentos organizados", acceptanceChecklist: ["sem texto", "foco central"], expectedFileName: "hero.png", expectedDestination: "docs/frontend/assets/hero.png", rightsDeclarationRequired: true });
  assert.deepEqual(request.findings, []);
  const sidecars = [];
  for (const [id, bytes] of [["option-a", PNG_A], ["option-b", PNG_B]]) {
    const filePath = path.join(temp, `${id}.png`);
    fs.writeFileSync(filePath, bytes);
    const ingested = ingestProductAsset({ subject, filePath, request: { ...request.request, crops: [] }, rightsAttestation: { origin: "generated-by-user", rightToUse: true, attestedAt: "2026-08-26" }, license: { id: "CC0-1.0", sourceUrl: "https://example.com/attestation", verifiedAt: "2026-08-26" }, inspection: { provenance: "manual-reviewed-with-evidence", contentMatches: true, compositionMatches: true, visibleText: [], logos: [], persons: [], sensitiveMetadataDetected: [], altText: `Documentos organizados ${id}` } });
    assert.deepEqual(ingested.findings, [], `${id}: delivered option must ingest.`);
    sidecars.push(ingested.sidecar);
  }
  const selection = selectProductAssetCandidate({ subject, requestDigest: request.request.semanticDigest, candidates: [
    { id: "option-a", sidecarDigest: sidecars[0].semanticDigest, meaningPreserved: true, criteria: [{ id: "composition", weight: 4, score: 7, evidenceRef: "inspection-a" }, { id: "task", weight: 3, score: 7, evidenceRef: "screen-a" }, { id: "representation", weight: 3, score: 8, evidenceRef: "risk-a" }] },
    { id: "option-b", sidecarDigest: sidecars[1].semanticDigest, meaningPreserved: true, criteria: [{ id: "composition", weight: 4, score: 9, evidenceRef: "inspection-b" }, { id: "task", weight: 3, score: 9, evidenceRef: "screen-b" }, { id: "representation", weight: 3, score: 8, evidenceRef: "risk-b" }] }
  ] });
  assert.deepEqual(selection.findings, []);
  assert.equal(selection.selection.selectedCandidateId, "option-b");
  assert.equal(selection.selection.selectedBy, "agent");
  assert.equal(deriveAssetFailureDisposition({ attempt: 2, essentiality: "expressive" }), "recompose-without-asset");
  assertions += 7;
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

console.log(`Product design profile and shadow tests passed (${assertions} assertions).`);
