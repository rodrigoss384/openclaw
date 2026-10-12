#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateBackendGovernanceHardening } from "./lib/backend-governance-hardening.mjs";
import { validateManifest } from "./lib/backend-package.mjs";

const scripts = path.dirname(fileURLToPath(import.meta.url));
const templatePath = path.resolve(scripts, "../assets/backend-change-manifest.template.json");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "backend-technology-selection-"));
let assertions = 0;

function manifest() {
  return JSON.parse(fs.readFileSync(templatePath, "utf8").replaceAll("FEATURE_SLUG", "technology-selection"));
}

function validate(candidate) {
  return [
    ...validateManifest(candidate, root, { checkFiles: false }).errors,
    ...validateBackendGovernanceHardening(candidate, root, { checkFiles: false }).errors
  ];
}

function expectValid(label, mutate = () => {}) {
  const candidate = manifest();
  mutate(candidate);
  assert.deepEqual(validate(candidate), [], `${label} should be valid`);
  assertions += 1;
}

function expectInvalid(label, mutate, fragment) {
  const candidate = manifest();
  mutate(candidate);
  const errors = validate(candidate);
  assert.ok(errors.some((error) => fragment.test(error)), `${label}: expected ${fragment}, got ${errors.join(" | ")}`);
  assertions += 1;
}

try {
  expectValid("new Rust/Axum HTTP runtime");

  expectValid("new Rust runtime without HTTP", (candidate) => {
    candidate.interfaces[0].kind = "job";
    candidate.interfaces[0].contractType = "custom";
    candidate.technology.httpFramework = "not-applicable";
  });

  expectValid("preserved brownfield runtime", (candidate) => {
    candidate.mode = "extension";
    candidate.gate.conditions.newServiceOrSubsystem = false;
    candidate.gate.required = false;
    candidate.gate.status = "not-applicable";
    candidate.technology = {
      runtimeContext: "existing-runtime",
      selection: "preserve-existing",
      language: "typescript",
      httpFramework: "nestjs",
      decisionRef: ".specs/features/technology-selection/07-design.md#preserve-existing",
      exception: {
        applicable: false,
        reasonClass: "not-applicable",
        alternative: "",
        justification: "",
        evidenceRefs: []
      }
    };
  });

  expectValid("task-fit disposable POC", (candidate) => {
    candidate.mode = "quick-fix";
    candidate.gate.conditions.newServiceOrSubsystem = false;
    candidate.gate.required = false;
    candidate.gate.status = "not-applicable";
    candidate.technology = {
      runtimeContext: "disposable-nonproduction",
      selection: "task-fit-nonproduction",
      language: "python",
      httpFramework: "fastapi",
      decisionRef: ".specs/features/technology-selection/07-design.md#disposable-poc",
      exception: {
        applicable: false,
        reasonClass: "not-applicable",
        alternative: "",
        justification: "",
        evidenceRefs: []
      }
    };
  });

  expectValid("evidence-backed approved exception", (candidate) => {
    candidate.technology = {
      runtimeContext: "new-production-runtime",
      selection: "approved-exception",
      language: "go",
      httpFramework: "chi",
      decisionRef: ".specs/features/technology-selection/07-design.md#approved-exception",
      exception: {
        applicable: true,
        reasonClass: "mandatory-vendor-sdk",
        alternative: "Go with the vendor-supported SDK",
        justification: "The mandatory vendor SDK has no supported Rust implementation and owns the protocol lifecycle.",
        evidenceRefs: ["docs/backend/vendor-sdk-support-matrix.md"]
      }
    };
  });

  expectInvalid("alternative production runtime without exception", (candidate) => {
    candidate.technology.selection = "preserve-existing";
    candidate.technology.language = "go";
    candidate.technology.httpFramework = "chi";
  }, /new-production-runtime.*rust-axum-default.*approved-exception/);

  expectInvalid("Rust HTTP without Axum", (candidate) => {
    candidate.technology.httpFramework = "actix-web";
  }, /HTTP.*httpFramework=axum/);

  expectInvalid("exception without decision reference", (candidate) => {
    candidate.technology.selection = "approved-exception";
    candidate.technology.decisionRef = "";
    candidate.technology.exception = {
      applicable: true,
      reasonClass: "platform-constraint",
      alternative: "Go",
      justification: "The target platform does not provide a supported Rust toolchain.",
      evidenceRefs: ["docs/backend/platform-support.md"]
    };
  }, /decisionRef/);

  expectInvalid("exception without reason", (candidate) => {
    candidate.technology.selection = "approved-exception";
    candidate.technology.exception.applicable = true;
    candidate.technology.exception.alternative = "Go";
    candidate.technology.exception.justification = "The platform constraint is documented by the runtime owner.";
    candidate.technology.exception.evidenceRefs = ["docs/backend/platform-support.md"];
  }, /reasonClass/);

  expectInvalid("exception without evidence", (candidate) => {
    candidate.technology.selection = "approved-exception";
    candidate.technology.exception = {
      applicable: true,
      reasonClass: "platform-constraint",
      alternative: "Go",
      justification: "The target platform does not provide a supported Rust toolchain.",
      evidenceRefs: []
    };
  }, /evidenceRefs/);

  expectInvalid("silent brownfield migration", (candidate) => {
    candidate.mode = "extension";
    candidate.gate.conditions.newServiceOrSubsystem = false;
    candidate.gate.required = false;
    candidate.gate.status = "not-applicable";
    candidate.technology.runtimeContext = "existing-runtime";
  }, /existing-runtime.*preserve-existing.*migration/);

  expectInvalid("current manifest without technology", (candidate) => {
    delete candidate.technology;
  }, /technology/);

  expectInvalid("historical manifest requires explicit migration", (candidate) => {
    candidate.schemaVersion = "1.2.0";
    delete candidate.technology;
  }, /1\.2\.0.*historical.*migrate explicitly.*1\.3\.0/i);

  console.log(`Backend technology selection regression suite passed (${assertions} assertions).`);
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
