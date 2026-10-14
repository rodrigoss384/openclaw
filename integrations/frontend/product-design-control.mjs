#!/usr/bin/env node
import crypto from "node:crypto";
import { projectFile, loadExecutionContext, digest } from "../governance/execution-context.mjs";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const VOLATILE_KEYS = new Set([
  "absolutePath",
  "capturedAt",
  "completedAt",
  "generatedAt",
  "originalPath",
  "startedAt",
  "timestamp"
]);
const PAID_OR_AUTHENTICATED_PROVIDERS = new Set([
  "mobbin",
  "pexels",
  "tailwind-plus",
  "unsplash"
]);
const INITIAL_OPEN_CAPABILITIES = new Set([
  "fontsource",
  "iconify-open-sets",
  "local-assets",
  "local-references",
  "lucide",
  "official-design-systems",
  "open-source-repositories",
  "open-web",
  "openverse"
]);
const CRITICAL_AREAS = new Set([
  "consent",
  "irreversible-decision",
  "regulated-flow",
  "security"
]);
const AUTOMATIC_LICENSE_ALLOWLIST = new Set([
  "Apache-2.0",
  "CC-BY-4.0",
  "CC0-1.0",
  "ISC",
  "MIT",
  "OFL-1.1",
  "Public-Domain"
]);
const REQUIRED_REFERENCE_FIELDS = [
  "id",
  "queryId",
  "url",
  "origin",
  "accessedAt",
  "usage",
  "category",
  "taskObserved",
  "usefulPatterns",
  "antiPatterns",
  "adoptedAspects",
  "excludedAspects",
  "templateRisk",
  "license",
  "affectedScreens",
  "affectedDecisionIds"
];
const ASSET_REJECTION_REASON_CODES = new Set([
  "ACCESSIBILITY_CONFLICT",
  "BRAND_CONFLICT",
  "COMPOSITION_MISMATCH",
  "DOMAIN_MISMATCH",
  "LICENSE_UNVERIFIABLE",
  "NO_RESULTS",
  "PERFORMANCE_BUDGET_EXCEEDED",
  "REPRESENTATION_RISK",
  "RESOLUTION_INSUFFICIENT"
]);
const ASSET_REQUEST_REQUIRED_FIELDS = [
  "purpose", "targetScreen", "message", "type", "subjectDescription", "environment", "action", "emotion", "realism",
  "composition", "palette", "requiredElements", "prohibitedElements", "representationRisks", "generationConstraints", "delivery",
  "crops", "positivePrompt", "negativePrompt", "recommendedVariations", "altTextIntent", "acceptanceChecklist", "expectedFileName",
  "expectedDestination", "rightsDeclarationRequired"
];
const HUMAN_DECISION_SCOPES = new Set([
  "product-truth",
  "brand-or-asset-rights",
  "critical-consequence",
  "accepted-risk",
  "broad-build-authorization",
  "release-authorization"
]);

function isObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function sortCanonical(value) {
  if (Array.isArray(value)) return value.map(sortCanonical);
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "semanticDigest" && !VOLATILE_KEYS.has(key))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortCanonical(child)])
  );
}

export function canonicalProductDesignDigest(value) {
  return crypto.createHash("sha256").update(JSON.stringify(sortCanonical(value))).digest("hex");
}

function artifact(artifactKind, value, schemaVersion = "1.0.0") {
  const result = { artifactKind, schemaVersion, ...value };
  result.semanticDigest = canonicalProductDesignDigest(result);
  return result;
}

function finding(id, message, overrides = {}) {
  return {
    id,
    severity: id === "PDA-08" || id === "PDA-10" || id === "PDA-11" || id === "PDA-12" ? "P0" : "P1",
    source: "product-design-control",
    message,
    ...overrides
  };
}

function uniqueFindings(findings) {
  const byKey = new Map();
  for (const item of findings) {
    const findingKey = item.findingKey ?? `${item.id}:${item.targetId ?? item.message}`;
    if (!byKey.has(findingKey)) byKey.set(findingKey, { ...item, findingKey });
  }
  return [...byKey.values()].sort((left, right) =>
    left.id.localeCompare(right.id) || left.findingKey.localeCompare(right.findingKey)
  );
}

function subjectFrom(input) {
  return {
    project: String(input?.subject?.project ?? "unknown"),
    commit: String(input?.subject?.commit ?? "unknown")
  };
}

function hasSufficientIncumbency(input) {
  if (input?.product?.maturity !== "established") return false;
  const sources = Array.isArray(input.localSources) ? input.localSources : [];
  const hasDirection = sources.some((source) => source.kind === "design-direction" && source.status === "sufficient");
  const hasDesignSystem = sources.some((source) => source.kind === "design-system" && source.status === "sufficient");
  return hasDirection && hasDesignSystem && input.changeMode === "strict-extension";
}

function researchPlanFor(input) {
  if (hasSufficientIncumbency(input)) {
    return {
      intensity: "research-not-required",
      minimumReferences: 0,
      minimumOrigins: 0,
      requiredCategories: [],
      rationale: "Canonical design direction and Design System fully cover this strict extension."
    };
  }

  const visitorMode = String(input?.context?.visitorMode ?? "");
  const expanded = visitorMode === "Persuade" || visitorMode === "Experience";
  return expanded
    ? {
        intensity: "expanded-research",
        minimumReferences: 5,
        minimumOrigins: 3,
        requiredCategories: ["real-product", "domain-reference", "material-or-asset"],
        rationale: `${visitorMode} requires expanded research.`
      }
    : {
        intensity: "targeted-research",
        minimumReferences: 3,
        minimumOrigins: 2,
        requiredCategories: [],
        rationale: `${visitorMode || "Unclassified"} requires targeted research.`
      };
}

export function deriveProductDesignProfile(input) {
  if (!isObject(input)) throw new Error("product design profile input must be a JSON object.");
  const findings = [];
  const openCapabilities = Array.isArray(input.openCapabilities) ? input.openCapabilities.map(String) : [];
  const prohibited = openCapabilities.filter((provider) =>
    PAID_OR_AUTHENTICATED_PROVIDERS.has(provider) || !INITIAL_OPEN_CAPABILITIES.has(provider));
  if (prohibited.length > 0) {
    findings.push(finding("PDA-05", "Paid or authenticated providers are outside the initial rollout.", {
      actual: prohibited
    }));
  }

  const subject = subjectFrom(input);
  const profile = artifact("product-design-profile", {
    subject,
    feature: String(input.feature ?? "unknown"),
    visitorMode: String(input?.context?.visitorMode ?? "unknown"),
    productMaturity: String(input?.product?.maturity ?? "unknown"),
    changeMode: String(input.changeMode ?? "new-direction"),
    localSources: Array.isArray(input.localSources) ? input.localSources : [],
    openCapabilities,
    prohibitedProviders: prohibited
  });
  const researchPlan = artifact("visual-research-plan", {
    subject,
    profileDigest: profile.semanticDigest,
    ...researchPlanFor(input)
  });

  return { profile, researchPlan, findings: uniqueFindings(findings) };
}

function hasCriticalContext(input) {
  if (input?.context?.risk === "critical") return true;
  const areas = Array.isArray(input?.context?.consequentialAreas) ? input.context.consequentialAreas : [];
  return areas.some((area) => CRITICAL_AREAS.has(String(area)));
}

function visualPreferenceQuestions(input) {
  const questions = Array.isArray(input.questions) ? input.questions : [];
  return questions.filter((question) =>
    question?.kind === "visual-preference" || /\b(?:cor|layout|tipografia|probe|visual)\b.*\bprefer/i.test(String(question?.text ?? ""))
  );
}

export function compileProductDesignBrief(input, suppliedProfile, suppliedResearchPlan) {
  if (!isObject(input)) throw new Error("product design brief input must be a JSON object.");
  const derived = suppliedProfile && suppliedResearchPlan ? null : deriveProductDesignProfile(input);
  const profile = suppliedProfile ?? derived.profile;
  const researchPlan = suppliedResearchPlan ?? derived.researchPlan;
  const findings = [...(derived?.findings ?? [])];

  if (!isObject(input.product) || !isObject(input.audience) || !isObject(input.task)
    || !String(input.audience?.primary ?? "").trim() || !String(input.task?.dominant ?? "").trim()) {
    findings.push(finding("PDA-01", "Product, primary audience and dominant task are required."));
  }

  const preferenceQuestions = visualPreferenceQuestions(input);
  if (preferenceQuestions.length > 0) {
    findings.push(finding("PDA-02", "Resolvable visual preference must remain with the agent Design Authority.", {
      actual: preferenceQuestions.map((question) => String(question.text ?? question.kind))
    }));
  }

  const userEvidence = Array.isArray(input.userEvidence) ? input.userEvidence : [];
  const hypotheses = userEvidence.filter((evidence) => evidence?.grade === "hypothesis");
  const missingValidation = hypotheses.filter((evidence) => !String(evidence.validationPlan ?? "").trim());
  const onlyHypotheses = userEvidence.length > 0 && userEvidence.every((evidence) => evidence?.grade === "hypothesis");
  if (missingValidation.length > 0 || (onlyHypotheses && hasCriticalContext(input))) {
    findings.push(finding("PDA-12", "Hypothesis evidence requires a validation plan and cannot solely govern critical flows."));
  }

  const claims = Array.isArray(input?.content?.claims) ? input.content.claims : [];
  const unsupportedClaims = claims.filter((claim) => !String(claim.sourceRef ?? claim.source ?? "").trim());
  if (unsupportedClaims.length > 0) {
    findings.push(finding("PDA-11", "Facts, promises and testimonials require a source.", {
      actual: unsupportedClaims.map((claim) => String(claim.id ?? claim.text ?? "claim"))
    }));
  }

  const subject = subjectFrom(input);
  const brief = artifact("product-design-brief", {
    subject,
    feature: String(input.feature ?? "unknown"),
    profileDigest: profile?.semanticDigest ?? null,
    researchPlanDigest: researchPlan?.semanticDigest ?? null,
    product: input.product ?? null,
    audience: input.audience ?? null,
    task: input.task ?? null,
    context: input.context ?? {},
    content: input.content ?? { representativeCopy: [], claims: [] },
    states: Array.isArray(input.states) ? input.states : [],
    userEvidence,
    evidenceGaps: Array.isArray(input.evidenceGaps) ? input.evidenceGaps : [],
    visualPreferenceQuestions: preferenceQuestions
  });

  return { brief, profile, researchPlan, findings: uniqueFindings(findings) };
}

function presentReferenceField(reference, field) {
  const value = reference?.[field];
  if (Array.isArray(value)) return value.length > 0 || field === "adoptedAspects";
  if (isObject(value)) return Object.keys(value).length > 0;
  return value !== undefined && value !== null && String(value).trim().length > 0;
}

function normalizeOpenverseLicense(item, annotation) {
  const license = String(item?.license ?? "").toLowerCase();
  const version = String(item?.license_version ?? "");
  const id = license === "cc0" ? "CC0-1.0"
    : license === "pdm" ? "Public-Domain"
      : license === "by" && version === "4.0" ? "CC-BY-4.0"
        : `${license.toUpperCase()}${version ? `-${version}` : ""}`;
  return {
    id,
    sourceUrl: String(item?.license_url ?? ""),
    verifiedAt: String(annotation?.originLicenseVerifiedAt ?? ""),
    retention: String(annotation?.retention ?? "metadata-only")
  };
}

export function normalizeOpenResearchAdapters(adapterRuns) {
  if (!Array.isArray(adapterRuns)) throw new Error("open research adapter runs must be an array.");
  const findings = [];
  const references = [];
  const adapters = [];

  for (const run of adapterRuns) {
    const adapter = String(run?.adapter ?? "");
    const status = String(run?.status ?? "not-run");
    const queryId = String(run?.queryId ?? "");
    const executedAt = String(run?.executedAt ?? "");
    const results = Array.isArray(run?.results) ? run.results : [];
    adapters.push({
      adapter,
      status,
      queryId,
      executedAt,
      resultCount: results.length,
      endpoint: String(run?.request?.endpoint ?? "")
    });
    if (!new Set(["open-web", "openverse"]).has(adapter) || status !== "passed") continue;

    for (const item of results) {
      const annotation = run?.annotations?.[item?.id] ?? {};
      const normalized = adapter === "openverse" ? {
        id: `OPENVERSE-${String(item?.id ?? "unknown")}`,
        queryId,
        url: String(item?.foreign_landing_url ?? ""),
        origin: `openverse:${String(item?.source ?? item?.provider ?? "unknown")}`,
        accessedAt: executedAt,
        usage: String(annotation.usage ?? "production-candidate"),
        category: String(annotation.category ?? "material-or-asset"),
        taskObserved: annotation.taskObserved,
        usefulPatterns: annotation.usefulPatterns,
        antiPatterns: annotation.antiPatterns,
        adoptedAspects: annotation.adoptedAspects,
        excludedAspects: annotation.excludedAspects,
        templateRisk: annotation.templateRisk,
        license: normalizeOpenverseLicense(item, annotation),
        affectedScreens: annotation.affectedScreens,
        affectedDecisionIds: annotation.affectedDecisionIds,
        retention: String(annotation.retention ?? "metadata-only"),
        providerMetadata: {
          providerId: String(item?.id ?? ""),
          title: String(item?.title ?? ""),
          creator: String(item?.creator ?? ""),
          source: String(item?.source ?? ""),
          provider: String(item?.provider ?? "")
        }
      } : {
        ...item,
        queryId: String(item?.queryId ?? queryId),
        accessedAt: String(item?.accessedAt ?? executedAt),
        retention: String(item?.retention ?? "metadata-only")
      };
      references.push(normalized);

      if (adapter === "openverse" && !String(item?.foreign_landing_url ?? "").trim()) {
        findings.push(finding("PDA-06", "Openverse results require the upstream landing page as provenance.", { targetId: normalized.id }));
      }
      if (adapter === "openverse" && (!String(item?.license_url ?? "").trim()
        || !String(annotation?.originLicenseVerifiedAt ?? "").trim()
        || !AUTOMATIC_LICENSE_ALLOWLIST.has(normalized.license.id))) {
        findings.push(finding("PDA-08", "Openverse discovery requires license verification at the upstream origin.", {
          targetId: normalized.id,
          decisionClass: "legal-consequential",
          route: "HUMAN_REQUIRED"
        }));
      }
    }
  }

  return {
    references,
    network: {
      mode: "adapter-fixture",
      status: adapters.length > 0 && adapters.every((adapter) => adapter.status === "passed") ? "passed" : "not-run",
      adapters
    },
    findings: uniqueFindings(findings)
  };
}

export function validateVisualResearch(input) {
  if (!isObject(input)) throw new Error("visual research input must be a JSON object.");
  const adapterResult = Array.isArray(input.adapterRuns) ? normalizeOpenResearchAdapters(input.adapterRuns) : null;
  const references = [
    ...(Array.isArray(input.references) ? input.references : []),
    ...(adapterResult?.references ?? [])
  ];
  const origins = new Set(references.map((reference) => String(reference.origin ?? "")).filter(Boolean));
  const categories = new Set(references.map((reference) => String(reference.category ?? "")).filter(Boolean));
  const findings = [...(adapterResult?.findings ?? [])];
  const minimumReferences = Number(input.minimumReferences ?? (input.intensity === "expanded-research" ? 5 : input.intensity === "targeted-research" ? 3 : 0));
  const minimumOrigins = Number(input.minimumOrigins ?? (input.intensity === "expanded-research" ? 3 : input.intensity === "targeted-research" ? 2 : 0));
  const requiredCategories = Array.isArray(input.requiredCategories) ? input.requiredCategories.map(String) : [];

  if (references.length < minimumReferences || origins.size < minimumOrigins
    || requiredCategories.some((category) => !categories.has(category))) {
    findings.push(finding("PDA-05", "Visual research coverage is insufficient for the derived intensity.", {
      actual: { references: references.length, origins: origins.size, categories: [...categories].sort() },
      expected: { minimumReferences, minimumOrigins, requiredCategories }
    }));
  }

  const incompleteReferences = references.filter((reference) =>
    REQUIRED_REFERENCE_FIELDS.some((field) => !presentReferenceField(reference, field))
  );
  if (incompleteReferences.length > 0) {
    findings.push(finding("PDA-06", "Every reference requires provenance, adopted aspects and explicit exclusions.", {
      actual: incompleteReferences.map((reference) => String(reference.id ?? "unknown"))
    }));
  }

  const copiedReferences = references.filter((reference) =>
    reference.implementationDisposition === "copied" || reference.retention === "mirrored-library"
  );
  if (copiedReferences.length > 0) {
    findings.push(finding("PDA-07", "References and templates cannot be copied as product implementation.", {
      actual: copiedReferences.map((reference) => String(reference.id ?? "unknown"))
    }));
  }

  const invalidProductionLicenses = references.filter((reference) => {
    if (reference.usage !== "production-candidate") return false;
    const license = reference.license ?? {};
    return !AUTOMATIC_LICENSE_ALLOWLIST.has(license.id)
      || !String(license.sourceUrl ?? "").trim()
      || !String(license.verifiedAt ?? "").trim();
  });
  if (invalidProductionLicenses.length > 0) {
    findings.push(finding("PDA-08", "Production assets require an allowlisted license verified at the origin.", {
      actual: invalidProductionLicenses.map((reference) => String(reference.id ?? "unknown")),
      decisionClass: "legal-consequential",
      route: "HUMAN_REQUIRED"
    }));
  }

  const subject = subjectFrom(input);
  const research = artifact("visual-research", {
    subject,
    briefDigest: String(input.briefDigest ?? ""),
    intensity: String(input.intensity ?? "targeted-research"),
    queries: Array.isArray(input.queries) ? input.queries : [],
    references,
    rejectedCandidates: Array.isArray(input.rejectedCandidates) ? input.rejectedCandidates : [],
    coverage: {
      references: references.length,
      origins: origins.size,
      categories: [...categories].sort()
    },
    network: adapterResult?.network ?? (isObject(input.network) ? input.network : { mode: "fixture", status: "not-run" })
  });

  return { research, findings: uniqueFindings(findings) };
}

function candidateObjectiveScore(candidate) {
  const criteria = Array.isArray(candidate?.criteria) ? candidate.criteria : [];
  const weighted = criteria.reduce((total, criterion) =>
    total + Number(criterion?.weight ?? 0) * Number(criterion?.score ?? 0), 0);
  const totalWeight = criteria.reduce((total, criterion) => total + Number(criterion?.weight ?? 0), 0);
  return totalWeight > 0 ? Math.round((weighted / totalWeight) * 10 * 100) / 100 : 0;
}

function completeDirectionCandidate(candidate) {
  return String(candidate?.id ?? "").trim().length > 0
    && String(candidate?.thesis ?? "").trim().length >= 20
    && String(candidate?.signatureElement ?? "").trim().length >= 3
    && String(candidate?.rationale ?? "").trim().length >= 10
    && Array.isArray(candidate?.criteria) && candidate.criteria.length >= 3
    && candidate.criteria.every((criterion) =>
      String(criterion?.id ?? "").trim()
      && Number(criterion?.weight) > 0
      && Number(criterion?.score) >= 0
      && Number(criterion?.score) <= 10
      && String(criterion?.rationale ?? "").trim().length >= 10)
    && Array.isArray(candidate?.risks) && candidate.risks.length > 0
    && candidate.risks.every((risk) => String(risk?.id ?? "").trim() && String(risk?.mitigation ?? "").trim())
    && Array.isArray(candidate?.evidenceRefs) && candidate.evidenceRefs.length > 0
    && Array.isArray(candidate?.adoptedAspects) && candidate.adoptedAspects.length > 0
    && Array.isArray(candidate?.excludedAspects) && candidate.excludedAspects.length > 0;
}

function contextualDirectionCandidate(candidate) {
  const contextuality = candidate?.contextuality ?? {};
  return ["productSignals", "audienceSignals", "taskSignals"].every((field) =>
    Array.isArray(contextuality[field])
    && contextuality[field].some((signal) => String(signal).trim().length >= 3));
}

function autonomyCandidateFrom(candidate) {
  return {
    id: String(candidate.id),
    description: String(candidate.thesis),
    canonicalContractMatch: candidate.canonicalContractMatch === true,
    contractRefs: Array.isArray(candidate.contractRefs) ? candidate.contractRefs : [],
    precedentMatch: candidate.precedentMatch === true,
    precedentRefs: Array.isArray(candidate.precedentRefs) ? candidate.precedentRefs : [],
    changeSize: Number(candidate.changeSize ?? 0),
    complexity: Number(candidate.complexity ?? 0),
    riskSurface: Number(candidate.riskSurface ?? 0),
    objectiveScore: candidateObjectiveScore(candidate),
    reversible: candidate.reversible === true,
    evidenceRefs: Array.isArray(candidate.evidenceRefs) ? candidate.evidenceRefs : [],
    equivalenceEvidenceRefs: Array.isArray(candidate.equivalenceEvidenceRefs) ? candidate.equivalenceEvidenceRefs : []
  };
}

function autonomyRequestFrom(input) {
  return {
    $schema: "integrations/governance/autonomy-decision.schema.json",
    schemaVersion: "1.0.0",
    artifactKind: "autonomy-decision-request",
    decisionClass: "design-authority-bounded",
    stage: String(input.stage ?? "implementation"),
    feature: String(input.feature ?? "unknown"),
    task: input.task ? String(input.task) : null,
    effectivePolicyRef: String(input.effectivePolicyRef ?? ""),
    humanGateRequired: input.humanGateRequired === true,
    candidates: (Array.isArray(input.candidates) ? input.candidates : []).map(autonomyCandidateFrom),
    evidence: Array.isArray(input.evidence) ? input.evidence : []
  };
}

export function compileProductDesignDecision(input, autonomyDecision) {
  if (!isObject(input)) throw new Error("product design decision input must be a JSON object.");
  const candidates = Array.isArray(input.candidates) ? input.candidates : [];
  const findings = [];
  if (candidates.length < 2 || candidates.some((candidate) => !completeDirectionCandidate(candidate))) {
    findings.push(finding("PDA-03", "At least two complete visual directions require a thesis, signature, objective criteria, risks and evidence."));
  }

  const selected = candidates.find((candidate) => candidate.id === autonomyDecision?.selectedOption);
  if (!selected || autonomyDecision?.decisionClass !== "design-authority-bounded"
    || autonomyDecision?.disposition !== "AUTONOMOUS_WITH_AUDIT"
    || autonomyDecision?.reversible !== true
    || !String(autonomyDecision?.decisionId ?? "").trim()
    || !isObject(autonomyDecision?.policyProvenance)) {
    findings.push(finding("PDA-13", "Only a reversible design-authority-bounded AUTONOMOUS_WITH_AUDIT ledger may select the visual direction."));
  }
  if (selected && !contextualDirectionCandidate(selected)) {
    findings.push(finding("PDA-04", "The selected direction must prove product, audience and task specificity instead of a generic template."));
  }

  const uniqueEvidenceRefs = [...new Set([
    ...(Array.isArray(autonomyDecision?.evidenceRefs) ? autonomyDecision.evidenceRefs : []),
    ...(Array.isArray(selected?.evidenceRefs) ? selected.evidenceRefs : [])
  ])].sort();
  if (uniqueEvidenceRefs.length < 3) {
    findings.push(finding("PDA-03", "The selected direction requires product, research and candidate-comparison evidence."));
  }

  const normalizedFindings = uniqueFindings(findings);
  if (normalizedFindings.length > 0) return { decision: null, findings: normalizedFindings };

  const decision = artifact("design-authority-decision", {
    subject: subjectFrom(input),
    feature: String(input.feature ?? "unknown"),
    briefDigest: String(input?.brief?.semanticDigest ?? ""),
    researchDigest: String(input?.research?.semanticDigest ?? ""),
    thesis: selected.thesis,
    signatureElement: selected.signatureElement,
    alternatives: candidates.map((candidate) => ({
      id: String(candidate.id),
      status: candidate.id === selected.id ? "selected" : "rejected",
      rationale: String(candidate.rationale),
      objectiveScore: candidateObjectiveScore(candidate)
    })),
    criteria: selected.criteria,
    selectedCandidateId: String(selected.id),
    risks: selected.risks,
    evidenceRefs: uniqueEvidenceRefs,
    adoptedAspects: selected.adoptedAspects,
    excludedAspects: selected.excludedAspects,
    visualDirectionSelectedBy: "agent",
    autonomyDecisionId: autonomyDecision.decisionId,
    policyProvenance: autonomyDecision.policyProvenance
  });
  return { decision, findings: [] };
}

export function validateHumanDecisionScope(receipt) {
  const scope = receipt?.authorityScope ?? receipt;
  const errors = [];
  if (!isObject(scope) || !HUMAN_DECISION_SCOPES.has(scope.kind)) {
    errors.push("human decision scope is missing or outside the enumerated product-truth/rights/consequence/risk/build/release authority");
  }
  if (!Array.isArray(scope?.evidenceRefs) || scope.evidenceRefs.length === 0
    || scope.evidenceRefs.some((ref) => !String(ref).trim())) {
    errors.push("human decision scope requires at least one evidence ref");
  }
  return { valid: errors.length === 0, errors };
}

function missingDependencyDigest(label) {
  return crypto.createHash("sha256").update(`missing:${label}`).digest("hex");
}

function artifactDigestIsCurrent(value) {
  return isObject(value)
    && /^[a-f0-9]{64}$/.test(String(value.semanticDigest ?? ""))
    && canonicalProductDesignDigest(value) === value.semanticDigest;
}

function sameSubject(left, right) {
  return String(left?.project ?? "") === String(right?.project ?? "")
    && String(left?.commit ?? "") === String(right?.commit ?? "");
}

export function evaluateProductDesignReadiness(input) {
  if (!isObject(input)) throw new Error("product design gate input must be a JSON object.");
  const subject = subjectFrom(input);
  const findings = Array.isArray(input.findings) ? input.findings.map((item) => ({ ...item })) : [];
  const required = [
    ["brief", input.brief, "product-design-brief", "PDA-01"],
    ["research", input.research, "visual-research", "PDA-06"],
    ["decision", input.decision, "design-authority-decision", "PDA-03"]
  ];
  let missingPrerequisite = false;
  let staleDependency = false;

  for (const [label, value, artifactKind, findingId] of required) {
    if (!isObject(value)) {
      missingPrerequisite = true;
      findings.push(finding(findingId, `Required product design prerequisite '${label}' is missing.`));
      continue;
    }
    if (value.artifactKind !== artifactKind || !sameSubject(subject, value.subject) || !artifactDigestIsCurrent(value)) {
      staleDependency = true;
      findings.push(finding(findingId, `Product design prerequisite '${label}' is stale or belongs to another subject.`));
    }
  }

  if (isObject(input.brief) && isObject(input.research)
    && input.research.briefDigest !== input.brief.semanticDigest) {
    staleDependency = true;
    findings.push(finding("PDA-06", "Visual research no longer points to the current Product Design Brief."));
  }
  if (isObject(input.brief) && isObject(input.research) && isObject(input.decision)
    && (input.decision.briefDigest !== input.brief.semanticDigest
      || input.decision.researchDigest !== input.research.semanticDigest
      || input.decision.visualDirectionSelectedBy !== "agent")) {
    staleDependency = true;
    findings.push(finding("PDA-03", "Design Authority Decision dependencies or selecting authority are stale."));
  }
  if (!/^[a-f0-9]{64}$/.test(String(input.policyDigest ?? ""))) {
    staleDependency = true;
    findings.push(finding("PDA-13", "Current autonomy/effective policy digest is missing or invalid."));
  }

  const humanReceipts = Array.isArray(input.humanReceipts) ? input.humanReceipts : [];
  for (const humanReceipt of humanReceipts) {
    const verification = validateHumanDecisionScope(humanReceipt);
    if (!verification.valid) {
      findings.push(finding("PDA-13", "Human receipt exceeds truth, rights, consequential risk or broad build/release authority.", {
        actual: verification.errors
      }));
    }
  }

  const sidecars = Array.isArray(input.assetSidecars) ? input.assetSidecars : [];
  if (isObject(input.assetRequirements)) {
    if (!artifactDigestIsCurrent(input.assetRequirements)
      || input.assetRequirements.decisionDigest !== input.decision?.semanticDigest
      || !sameSubject(subject, input.assetRequirements.subject)) {
      staleDependency = true;
      findings.push(finding("PDA-10", "Asset requirements are stale or point to another design decision."));
    }
    const requiredAssets = Array.isArray(input.assetRequirements.assets)
      ? input.assetRequirements.assets.filter((asset) => asset.equivalentAvailable === false && asset.materialLossWithoutAsset === true)
      : [];
    for (const requiredAsset of requiredAssets) {
      const sidecar = sidecars.find((item) => item?.assetId === requiredAsset.id);
      if (!sidecar || sidecar.artifactKind !== "approved-product-asset" || !artifactDigestIsCurrent(sidecar) || !sameSubject(subject, sidecar.subject)) {
        findings.push(finding("PDA-10", `Required asset '${requiredAsset.id}' has no current approved sidecar.`, { targetId: requiredAsset.id }));
      }
    }
  }

  const normalizedFindings = uniqueFindings(findings);
  const status = missingPrerequisite
    ? "not-run"
    : staleDependency
      ? "stale"
      : normalizedFindings.length > 0
        ? "failed"
        : "passed";
  const briefDigest = String(input.brief?.semanticDigest ?? missingDependencyDigest("brief"));
  const researchDigest = String(input.research?.semanticDigest ?? missingDependencyDigest("research"));
  const decisionDigest = String(input.decision?.semanticDigest ?? missingDependencyDigest("decision"));
  const currentPolicyDigest = /^[a-f0-9]{64}$/.test(String(input.policyDigest ?? ""))
    ? String(input.policyDigest)
    : missingDependencyDigest("policy");
  const assetDigests = sidecars.map((sidecar) => String(sidecar?.semanticDigest ?? "")).filter((digest) => /^[a-f0-9]{64}$/.test(digest)).sort();
  const readiness = artifact("product-design-readiness", {
    subject,
    briefDigest,
    researchDigest,
    decisionDigest,
    assetDigests,
    policyDigest: currentPolicyDigest,
    status,
    visualDirectionSelectedBy: "agent",
    blockingFindingIds: [...new Set(normalizedFindings.map((item) => item.id))].sort(),
    dependencyDigests: {
      brief: briefDigest,
      research: researchDigest,
      decision: decisionDigest,
      policy: currentPolicyDigest,
      assets: canonicalProductDesignDigest(assetDigests),
      humanScope: canonicalProductDesignDigest(humanReceipts)
    }
  });
  return { readiness, findings: normalizedFindings };
}

export function verifyProductDesignReadiness(input) {
  if (!isObject(input?.readiness)) throw new Error("verify input requires product-design-readiness.");
  const evaluated = evaluateProductDesignReadiness(input);
  const supplied = input.readiness;
  const findings = [...evaluated.findings];
  if (supplied.artifactKind !== "product-design-readiness"
    || !artifactDigestIsCurrent(supplied)
    || supplied.semanticDigest !== evaluated.readiness.semanticDigest) {
    findings.push(finding("PDA-06", "Product Design Readiness is stale against its current governed dependencies."));
  }
  const normalizedFindings = uniqueFindings(findings);
  return {
    artifactKind: "product-design-verification",
    schemaVersion: "1.0.0",
    status: normalizedFindings.length === 0 ? "passed" : "stale",
    readinessDigest: String(supplied.semanticDigest ?? ""),
    expectedReadinessDigest: evaluated.readiness.semanticDigest,
    findings: normalizedFindings
  };
}

export function validateProductDesignReadinessReceipt(receipt, expected = {}) {
  const errors = [];
  let stale = false;
  if (!isObject(receipt) || receipt.artifactKind !== "product-design-readiness") {
    errors.push("artifact kind is not product-design-readiness");
  }
  if (!artifactDigestIsCurrent(receipt)) {
    errors.push("product design readiness semantic digest is stale");
    stale = true;
  }
  if (receipt?.visualDirectionSelectedBy !== "agent") {
    errors.push("visual direction was not selected by the agent Design Authority");
  }
  if (expected.subject && !sameSubject(expected.subject, receipt?.subject)) {
    errors.push("product design readiness subject is stale");
    stale = true;
  }
  if (expected.policyDigest && receipt?.policyDigest !== expected.policyDigest) {
    errors.push("product design readiness policy digest is stale");
    stale = true;
  }
  if (!Array.isArray(receipt?.blockingFindingIds)) {
    errors.push("product design readiness blocking findings are invalid");
  }
  const valid = errors.length === 0;
  return {
    valid,
    passed: valid && receipt.status === "passed" && receipt.blockingFindingIds.length === 0,
    stale,
    status: String(receipt?.status ?? "invalid"),
    digest: String(receipt?.semanticDigest ?? ""),
    errors
  };
}

export function deriveAssetRequirements(input) {
  if (!isObject(input)) throw new Error("asset requirements input must be a JSON object.");
  const assets = Array.isArray(input.assets) ? input.assets : [];
  const invalidAssets = assets.filter((asset) =>
    !String(asset?.id ?? "").trim()
    || !String(asset?.function ?? "").trim()
    || !["expressive", "factual", "legal", "essential"].includes(asset?.essentiality)
    || typeof asset?.equivalentAvailable !== "boolean"
    || typeof asset?.materialLossWithoutAsset !== "boolean"
    || !isObject(asset?.acceptance)
  );
  const findings = [];
  if (assets.length === 0 || invalidAssets.length > 0) {
    findings.push(finding("PDA-09", "Asset requirements must prove a real function and executable acceptance contract."));
  }
  const requirements = artifact("asset-requirements", {
    subject: subjectFrom(input),
    briefDigest: String(input.briefDigest ?? ""),
    decisionDigest: String(input.decisionDigest ?? ""),
    assets
  });
  return { requirements, findings: uniqueFindings(findings) };
}

function meaningfulRequestField(input, field) {
  const value = input[field];
  if (Array.isArray(value)) return value.length > 0;
  if (isObject(value)) return Object.keys(value).length > 0;
  if (typeof value === "boolean") return field === "rightsDeclarationRequired" ? value : true;
  if (typeof value === "number") return Number.isFinite(value) && value > 0;
  return String(value ?? "").trim().length >= 3;
}

export function createAssetAcquisitionRequest(input) {
  if (!isObject(input)) throw new Error("asset acquisition request input must be a JSON object.");
  const findings = [];
  const assets = Array.isArray(input?.requirements?.assets) ? input.requirements.assets : [];
  const target = assets.find((asset) => asset.id === input.assetId);
  const rejected = Array.isArray(input?.research?.rejectedCandidates)
    ? input.research.rejectedCandidates.filter((candidate) => candidate.assetId === input.assetId)
    : [];
  const rejectionCodes = [...new Set(rejected.map((candidate) => candidate.reasonCode).filter((code) => ASSET_REJECTION_REASON_CODES.has(code)))].sort();
  const network = input?.research?.network ?? {};
  const researchProved = network.status === "passed"
    || (network.status === "not-run" && String(network.attemptedCommand ?? "").trim().length > 0);
  const incomplete = ASSET_REQUEST_REQUIRED_FIELDS.some((field) => !meaningfulRequestField(input, field));
  const vague = /\b(?:bonit[ao]|bacana|legal|moderna?)\b/i.test(`${input.purpose ?? ""} ${input.message ?? ""} ${input.positivePrompt ?? ""}`)
    && String(input.positivePrompt ?? "").trim().split(/\s+/).length < 8;

  if (!target || target.equivalentAvailable !== false || target.materialLossWithoutAsset !== true
    || rejected.length === 0 || rejected.length !== rejectionCodes.length || !researchProved || incomplete || vague) {
    findings.push(finding("PDA-09", "Human asset fallback requires proven need, exhausted research and a complete executable briefing."));
  }

  const request = artifact("asset-acquisition-request", {
    subject: subjectFrom(input),
    assetId: String(input.assetId ?? "unknown"),
    attempt: Number(input.attempt ?? 1),
    requirementsDigest: String(input?.requirements?.semanticDigest ?? ""),
    researchDigest: String(input?.research?.semanticDigest ?? ""),
    purpose: input.purpose,
    targetScreen: input.targetScreen,
    message: input.message,
    type: input.type,
    subjectDescription: input.subjectDescription,
    environment: input.environment,
    action: input.action,
    emotion: input.emotion,
    realism: input.realism,
    composition: input.composition,
    palette: input.palette,
    requiredElements: input.requiredElements,
    prohibitedElements: input.prohibitedElements,
    representationRisks: input.representationRisks,
    generationConstraints: input.generationConstraints,
    delivery: input.delivery,
    crops: input.crops,
    positivePrompt: input.positivePrompt,
    negativePrompt: input.negativePrompt,
    recommendedVariations: input.recommendedVariations,
    altTextIntent: input.altTextIntent,
    acceptanceChecklist: input.acceptanceChecklist,
    expectedFileName: input.expectedFileName,
    expectedDestination: input.expectedDestination,
    rightsDeclarationRequired: input.rightsDeclarationRequired,
    rejectionReasonCodes: rejectionCodes
  });
  return { request, findings: uniqueFindings(findings) };
}

function inspectPng(buffer) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length < 33 || !buffer.subarray(0, 8).equals(signature)) return null;
  if (buffer.toString("ascii", 12, 16) !== "IHDR" || !buffer.includes(Buffer.from("IEND"))) return { corrupt: true, mime: "image/png" };
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (width < 1 || height < 1) return { corrupt: true, mime: "image/png" };
  const metadataChunks = [];
  let offset = 8;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    if (offset + 12 + length > buffer.length) return { corrupt: true, mime: "image/png" };
    const chunkPayload = buffer.subarray(offset + 4, offset + 8 + length);
    const storedCrc = buffer.readUInt32BE(offset + 8 + length);
    if (pngCrc32(chunkPayload) !== storedCrc) return { corrupt: true, mime: "image/png" };
    if (["eXIf", "iTXt", "tEXt", "zTXt"].includes(type)) metadataChunks.push(type);
    offset += 12 + length;
    if (type === "IEND") return { corrupt: false, mime: "image/png", width, height, metadataChunks };
  }
  return { corrupt: true, mime: "image/png" };
}

function inspectJpeg(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  if (buffer[buffer.length - 2] !== 0xff || buffer[buffer.length - 1] !== 0xd9) return { corrupt: true, mime: "image/jpeg" };
  let offset = 2;
  let width = 0;
  let height = 0;
  const metadataChunks = [];
  while (offset + 4 < buffer.length) {
    if (buffer[offset] !== 0xff) { offset += 1; continue; }
    const marker = buffer[offset + 1];
    if (marker === 0xd9 || marker === 0xda) break;
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > buffer.length) return { corrupt: true, mime: "image/jpeg" };
    if (marker === 0xe1 || marker === 0xed) metadataChunks.push(marker === 0xe1 ? "APP1/EXIF" : "APP13/IPTC");
    if ([0xc0, 0xc1, 0xc2].includes(marker) && length >= 7) {
      height = buffer.readUInt16BE(offset + 5);
      width = buffer.readUInt16BE(offset + 7);
    }
    offset += 2 + length;
  }
  return width > 0 && height > 0
    ? { corrupt: false, mime: "image/jpeg", width, height, metadataChunks }
    : { corrupt: true, mime: "image/jpeg" };
}

function inspectImage(buffer) {
  return inspectPng(buffer) ?? inspectJpeg(buffer) ?? { corrupt: true, mime: "application/octet-stream" };
}

function extensionMatches(filePath, mime) {
  const extension = path.extname(filePath).toLowerCase();
  return mime === "image/png" ? extension === ".png" : mime === "image/jpeg" && [".jpg", ".jpeg"].includes(extension);
}

function ratioFrom(value) {
  const match = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(String(value ?? ""));
  return match ? Number(match[1]) / Number(match[2]) : null;
}

function pngCrc32(buffer) {
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
  chunk.writeUInt32BE(pngCrc32(Buffer.concat([name, data])), data.length + 8);
  return chunk;
}

function decodePngRows(buffer) {
  if (buffer.length < 33 || buffer.toString("ascii", 12, 16) !== "IHDR") return null;
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const bitDepth = buffer[24];
  const colorType = buffer[25];
  const interlace = buffer[28];
  const bytesPerPixel = new Map([[0, 1], [2, 3], [4, 2], [6, 4]]).get(colorType);
  if (bitDepth !== 8 || interlace !== 0 || !bytesPerPixel) return null;
  const chunks = [];
  let offset = 8;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    if (offset + 12 + length > buffer.length) return null;
    if (type === "IDAT") chunks.push(buffer.subarray(offset + 8, offset + 8 + length));
    offset += 12 + length;
    if (type === "IEND") break;
  }
  let encoded;
  try {
    encoded = zlib.inflateSync(Buffer.concat(chunks));
  } catch {
    return null;
  }
  const stride = width * bytesPerPixel;
  if (encoded.length !== height * (stride + 1)) return null;
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    const filter = encoded[y * (stride + 1)];
    const source = encoded.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const row = Buffer.alloc(stride);
    const previous = rows[y - 1] ?? Buffer.alloc(stride);
    for (let x = 0; x < stride; x += 1) {
      const left = x >= bytesPerPixel ? row[x - bytesPerPixel] : 0;
      const up = previous[x];
      const upLeft = x >= bytesPerPixel ? previous[x - bytesPerPixel] : 0;
      const predictor = left + up - upLeft;
      const pa = Math.abs(predictor - left);
      const pb = Math.abs(predictor - up);
      const pc = Math.abs(predictor - upLeft);
      const paeth = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      const prior = filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? up : filter === 3 ? Math.floor((left + up) / 2) : filter === 4 ? paeth : NaN;
      if (!Number.isFinite(prior)) return null;
      row[x] = (source[x] + prior) & 0xff;
    }
    rows.push(row);
  }
  return { width, height, bitDepth, colorType, bytesPerPixel, rows };
}

function cropAnchorOffset(available, focalPoint) {
  if (/left|top/i.test(focalPoint)) return 0;
  if (/right|bottom/i.test(focalPoint)) return available;
  return Math.floor(available / 2);
}

function createPngCrop(buffer, aspectRatio, focalPoint) {
  const decoded = decodePngRows(buffer);
  const ratio = ratioFrom(aspectRatio);
  if (!decoded || !ratio) return null;
  let cropWidth = decoded.width;
  let cropHeight = decoded.height;
  if (decoded.width / decoded.height > ratio) cropWidth = Math.max(1, Math.floor(decoded.height * ratio));
  else cropHeight = Math.max(1, Math.floor(decoded.width / ratio));
  const x = cropAnchorOffset(decoded.width - cropWidth, String(focalPoint ?? "center"));
  const y = cropAnchorOffset(decoded.height - cropHeight, String(focalPoint ?? "center"));
  const rawRows = [];
  for (let rowIndex = y; rowIndex < y + cropHeight; rowIndex += 1) {
    const start = x * decoded.bytesPerPixel;
    rawRows.push(Buffer.concat([Buffer.from([0]), decoded.rows[rowIndex].subarray(start, start + cropWidth * decoded.bytesPerPixel)]));
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(cropWidth, 0);
  header.writeUInt32BE(cropHeight, 4);
  header[8] = decoded.bitDepth;
  header[9] = decoded.colorType;
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const output = Buffer.concat([
    signature,
    pngChunk("IHDR", header),
    pngChunk("IDAT", zlib.deflateSync(Buffer.concat(rawRows))),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
  return { buffer: output, width: cropWidth, height: cropHeight, crop: { x, y, width: cropWidth, height: cropHeight } };
}

export function deriveAssetFailureDisposition({ attempt, essentiality }) {
  if (Number(attempt) <= 0) return "request";
  if (Number(attempt) === 1) return "corrected-request";
  return essentiality === "expressive" ? "recompose-without-asset" : "blocked";
}

export function selectProductAssetCandidate(input) {
  if (!isObject(input)) throw new Error("asset candidate selection input must be a JSON object.");
  const findings = [];
  const candidates = Array.isArray(input.candidates) ? input.candidates : [];
  const complete = candidates.filter((candidate) =>
    String(candidate?.id ?? "").trim()
    && /^[a-f0-9]{64}$/.test(String(candidate?.sidecarDigest ?? ""))
    && Array.isArray(candidate?.criteria)
    && candidate.criteria.length >= 3
    && candidate.criteria.every((criterion) => Number(criterion?.weight) > 0
      && Number(criterion?.score) >= 0 && Number(criterion?.score) <= 10
      && String(criterion?.evidenceRef ?? "").trim())
    && candidate.meaningPreserved === true);
  if (candidates.length < 2 || complete.length !== candidates.length) {
    findings.push(finding("PDA-10", "Asset alternatives require verified sidecars, objective criteria and meaning-preservation evidence."));
  }
  const ranked = complete.map((candidate) => ({
    id: String(candidate.id),
    sidecarDigest: String(candidate.sidecarDigest),
    score: candidateObjectiveScore(candidate),
    criteria: candidate.criteria
  })).sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
  const normalizedFindings = uniqueFindings(findings);
  return {
    selection: normalizedFindings.length === 0 ? artifact("product-asset-selection", {
      subject: subjectFrom(input),
      requestDigest: String(input.requestDigest ?? ""),
      selectedCandidateId: ranked[0].id,
      selectedBy: "agent",
      alternatives: ranked.map((candidate, index) => ({ ...candidate, status: index === 0 ? "selected" : "rejected" }))
    }) : null,
    findings: normalizedFindings
  };
}

export function deriveProductDesignShadowComparison(input) {
  if (!isObject(input)) throw new Error("product design shadow comparison input must be a JSON object.");
  const legacyAestheticGate = input?.legacy?.decisionOwner === "human"
    && ["visual-preference", "probe-selection", "aesthetic-approval"].includes(input?.legacy?.decisionKind);
  const controllerAutonomous = input?.controller?.visualDirectionSelectedBy === "agent"
    && input?.controller?.autonomyClass === "design-authority-bounded"
    && input?.controller?.disposition === "AUTONOMOUS_WITH_AUDIT";
  return artifact("product-design-shadow-comparison", {
    subject: subjectFrom(input),
    rollout: { authority: "shadow", research: "shadow", assets: "shadow", "human-scope": "shadow" },
    legacy: {
      aestheticGateRequested: legacyAestheticGate,
      decisionKind: String(input?.legacy?.decisionKind ?? "none"),
      decisionOwner: String(input?.legacy?.decisionOwner ?? "none")
    },
    controller: {
      autonomousSelection: controllerAutonomous,
      visualDirectionSelectedBy: String(input?.controller?.visualDirectionSelectedBy ?? "unknown"),
      autonomyClass: String(input?.controller?.autonomyClass ?? "unknown"),
      disposition: String(input?.controller?.disposition ?? "unknown")
    },
    delta: legacyAestheticGate && controllerAutonomous
      ? "legacy-human-aesthetic-gate-replaced-by-agent-audited-decision"
      : "no-proven-authority-delta",
    status: legacyAestheticGate && controllerAutonomous ? "passed" : "failed"
  });
}

export function ingestProductAsset(input) {
  if (!isObject(input)) throw new Error("asset ingest input must be a JSON object.");
  const findings = [];
  let buffer = Buffer.alloc(0);
  try {
    buffer = fs.readFileSync(path.resolve(input.filePath));
  } catch {
    findings.push(finding("PDA-10", "The delivered asset cannot be read."));
  }
  const image = inspectImage(buffer);
  const delivery = input?.request?.delivery ?? {};
  const expectedRatio = ratioFrom(input?.request?.composition?.aspectRatio);
  const actualRatio = image.width && image.height ? image.width / image.height : null;
  const extensionOk = extensionMatches(String(input.filePath ?? ""), image.mime);
  const allowedFormat = Array.isArray(delivery.formats)
    && delivery.formats.map((format) => String(format).toLowerCase()).some((format) =>
      (image.mime === "image/png" && format === "png") || (image.mime === "image/jpeg" && ["jpg", "jpeg"].includes(format))
    );
  if (image.corrupt || !extensionOk || !allowedFormat
    || buffer.length > Number(delivery.maximumBytes ?? 0)
    || Number(image.width ?? 0) < Number(delivery.minimumWidth ?? 0)
    || Number(image.height ?? 0) < Number(delivery.minimumHeight ?? 0)
    || (expectedRatio && actualRatio && Math.abs(expectedRatio - actualRatio) > 0.02)) {
    findings.push(finding("PDA-10", "The delivered asset MIME, integrity, dimensions, ratio or byte budget does not match the briefing."));
  }

  const rights = input.rightsAttestation ?? {};
  const license = input.license ?? {};
  if (rights.rightToUse !== true || !String(rights.origin ?? "").trim() || !String(rights.attestedAt ?? "").trim()
    || !AUTOMATIC_LICENSE_ALLOWLIST.has(license.id) || !String(license.sourceUrl ?? "").trim() || !String(license.verifiedAt ?? "").trim()) {
    findings.push(finding("PDA-08", "The delivered asset requires verified rights and an allowlisted license or human legal resolution.", {
      decisionClass: "legal-consequential",
      route: "HUMAN_REQUIRED"
    }));
  }

  const inspection = input.inspection ?? {};
  const inspected = ["browser-derived", "ocr-derived", "manual-reviewed-with-evidence"].includes(inspection.provenance);
  const sensitive = Array.isArray(inspection.sensitiveMetadataDetected) ? inspection.sensitiveMetadataDetected : ["inspection-missing"];
  const visibleText = Array.isArray(inspection.visibleText) ? inspection.visibleText : ["inspection-missing"];
  const logos = Array.isArray(inspection.logos) ? inspection.logos : ["inspection-missing"];
  const persons = Array.isArray(inspection.persons) ? inspection.persons : ["inspection-missing"];
  if (!inspected || inspection.contentMatches !== true || inspection.compositionMatches !== true
    || sensitive.length > 0 || visibleText.length > 0 || logos.length > 0 || persons.length > 0
    || (image.metadataChunks ?? []).length > 0 || !String(inspection.altText ?? "").trim()) {
    findings.push(finding("PDA-10", "Content, composition, visible text, people, logos and sensitive metadata must be inspected and sanitized before approval."));
  }

  const disposition = deriveAssetFailureDisposition({
    attempt: Number(input?.request?.attempt ?? 1),
    essentiality: String(input.essentiality ?? "expressive")
  });
  const fileDigest = crypto.createHash("sha256").update(buffer).digest("hex");
  const requestedCrops = Array.isArray(input?.request?.crops) ? input.request.crops : [];
  const generatedFiles = [];
  const variants = [];
  if (findings.length === 0) {
    for (const requestedCrop of requestedCrops) {
      const target = String(requestedCrop?.target ?? "variant").replace(/[^a-z0-9_-]+/gi, "-").toLowerCase();
      const generated = image.mime === "image/png"
        ? createPngCrop(buffer, requestedCrop?.aspectRatio, requestedCrop?.focalPoint ?? input?.request?.composition?.focalPoint)
        : null;
      if (!generated) {
        findings.push(finding("PDA-10", "The controller could not produce every requested crop from the delivered asset.", { targetId: target }));
        continue;
      }
      const fileName = `${String(input?.request?.assetId ?? "asset")}.${target}.png`;
      const variantDigest = crypto.createHash("sha256").update(generated.buffer).digest("hex");
      variants.push({
        id: target,
        fileName,
        fileDigest: variantDigest,
        mime: "image/png",
        width: generated.width,
        height: generated.height,
        crop: { ...generated.crop, aspectRatio: String(requestedCrop.aspectRatio ?? "") },
        meaningPreserved: inspection.contentMatches === true && inspection.compositionMatches === true
      });
      generatedFiles.push({ fileName, buffer: generated.buffer });
    }
  }
  const sidecar = artifact("approved-product-asset", {
    subject: subjectFrom(input),
    assetId: String(input?.request?.assetId ?? "unknown"),
    requestDigest: String(input?.request?.semanticDigest ?? ""),
    fileDigest,
    mime: image.mime,
    width: Number(image.width ?? 0),
    height: Number(image.height ?? 0),
    bytes: buffer.length,
    license,
    rightsAttestation: rights,
    attribution: String(input.attribution ?? rights.attestedBy ?? rights.origin ?? ""),
    variants,
    altText: String(inspection.altText ?? input?.request?.altTextIntent ?? ""),
    sensitiveMetadataRemoved: (image.metadataChunks ?? []).length === 0 && sensitive.length === 0
  });
  return { sidecar, generatedFiles, findings: uniqueFindings(findings), disposition };
}

export function verifyAssetInventory({ root, sourceDirectories, assets }) {
  const findings = [];
  const references = new Set();
  if (!Array.isArray(sourceDirectories) || !sourceDirectories.length || !Array.isArray(assets)) throw new Error("Asset verification requires frozen source directories and asset inventory");
  const sourceFiles = [];
  const visit = file => {
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink()) { findings.push(finding("PDA-10", "Asset source inventory cannot silently traverse symlinks.")); return; }
    if (stat.isDirectory()) { for (const entry of fs.readdirSync(file)) if (!["node_modules", ".git"].includes(entry)) visit(path.join(file, entry)); return; }
    if (/\.(?:[cm]?[jt]sx?|css|scss|html|vue|svelte|json)$/i.test(file)) sourceFiles.push(file);
  };
  for (const ref of sourceDirectories) {
    const directory = projectFile(root, ref);
    if (!fs.existsSync(directory)) throw new Error(`Frozen asset source directory missing: ${ref}`);
    visit(directory);
  }
  for (const file of sourceFiles) {
    const source = fs.readFileSync(file, "utf8");
    for (const match of source.matchAll(/["'`(]([^"'`)\s]+\.(?:png|jpe?g|gif|webp|svg|avif|ico)(?:\?[^"'`)\s]*)?)["'`)]/gi)) {
      const ref = match[1].split("?")[0];
      references.add(/^https?:\/\//.test(ref) || ref.startsWith("/") ? ref : path.relative(root, path.resolve(path.dirname(file), ref)).split(path.sep).join("/"));
    }
    for (const match of source.matchAll(/\burl\(\s*["']?([^"')\s]+)["']?\s*\)/gi)) {
      const ref = match[1].split("?")[0];
      references.add(/^https?:\/\//.test(ref) || ref.startsWith("/") ? ref : path.relative(root, path.resolve(path.dirname(file), ref)).split(path.sep).join("/"));
    }
    // Image endpoints and srcsets need not have a file extension.
    for (const tag of source.matchAll(/<(?:img|Image|source)\b[^>]*>/g)) {
      for (const attribute of tag[0].matchAll(/\b(src|srcset|srcSet)\s*=\s*["']([^"']+)["']/g)) {
        const refs = attribute[1] === "src" ? [attribute[2]] : attribute[2].split(",").map(value => value.trim().split(/\s+/)[0]);
        for (const ref of refs) references.add(/^https?:\/\//.test(ref) || ref.startsWith("/") ? ref : path.relative(root, path.resolve(path.dirname(file), ref.split("?")[0])).split(path.sep).join("/"));
      }
    }
    if (/<(?:img|Image|source)\b[^>]*\b(?:src|srcSet)\s*=\s*\{|url\(\s*var\(/.test(source)) findings.push(finding("PDA-10", "Dynamic image reference requires a resolved source contract; inventory cannot prove absence."));
  }
  for (const ref of references) {
    const entry = assets.find(asset => asset.ref === ref);
    if (!entry) { findings.push(finding("PDA-10", `Referenced asset omitted from inventory: ${ref}`)); continue; }
    try {
      if (/^https?:\/\//.test(ref)) throw new Error("Remote image must be ingested and referenced locally before release verification");
      const expectedFile = ref.startsWith("/") ? `public${ref}` : ref;
      if (path.resolve(root, entry.file) !== path.resolve(root, expectedFile)) throw new Error("Inventory file differs from referenced product asset");
      const bytes = fs.readFileSync(projectFile(root, entry.file));
      const sidecar = JSON.parse(fs.readFileSync(projectFile(root, entry.sidecar), "utf8"));
      if (sidecar.artifactKind !== "approved-product-asset" || !artifactDigestIsCurrent(sidecar) || sidecar.fileDigest !== digest(bytes) || sidecar.rightsAttestation?.rightToUse !== true || !AUTOMATIC_LICENSE_ALLOWLIST.has(sidecar.license?.id) || !sidecar.license?.sourceUrl || !sidecar.license?.verifiedAt || !sidecar.rightsAttestation?.origin || !sidecar.rightsAttestation?.attestedAt || !sidecar.altText || sidecar.bytes !== bytes.length || sidecar.sensitiveMetadataRemoved !== true) throw new Error("Asset bytes or approved provenance do not match");
    } catch (error) { findings.push(finding("PDA-10", `${ref}: ${error.message}`)); }
  }
  if (assets.some(asset => !references.has(asset.ref))) findings.push(finding("PDA-10", "Inventory contains assets not referenced by the frozen source scope."));
  return { artifactKind: "asset-inventory-verification", status: findings.length ? "failed" : references.size ? "passed" : "not-applicable", references: [...references].sort(), findings };
}

function readJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 2) {
    const flag = rest[index];
    const value = rest[index + 1];
    if (!flag?.startsWith("--") || value === undefined) throw new Error(`Invalid argument near '${flag ?? "end"}'.`);
    options[flag.slice(2)] = value;
  }
  return { command, options };
}

function writeJson(outputDir, fileName, value) {
  fs.mkdirSync(outputDir, { recursive: true });
  const target = path.join(outputDir, fileName);
  const temporary = `${target}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, target);
}

function printUsage() {
  console.error("Usage: product-design-control.mjs <profile|compile|research|decide|request-asset|ingest-asset|gate|verify> --input <input.json> --output-dir <dir> [--root <project-root>]");
}

export function runCli(argv = process.argv.slice(2)) {
  let parsed;
  try {
    parsed = parseArgs(argv);
    const input = readJson(path.resolve(parsed.options.input), "input");
    const outputDir = path.resolve(parsed.options["output-dir"]);

    if (parsed.command === "profile") {
      const result = deriveProductDesignProfile(input);
      writeJson(outputDir, "product-design-profile.json", result.profile);
      writeJson(outputDir, "visual-research-plan.json", result.researchPlan);
      writeJson(outputDir, "product-design-findings.json", artifact("product-design-findings", {
        subject: result.profile.subject,
        findings: result.findings
      }));
      return result.findings.length === 0 ? 0 : 1;
    }

    if (parsed.command === "compile") {
      const result = compileProductDesignBrief(input);
      writeJson(outputDir, "product-design-brief.json", result.brief);
      writeJson(outputDir, "product-design-profile.json", result.profile);
      writeJson(outputDir, "visual-research-plan.json", result.researchPlan);
      writeJson(outputDir, "product-design-findings.json", artifact("product-design-findings", {
        subject: result.brief.subject,
        findings: result.findings
      }));
      return result.findings.length === 0 ? 0 : 1;
    }

    if (parsed.command === "research") {
      const result = validateVisualResearch(input);
      writeJson(outputDir, "visual-research.json", result.research);
      writeJson(outputDir, "product-design-findings.json", artifact("product-design-findings", {
        subject: result.research.subject,
        findings: result.findings
      }));
      return result.findings.length === 0 ? 0 : 1;
    }

    if (parsed.command === "decide") {
      const root = path.resolve(parsed.options.root ?? process.cwd());
      if (outputDir !== root && !outputDir.startsWith(`${root}${path.sep}`)) {
        throw new Error("decide output-dir must remain inside project root.");
      }
      const request = autonomyRequestFrom(input);
      writeJson(outputDir, "design-authority-autonomy-request.json", request);
      const requestRef = path.relative(root, path.join(outputDir, "design-authority-autonomy-request.json")).split(path.sep).join("/");
      const decisionRef = path.relative(root, path.join(outputDir, "design-authority-autonomy-decision.json")).split(path.sep).join("/");
      const governance = spawnSync(process.execPath, [
        path.join(root, "integrations/governance/governance-control.mjs"),
        "decide", "--root", root, "--request", requestRef, "--output", decisionRef
      ], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      if (governance.status !== 0) {
        throw new Error(`governance autonomy resolution failed: ${String(governance.stderr || governance.stdout).trim()}`);
      }
      const autonomyDecision = readJson(path.join(outputDir, "design-authority-autonomy-decision.json"), "autonomy decision");
      const result = compileProductDesignDecision(input, autonomyDecision);
      if (result.decision) writeJson(outputDir, "design-authority-decision.json", result.decision);
      writeJson(outputDir, "product-design-findings.json", artifact("product-design-findings", {
        subject: subjectFrom(input),
        findings: result.findings
      }));
      return result.findings.length === 0 ? 0 : 1;
    }

    if (parsed.command === "request-asset") {
      const result = createAssetAcquisitionRequest(input);
      if (result.findings.length === 0) writeJson(outputDir, "asset-acquisition-request.json", result.request);
      writeJson(outputDir, "product-design-findings.json", artifact("product-design-findings", {
        subject: result.request.subject,
        findings: result.findings
      }));
      return result.findings.length === 0 ? 0 : 1;
    }

    if (parsed.command === "verify-assets") {
      const root = path.resolve(parsed.options.root ?? process.cwd());
      const context = loadExecutionContext(root, parsed.options.feature);
      const result = verifyAssetInventory({ ...input, root, sourceDirectories: context.frontendPaths });
      writeJson(outputDir, "asset-inventory-verification.json", result);
      return result.status === "failed" ? 1 : 0;
    }

    if (parsed.command === "ingest-asset") {
      const result = ingestProductAsset(input);
      if (result.findings.length === 0) {
        fs.mkdirSync(outputDir, { recursive: true });
        for (const generatedFile of result.generatedFiles) {
          fs.writeFileSync(path.join(outputDir, generatedFile.fileName), generatedFile.buffer, { mode: 0o600 });
        }
        writeJson(outputDir, `${result.sidecar.assetId}.asset.json`, result.sidecar);
        const approvedName = path.basename(String(input?.request?.expectedFileName ?? path.basename(input.filePath)));
        fs.copyFileSync(path.resolve(input.filePath), path.join(outputDir, approvedName));
      }
      writeJson(outputDir, "product-design-findings.json", artifact("product-design-findings", {
        subject: result.sidecar.subject,
        findings: result.findings,
        disposition: result.disposition
      }));
      return result.findings.length === 0 ? 0 : 1;
    }

    if (parsed.command === "gate") {
      const result = evaluateProductDesignReadiness(input);
      writeJson(outputDir, "product-design-readiness.json", result.readiness);
      writeJson(outputDir, "product-design-findings.json", artifact("product-design-findings", {
        subject: result.readiness.subject,
        findings: result.findings
      }));
      if (result.readiness.status === "not-run") return 4;
      if (result.readiness.status === "stale") return 3;
      return result.readiness.status === "passed" ? 0 : 1;
    }

    if (parsed.command === "verify") {
      const result = verifyProductDesignReadiness(input);
      console.log(JSON.stringify(result, null, 2));
      return result.status === "passed" ? 0 : 3;
    }

    throw new Error(`Unsupported command '${parsed.command ?? ""}'.`);
  } catch (error) {
    printUsage();
    console.error(error.message);
    return 2;
  }
}

function isMainModule(realPath) {
  if (!process.argv[1]) return false;
  try {
    return fs.realpathSync(path.resolve(process.argv[1])) === realPath;
  } catch {
    return false;
  }
}

if (isMainModule(SCRIPT_PATH)) {
  process.exitCode = runCli();
}
