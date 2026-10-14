#!/usr/bin/env node
import assert from "node:assert/strict";
import { createAssetAcquisitionRequest, deriveAssetRequirements } from "./product-design-control.mjs";

const digest = "a".repeat(64);
const subject = { project: "fixture", commit: "b".repeat(40) };
let assertions = 0;

function equal(actual, expected, message) {
  assertions += 1;
  assert.deepEqual(actual, expected, message);
}

function findingIds(result) {
  return [...new Set(result.findings.map((finding) => finding.id))].sort();
}

const requirements = deriveAssetRequirements({
  subject,
  briefDigest: digest,
  decisionDigest: digest,
  assets: [{
    id: "hero",
    function: "estabelecer o contexto documental sem competir com a tarefa",
    essentiality: "expressive",
    equivalentAvailable: false,
    materialLossWithoutAsset: true,
    acceptance: { type: "illustration", aspectRatio: "16:9", minimumWidth: 1600, minimumHeight: 900, maximumBytes: 1000000 }
  }]
});
equal(requirements.findings, [], "Functional asset requirements must pass.");

const requestInput = {
  subject,
  assetId: "hero",
  attempt: 1,
  requirements: requirements.requirements,
  research: {
    semanticDigest: digest,
    network: { mode: "fixture", status: "passed" },
    rejectedCandidates: [{ assetId: "hero", candidateId: "candidate-1", reasonCode: "COMPOSITION_MISMATCH" }]
  },
  purpose: "estabelecer contexto no produto",
  targetScreen: "home",
  message: "documentos complexos podem ser controlados com clareza",
  type: "illustration",
  subjectDescription: "conjunto de documentos organizados em camadas",
  environment: "abstrato editorial",
  action: "documentos convergem para uma decisão",
  emotion: "confiança sóbria",
  realism: "editorial sem pessoas",
  composition: { aspectRatio: "16:9", orientation: "landscape", focalPoint: "left", safeAreas: ["right"] },
  palette: { tokenRefs: ["surface.canvas", "accent.primary"] },
  requiredElements: ["documentos", "linha de decisão"],
  prohibitedElements: ["texto", "logos", "marcas"],
  representationRisks: ["falsa associação com órgão público"],
  generationConstraints: ["não gerar texto", "não gerar logos"],
  delivery: { minimumWidth: 1600, minimumHeight: 900, formats: ["png"], transparency: false, maximumBytes: 1000000 },
  crops: [{ target: "mobile", aspectRatio: "4:5" }],
  positivePrompt: "ilustração editorial de documentos organizados, composição sóbria",
  negativePrompt: "texto, logos, marcas, pessoas, interface copiada",
  recommendedVariations: 3,
  altTextIntent: "Documentos organizados convergem para uma decisão",
  acceptanceChecklist: ["focal point à esquerda", "safe area à direita", "sem texto"],
  expectedFileName: "hero.png",
  expectedDestination: "docs/frontend/assets/hero.png",
  rightsDeclarationRequired: true
};

const request = createAssetAcquisitionRequest(requestInput);
equal(request.findings, [], "A justified executable asset request must pass.");
equal(request.request.rejectionReasonCodes, ["COMPOSITION_MISMATCH"], "Structured rejections must be retained.");

const vague = { ...requestInput, purpose: "imagem bonita", message: "algo bacana", positivePrompt: "imagem bacana", acceptanceChecklist: [] };
equal(findingIds(createAssetAcquisitionRequest(vague)), ["PDA-09"], "A vague request must fail with PDA-09.");

const equivalent = structuredClone(requestInput);
equivalent.requirements.assets[0].equivalentAvailable = true;
equal(findingIds(createAssetAcquisitionRequest(equivalent)), ["PDA-09"], "An available equivalent must prevent human fallback.");

const noSearch = structuredClone(requestInput);
noSearch.research.network = { mode: "live", status: "not-run" };
delete noSearch.research.network.attemptedCommand;
equal(findingIds(createAssetAcquisitionRequest(noSearch)), ["PDA-09"], "Unproved not-run research must prevent human fallback.");

console.log(`Product design asset request tests passed (${assertions} assertions).`);
