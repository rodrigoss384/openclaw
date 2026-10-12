#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import {
  projectVisualCompositionEvidenceV2,
  projectVisualQualityScorecardV2,
  resolveVisualArtifactAuthority
} from "../../../integrations/frontend/ui-engineering-control.mjs";

let assertions = 0;
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const schemaDirectory = path.resolve(scriptDirectory, "../assets/schemas");
function equal(actual, expected, message) {
  assertions += 1;
  assert.deepEqual(actual, expected, message);
}

equal(resolveVisualArtifactAuthority({ schemaVersion: "1.4.0" }, "shadow"), "shadow", "v1 is readable in shadow.");
equal(resolveVisualArtifactAuthority({ schemaVersion: "1.4.0" }, "primary"), "rejected", "v1 cannot release a primary gate.");
equal(resolveVisualArtifactAuthority({ schemaVersion: "2.0.0", generatedFrom: { gateDigest: "a".repeat(64) } }, "primary"), "primary", "Generated v2 can be primary.");
equal(resolveVisualArtifactAuthority({ schemaVersion: "2.0.0" }, "primary"), "rejected", "Hand-authored-looking v2 cannot be primary.");

const findings = [{ id: "UI-01", severity: "P1", source: "objective", message: "orphan grid" }];
const gate = { semanticDigest: "a".repeat(64), eligible: false, blockingFindingIds: ["UI-01"] };
const composition = projectVisualCompositionEvidenceV2({ findings, gate });
const scorecard = projectVisualQualityScorecardV2({ findings, gate });
const ajv = new Ajv2020({ allErrors: true, strict: false });
const compositionSchema = JSON.parse(fs.readFileSync(path.join(schemaDirectory, "visual-composition-evidence.v2.schema.json"), "utf8"));
const scorecardSchema = JSON.parse(fs.readFileSync(path.join(schemaDirectory, "visual-quality-scorecard.v2.schema.json"), "utf8"));

equal(composition.schemaVersion, "2.0.0", "Composition evidence projection must be v2.");
equal(scorecard.schemaVersion, "2.0.0", "Scorecard projection must be v2.");
assert.ok(!JSON.stringify(composition).includes('"material"'), "Composition v2 must not expose editable materiality.");
assert.ok(!JSON.stringify(composition).includes('"blocking"'), "Composition v2 must not expose editable blocking.");
assert.ok(!JSON.stringify(scorecard).includes('"passed"'), "Scorecard v2 must not expose editable passed.");
assert.ok(!JSON.stringify(scorecard).includes('"blocking"'), "Scorecard v2 must not expose editable blocking.");
assertions += 4;
equal(scorecard.generatedFrom.gateDigest, gate.semanticDigest, "Projection must be bound to the objective gate.");
equal(ajv.validate(compositionSchema, composition), true, `Composition v2 schema failed: ${ajv.errorsText(ajv.errors)}`);
equal(ajv.validate(scorecardSchema, scorecard), true, `Scorecard v2 schema failed: ${ajv.errorsText(ajv.errors)}`);

console.log(`UI evidence v2 tests passed (${assertions} assertions).`);
