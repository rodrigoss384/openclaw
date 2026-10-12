#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  validateFamilySemanticSignatures,
  validateOperationalSemanticEvidence
} from "./semantic-differentiation.mjs";

let assertions = 0;

const phaseSignature = {
  variantRole: "progress-step",
  semanticColorRole: "progress",
  shapeRole: "soft-square",
  textRole: "metadata"
};
const statusSignature = {
  variantRole: "state-pill",
  semanticColorRole: "success",
  shapeRole: "pill",
  textRole: "label"
};

function designSystem() {
  return {
    visualGrammar: {
      perceptualPolicy: {
        presentationRoles: {
          phase: { componentFamily: "PhaseBadge", consistency: "strict", presentationSignature: structuredClone(phaseSignature) },
          status: { componentFamily: "StatusBadge", consistency: "strict", presentationSignature: structuredClone(statusSignature) }
        },
        semanticDifferentiation: {
          roles: ["phase", "status"],
          minimumDistinctDimensions: 1,
          dimensions: ["variantRole", "semanticColorRole", "shapeRole", "textRole"],
          colorOnlyAllowed: false
        }
      }
    }
  };
}

function craft(screenId = "workflow-list") {
  return {
    screenId,
    dimensions: {
      semanticPresentation: {
        assignments: [
          {
            targetId: "workflow-phase",
            semanticRole: "phase",
            presentationSignature: structuredClone(phaseSignature)
          },
          {
            targetId: "workflow-status",
            semanticRole: "status",
            presentationSignature: structuredClone(statusSignature)
          }
        ]
      }
    }
  };
}

const validEvidence = {
  elements: [
    { componentUsageId: "workflow-phase", rendered: true, textRole: "metadata", semanticColorRole: "progress" },
    { componentUsageId: "workflow-status", rendered: true, textRole: "label", semanticColorRole: "success" }
  ]
};
assert.deepEqual(validateOperationalSemanticEvidence(designSystem(), craft(), validEvidence), []);
assertions += 1;

const collapsedEvidence = structuredClone(validEvidence);
collapsedEvidence.elements[0].textRole = "label";
const collapsedErrors = validateOperationalSemanticEvidence(designSystem(), craft(), collapsedEvidence);
assert.ok(collapsedErrors.some((error) => error.code === "CRAFT_EVIDENCE_SEMANTIC_SIGNATURE_DRIFT"));
assert.ok(collapsedErrors.some((error) => error.code === "CRAFT_EVIDENCE_CROSS_ROLE_COLLAPSE"));
assert.ok(collapsedErrors.some((error) => error.code === "CRAFT_EVIDENCE_COLOR_ONLY_DIFFERENTIATION"));
assertions += 3;

const sameRoleCraft = craft();
sameRoleCraft.dimensions.semanticPresentation.assignments.push({
  targetId: "workflow-status-secondary",
  semanticRole: "status",
  presentationSignature: structuredClone(statusSignature)
});
const sameRoleEvidence = structuredClone(validEvidence);
sameRoleEvidence.elements.push({
  componentUsageId: "workflow-status-secondary",
  rendered: true,
  textRole: "metadata",
  semanticColorRole: "success"
});
const sameRoleEvidenceErrors = validateOperationalSemanticEvidence(designSystem(), sameRoleCraft, sameRoleEvidence);
assert.ok(sameRoleEvidenceErrors.some((error) => error.code === "CRAFT_EVIDENCE_SAME_ROLE_SIGNATURE_DRIFT"));
assertions += 1;

const phaseScreen = {
  screenId: "phase-screen",
  dimensions: {
    semanticPresentation: {
      assignments: [{ targetId: "phase", semanticRole: "phase", presentationSignature: structuredClone(phaseSignature) }]
    }
  }
};
const statusScreen = {
  screenId: "status-screen",
  dimensions: {
    semanticPresentation: {
      assignments: [{ targetId: "status", semanticRole: "status", presentationSignature: structuredClone(statusSignature) }]
    }
  }
};
assert.deepEqual(validateFamilySemanticSignatures(designSystem(), [phaseScreen, statusScreen]), []);
assertions += 1;

const statusDrift = structuredClone(statusScreen);
statusDrift.screenId = "status-screen-drift";
statusDrift.dimensions.semanticPresentation.assignments[0].presentationSignature.shapeRole = "soft-square";
const familyDriftErrors = validateFamilySemanticSignatures(designSystem(), [phaseScreen, statusScreen, statusDrift]);
assert.ok(familyDriftErrors.some((error) => error.code === "SAME_ROLE_PRESENTATION_SIGNATURE_DRIFT"));
assertions += 1;

const crossRoleCollapse = structuredClone(phaseScreen);
crossRoleCollapse.dimensions.semanticPresentation.assignments[0].presentationSignature = structuredClone(statusSignature);
const familyCollapseErrors = validateFamilySemanticSignatures(designSystem(), [crossRoleCollapse, statusScreen]);
assert.ok(familyCollapseErrors.some((error) => error.code === "CROSS_ROLE_PRESENTATION_COLLAPSE"));
assertions += 1;

const colorOnlyPhase = structuredClone(statusSignature);
colorOnlyPhase.semanticColorRole = "progress";
const colorOnlyScreen = structuredClone(phaseScreen);
colorOnlyScreen.dimensions.semanticPresentation.assignments[0].presentationSignature = colorOnlyPhase;
const familyColorOnlyErrors = validateFamilySemanticSignatures(designSystem(), [colorOnlyScreen, statusScreen]);
assert.ok(familyColorOnlyErrors.some((error) => error.code === "CROSS_ROLE_COLOR_ONLY_DIFFERENTIATION"));
assertions += 1;

console.log(`Cross-role semantic runtime Phase 10A regression suite passed (${assertions} assertions).`);
