import fs from "node:fs";
import path from "node:path";

// Templates keep the English `replace-with-*` / `Describe …` placeholders, but
// artifacts are authored in pt-BR, so the pt-BR spellings must count as
// placeholders too. Otherwise an unfilled pt-BR placeholder passes as concrete
// and broad-build approval loses this guard. Same bilingual approach already
// used for the familiarity/preferência check below.
const PLACEHOLDER =
  /^(?:replace-with|describe\b|tbd\b|todo\b|unknown\b|substituir-por|substitua\b|descrev|a-definir|a definir|desconhecid|pendente\b|preencher\b)/i;

function resolveProjectPath(root, value) {
  if (!value || typeof value !== "string" || path.isAbsolute(value)) return null;
  const normalizedRoot = path.resolve(root);
  const resolved = path.resolve(normalizedRoot, value);
  return resolved === normalizedRoot || resolved.startsWith(`${normalizedRoot}${path.sep}`) ? resolved : null;
}

function validateEvidencePath(root, value, label, errors) {
  const resolved = resolveProjectPath(root, value);
  if (!resolved) {
    errors.push(`${label} must be a repository-relative path inside the project root: ${value}`);
    return;
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile() || fs.statSync(resolved).size === 0) {
    errors.push(`${label} is missing or empty: ${value}`);
  }
}

function concrete(value) {
  return typeof value === "string" && value.trim().length >= 3 && !PLACEHOLDER.test(value.trim());
}

function validateTechnologySelection(manifest, root, options, errors) {
  const technology = manifest.technology;
  if (!technology) {
    errors.push("technology is required for current backend work");
    return;
  }

  const decisionPath = String(technology.decisionRef || "").split("#", 1)[0];
  if (!decisionPath || !resolveProjectPath(root, decisionPath)) {
    errors.push(`technology.decisionRef must be a repository-relative path/reference: ${technology.decisionRef || "<empty>"}`);
  }

  const { runtimeContext, selection } = technology;
  if (runtimeContext === "new-production-runtime" && !["rust-axum-default", "approved-exception"].includes(selection)) {
    errors.push("technology new-production-runtime requires selection rust-axum-default or approved-exception");
  }
  if (runtimeContext === "existing-runtime") {
    const explicitRustMigration = manifest.mode === "migration" && selection === "rust-axum-default";
    if (selection !== "preserve-existing" && !explicitRustMigration) {
      errors.push("technology existing-runtime requires preserve-existing; migration to Rust requires mode=migration and an explicit design decision");
    }
  }
  if (runtimeContext === "disposable-nonproduction" && selection !== "task-fit-nonproduction") {
    errors.push("technology disposable-nonproduction requires selection task-fit-nonproduction");
  }

  if (selection === "rust-axum-default") {
    if (technology.language !== "rust") errors.push("technology rust-axum-default requires language=rust");
    const hasHttp = (manifest.interfaces || []).some((entry) => entry.kind === "http");
    if (hasHttp && technology.httpFramework !== "axum") {
      errors.push("technology Rust HTTP runtime requires httpFramework=axum");
    }
    if (!hasHttp && technology.httpFramework !== "not-applicable") {
      errors.push("technology Rust runtime without HTTP requires httpFramework=not-applicable");
    }
  }

  const exception = technology.exception || {};
  if (selection === "approved-exception") {
    if (exception.applicable !== true) errors.push("technology approved-exception requires exception.applicable=true");
    if (!exception.reasonClass || exception.reasonClass === "not-applicable") {
      errors.push("technology approved-exception requires a technical exception.reasonClass");
    }
    if (!concrete(exception.alternative)) errors.push("technology approved-exception requires a concrete exception.alternative");
    if (!concrete(exception.justification)) errors.push("technology approved-exception requires a concrete exception.justification");
    if (/personal preference|familiarity|prefer[eê]ncia pessoal|familiaridade/i.test(exception.justification || "")) {
      errors.push("technology exception cannot use familiarity or personal preference as technical evidence");
    }
    if (!(exception.evidenceRefs || []).length) errors.push("technology approved-exception requires exception.evidenceRefs");
    for (const evidenceRef of exception.evidenceRefs || []) {
      if (!resolveProjectPath(root, evidenceRef)) {
        errors.push(`technology exception evidenceRefs must contain repository-relative paths: ${evidenceRef}`);
      } else if (options.checkFiles) {
        validateEvidencePath(root, evidenceRef, "technology exception evidence", errors);
      }
    }
  } else {
    if (exception.applicable !== false) errors.push("technology non-exception selection requires exception.applicable=false");
    if (exception.reasonClass !== "not-applicable") errors.push("technology non-exception selection requires exception.reasonClass=not-applicable");
    if (exception.alternative || exception.justification || (exception.evidenceRefs || []).length) {
      errors.push("technology non-exception selection cannot retain exception alternative, justification, or evidenceRefs");
    }
  }
}

function validateExternalDependencies(manifest, root, options, errors) {
  const dependencies = manifest.reliability?.externalDependencies || [];
  const names = new Set();

  if (manifest.mode === "integration" && dependencies.length === 0) {
    errors.push("integration mode requires at least one reliability.externalDependencies entry");
  }

  for (const dependency of dependencies) {
    const label = `external dependency '${dependency.dependency || "<unnamed>"}'`;
    if (names.has(dependency.dependency)) errors.push(`Duplicate ${label}`);
    names.add(dependency.dependency);

    if (!concrete(dependency.timeout)) errors.push(`${label}: timeout must be concrete, not placeholder prose`);
    if (!concrete(dependency.retry?.backoff)) errors.push(`${label}: retry.backoff must be concrete`);
    if ((dependency.retry?.maxAttempts || 1) > 1 && dependency.transientOnly !== true) {
      errors.push(`${label}: retries beyond the first attempt must be transientOnly=true`);
    }
    if ((dependency.retry?.maxAttempts || 1) > 1 && dependency.idempotency === "unsafe") {
      errors.push(`${label}: retries are forbidden when idempotency=unsafe`);
    }
    if (["degrade", "queue-for-later", "retry-later"].includes(dependency.failureMode) && !(dependency.evidence || []).length) {
      errors.push(`${label}: non-terminal failure mode requires evidence`);
    }
    if (options.checkFiles) {
      for (const evidencePath of dependency.evidence || []) {
        validateEvidencePath(root, evidencePath, `${label} evidence`, errors);
      }
    }
  }
}

function validateSecurityBoundaries(manifest, errors) {
  const boundaries = manifest.security?.boundaries || [];
  if (manifest.security?.applicable === true && boundaries.length === 0) {
    errors.push("security.boundaries must contain at least one explicit trust/resource boundary when security is applicable");
  }
  if (manifest.security?.materialChange === true && boundaries.length === 0) {
    errors.push("security materialChange requires explicit security.boundaries");
  }

  const requireConcrete = manifest.security?.materialChange === true
    || manifest.gate?.status === "backend-broad-build-approved";
  const keys = new Set();
  for (const boundary of boundaries) {
    const key = `${boundary.trustBoundary}::${boundary.resource}`;
    if (keys.has(key)) errors.push(`Duplicate security boundary for ${key}`);
    keys.add(key);
    if (requireConcrete) {
      for (const field of ["trustBoundary", "resource", "identitySource", "tenantBinding", "authorizationPoint"]) {
        if (!concrete(boundary[field])) errors.push(`security boundary ${key}: ${field} must be concrete before broad-build approval`);
      }
    }
    if (!(boundary.negativeTestIds || []).length) errors.push(`security boundary ${key}: negativeTestIds must prove deny/isolation behavior`);
  }
}

function validateRepairTrace(manifest, root, options, errors) {
  const trace = manifest.repairTrace || {};
  const required = manifest.mode === "repair" || trace.applicable === true;
  if (!required) {
    if (!concrete(trace.notApplicableReason)) errors.push("repairTrace.notApplicableReason must explain why repair tracing is not applicable");
    return;
  }

  if (trace.applicable !== true) errors.push("repair mode requires repairTrace.applicable=true");
  if (!concrete(trace.finding)) errors.push("repairTrace.finding must identify the observed defect/finding");
  if (!concrete(trace.systemicCause)) errors.push("repairTrace.systemicCause must identify the systemic cause, not only the symptom");
  if (!concrete(trace.canonicalAuthorityRef)) errors.push("repairTrace.canonicalAuthorityRef must identify the canonical authority being repaired");
  if (!(trace.regressionTestIds || []).length) errors.push("repairTrace.regressionTestIds must contain at least one regression test ID");
  if (!(trace.repairEvidencePaths || []).length) errors.push("repairTrace.repairEvidencePaths must contain repair evidence");
  if (options.checkFiles) {
    for (const evidencePath of trace.repairEvidencePaths || []) {
      validateEvidencePath(root, evidencePath, "repairTrace evidence", errors);
    }
  }
}

function validateTestIntegrity(manifest, root, options, errors) {
  const integrity = manifest.testIntegrity || {};
  if (integrity.contractualCoverage === "reduced") {
    errors.push("testIntegrity.contractualCoverage cannot be reduced inside an implementation change; rebaseline the canonical contract first");
  }
  for (const testPath of integrity.testPaths || []) {
    if (!resolveProjectPath(root, testPath)) errors.push(`testIntegrity.testPaths entry escapes project root: ${testPath}`);
  }
  if (options.checkFiles) {
    for (const evidencePath of integrity.evidencePaths || []) {
      validateEvidencePath(root, evidencePath, "testIntegrity evidence", errors);
    }
  }
}

/**
 * WF-SOS-003: released Rust vertical slices must retain an unambiguous quality-gate
 * transcript (fmt + clippy exit 0). Contradictory bundles that mix EXIT=1 with narrative
 * "green" claims are rejected.
 */
function validateRustQualityEvidence(manifest, root, options, errors) {
  if (manifest.technology?.selection !== "rust-axum-default") return;
  const gateStatus = manifest.gate?.status;
  if (!["approved", "backend-broad-build-approved"].includes(gateStatus)) return;
  if (!options.checkFiles) return;

  const feature = manifest.feature || "backend";
  const qualityPath = `docs/backend/${feature}/evidence/rust-quality-gates.txt`;
  const resolved = resolveProjectPath(root, qualityPath);
  if (!resolved || !fs.existsSync(resolved) || fs.statSync(resolved).size === 0) {
    errors.push(
      `rust-axum-default gate '${gateStatus}' requires non-empty ${qualityPath} with FMT_EXIT=0 and CLIPPY_EXIT=0 (WF-SOS-003)`
    );
    return;
  }

  const body = fs.readFileSync(resolved, "utf8");
  const hasFmtPass = /(?:^|\n)FMT_EXIT=0(?:\n|$)/.test(body);
  const hasClippyPass = /(?:^|\n)CLIPPY_EXIT=0(?:\n|$)/.test(body);
  const hasFmtFail = /(?:^|\n)FMT_EXIT=[1-9]\d*(?:\n|$)/.test(body);
  const hasClippyFail = /(?:^|\n)CLIPPY_EXIT=[1-9]\d*(?:\n|$)/.test(body);

  if (!hasFmtPass || !hasClippyPass) {
    errors.push(`${qualityPath} must declare FMT_EXIT=0 and CLIPPY_EXIT=0 for a released Rust slice (WF-SOS-003)`);
  }
  if (hasFmtFail || hasClippyFail) {
    errors.push(`${qualityPath} contains failing FMT_EXIT/CLIPPY_EXIT markers and cannot release the Rust gate (WF-SOS-003)`);
  }
}

export function validateBackendGovernanceHardening(manifest, root, options = {}) {
  const errors = [];
  const warnings = [];
  validateTechnologySelection(manifest, root, options, errors);
  validateExternalDependencies(manifest, root, options, errors);
  validateSecurityBoundaries(manifest, errors);
  validateRepairTrace(manifest, root, options, errors);
  validateTestIntegrity(manifest, root, options, errors);
  validateRustQualityEvidence(manifest, root, options, errors);
  return { errors, warnings };
}
