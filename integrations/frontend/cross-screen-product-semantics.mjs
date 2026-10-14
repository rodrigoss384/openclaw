import fs from "node:fs";
import path from "node:path";

const PRODUCT_SEMANTICS_SIGNAL = "productSemantics.evidenceRef";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizeRepoPath(value) {
  return String(value || "").split("#", 1)[0].replaceAll("\\", "/").replace(/^\.\//, "");
}

function resolveFrom(root, value) {
  const text = String(value || "");
  return path.isAbsolute(text) ? path.normalize(text) : path.resolve(root, text);
}

function stableObject(value) {
  if (Array.isArray(value)) return value.map(stableObject);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableObject(value[key])]));
}

function stableKey(value) {
  return JSON.stringify(stableObject(value));
}

function isApplicationShell(screen) {
  return screen?.screen?.category === "application-shell" || screen?.screen?.surface === "application-shell";
}

function companionRefFromEvidence(evidence) {
  const match = asArray(evidence?.presenceSignals)
    .find((entry) => entry?.signal === PRODUCT_SEMANTICS_SIGNAL && typeof entry?.value === "string" && entry.value.trim());
  return match?.value || null;
}

function subjectFor({ screen, evidence }) {
  const screenId = screen?.screen?.id || evidence?.meta?.screenId || "unknown-screen";
  const stateId = evidence?.meta?.stateId || "unknown-state";
  const themeId = evidence?.theme?.id || "unknown-theme";
  return `${screenId}/${stateId}/${themeId}`;
}

function loadSamples({ root, manifest }) {
  return asArray(manifest?.samples).map((sample) => {
    const screenPath = resolveFrom(root, sample.screenSpec);
    const evidencePath = resolveFrom(root, sample.evidence);
    const screen = readJson(screenPath);
    const evidence = readJson(evidencePath);
    const companionRef = companionRefFromEvidence(evidence);
    const companionPath = companionRef ? resolveFrom(root, normalizeRepoPath(companionRef)) : null;
    const companion = companionPath && fs.existsSync(companionPath) ? readJson(companionPath) : null;
    return {
      sample,
      screen,
      evidence,
      companion,
      companionRef,
      subject: subjectFor({ screen, evidence }),
      productContextRef: normalizeRepoPath(screen?.productContext?.source) || "<unscoped-product-context>",
      applicationShell: isApplicationShell(screen)
    };
  });
}

function finding(code, findingClass, summary, subjects, affectedContracts, revalidationSet) {
  return {
    code,
    class: findingClass,
    defectKind: "contract",
    summary,
    subjects: [...new Set(subjects)],
    affectedContracts: [...new Set(affectedContracts)],
    revalidationSet: [...new Set(revalidationSet)]
  };
}

function semanticFindings(samples) {
  const result = [];
  const byRole = new Map();
  for (const sample of samples) {
    for (const observation of asArray(sample.companion?.semanticDifferentiation?.observations)) {
      if (observation?.rendered !== true || !observation?.semanticRole || !observation?.presentationSignature) continue;
      if (!byRole.has(observation.semanticRole)) byRole.set(observation.semanticRole, new Map());
      const signatures = byRole.get(observation.semanticRole);
      const key = stableKey(observation.presentationSignature);
      if (!signatures.has(key)) signatures.set(key, []);
      signatures.get(key).push(sample.subject);
    }
  }

  for (const [role, signatures] of byRole) {
    if (signatures.size <= 1) continue;
    result.push(finding(
      "CROSS_SCREEN_SEMANTIC_SIGNATURE_DRIFT",
      "semantic-presentation",
      `Semantic role '${role}' renders more than one full presentationSignature across screens in the same visual family.`,
      [...signatures.values()].flat(),
      ["design-system", "screen-specification"],
      ["design-system", "screen-specification", "craft-contract", "product-semantics-evidence", "browser-evidence"]
    ));
  }
  return result;
}

function navigationSnapshot(section) {
  return asArray(section?.modules)
    .map((module) => ({
      id: module.id,
      capabilityRef: module.capabilityRef,
      availability: module.availability,
      presentation: module.presentation,
      rendered: module.rendered,
      navigable: module.navigable,
      destination: module.destination,
      reasonVisible: module.reasonVisible
    }))
    .sort((left, right) => String(left.id).localeCompare(String(right.id)));
}

function navigationFindings(samples) {
  const result = [];
  const groups = new Map();
  for (const sample of samples) {
    if (!groups.has(sample.productContextRef)) groups.set(sample.productContextRef, []);
    groups.get(sample.productContextRef).push(sample);
  }

  for (const [productContextRef, group] of groups) {
    const nonShellApplicable = group.filter((sample) => !sample.applicationShell && sample.companion?.navigation?.applicability === "required");
    if (nonShellApplicable.length) {
      result.push(finding(
        "CROSS_SCREEN_NAVIGATION_NON_SHELL_APPLICABLE",
        "wayfinding",
        `Navigation capability evidence for '${productContextRef}' is applicable outside the canonical application shell.`,
        nonShellApplicable.map((sample) => sample.subject),
        ["navigation-capability", "screen-specification", "product-context"],
        ["navigation-capability", "screen-specification", "product-semantics-evidence", "browser-evidence"]
      ));
    }

    const shellSamples = group.filter((sample) => sample.applicationShell);
    const applicableShells = shellSamples.filter((sample) => sample.companion?.navigation?.applicability === "required");
    if (!applicableShells.length) continue;

    const missing = shellSamples.filter((sample) => sample.companion?.navigation?.applicability !== "required");
    if (missing.length) {
      result.push(finding(
        "CROSS_SCREEN_NAVIGATION_APPLICABILITY_DRIFT",
        "wayfinding",
        `Application-shell samples for '${productContextRef}' disagree on whether the navigation capability contract is applicable.`,
        [...applicableShells, ...missing].map((sample) => sample.subject),
        ["navigation-capability", "screen-specification", "product-context"],
        ["navigation-capability", "screen-specification", "product-semantics-evidence", "browser-evidence"]
      ));
      continue;
    }

    const refs = new Map();
    const hashes = new Map();
    const presentations = new Map();
    for (const sample of applicableShells) {
      const section = sample.companion.navigation;
      const refKey = normalizeRepoPath(section.contractRef);
      if (!refs.has(refKey)) refs.set(refKey, []);
      refs.get(refKey).push(sample.subject);
      const hashKey = String(section.contractSha256 || "<missing>");
      if (!hashes.has(hashKey)) hashes.set(hashKey, []);
      hashes.get(hashKey).push(sample.subject);
      const presentationKey = stableKey(navigationSnapshot(section));
      if (!presentations.has(presentationKey)) presentations.set(presentationKey, []);
      presentations.get(presentationKey).push(sample.subject);
    }

    if (refs.size > 1) {
      result.push(finding(
        "CROSS_SCREEN_NAVIGATION_CONTRACT_REF_DRIFT",
        "wayfinding",
        `Application-shell samples for '${productContextRef}' resolve different navigation capability contracts.`,
        [...refs.values()].flat(),
        ["navigation-capability", "screen-specification", "product-context"],
        ["navigation-capability", "screen-specification", "product-semantics-evidence", "browser-evidence"]
      ));
    }
    if (hashes.size > 1) {
      result.push(finding(
        "CROSS_SCREEN_NAVIGATION_CONTRACT_HASH_DRIFT",
        "wayfinding",
        `Application-shell samples for '${productContextRef}' were captured against different navigation contract revisions.`,
        [...hashes.values()].flat(),
        ["navigation-capability"],
        ["navigation-capability", "product-semantics-evidence", "browser-evidence"]
      ));
    }
    if (presentations.size > 1) {
      result.push(finding(
        "CROSS_SCREEN_NAVIGATION_PRESENTATION_DRIFT",
        "wayfinding",
        `Application-shell samples for '${productContextRef}' disagree on navigation availability/presentation semantics.`,
        [...presentations.values()].flat(),
        ["navigation-capability", "screen-specification"],
        ["navigation-capability", "screen-specification", "product-semantics-evidence", "browser-evidence"]
      ));
    }
  }
  return result;
}

function retrievalSemantics(section) {
  const trigger = section?.trigger;
  const authorization = section?.resultAuthorization;
  return {
    applicability: section?.applicability ?? null,
    trigger: trigger ? {
      rendered: trigger.rendered,
      invocationMode: trigger.invocationMode,
      focusManaged: trigger.focusManaged,
      shortcutObserved: trigger.shortcutObserved
    } : null,
    authorization: authorization ? {
      authorizationMode: authorization.authorizationMode,
      authorizationFiltered: authorization.authorizationFiltered,
      tenantScopeValidated: authorization.tenantScopeValidated,
      unauthorizedResultCount: authorization.unauthorizedResultCount,
      resultAnnouncementObserved: authorization.resultAnnouncementObserved
    } : null
  };
}

function retrievalFindings(samples) {
  const result = [];
  const groups = new Map();
  for (const sample of samples) {
    if (!groups.has(sample.productContextRef)) groups.set(sample.productContextRef, []);
    groups.get(sample.productContextRef).push(sample);
  }

  for (const [productContextRef, group] of groups) {
    const nonShellApplicable = group.filter((sample) => {
      const section = sample.companion?.globalRetrieval;
      const applicability = section?.applicability;
      const renderedOptional = applicability === "optional" && section?.trigger !== null;
      return !sample.applicationShell && (applicability === "required" || renderedOptional);
    });
    if (nonShellApplicable.length) {
      result.push(finding(
        "CROSS_SCREEN_RETRIEVAL_NON_SHELL_APPLICABLE",
        "interaction-affordance",
        `Global retrieval for '${productContextRef}' is represented as a screen-local capability outside the application shell.`,
        nonShellApplicable.map((sample) => sample.subject),
        ["global-retrieval", "screen-specification", "product-context"],
        ["global-retrieval", "screen-specification", "product-semantics-evidence", "browser-evidence"]
      ));
    }

    const shellSamples = group.filter((sample) => sample.applicationShell);
    const applicableShells = shellSamples.filter((sample) => ["required", "optional"].includes(sample.companion?.globalRetrieval?.applicability));
    if (!applicableShells.length) continue;

    const missing = shellSamples.filter((sample) => !["required", "optional"].includes(sample.companion?.globalRetrieval?.applicability));
    if (missing.length) {
      result.push(finding(
        "CROSS_SCREEN_RETRIEVAL_APPLICABILITY_DRIFT",
        "interaction-affordance",
        `Application-shell samples for '${productContextRef}' disagree on global retrieval applicability.`,
        [...applicableShells, ...missing].map((sample) => sample.subject),
        ["global-retrieval", "screen-specification", "product-context"],
        ["global-retrieval", "screen-specification", "product-semantics-evidence", "browser-evidence"]
      ));
      continue;
    }

    const refs = new Map();
    const hashes = new Map();
    const semantics = new Map();
    for (const sample of applicableShells) {
      const section = sample.companion.globalRetrieval;
      const refKey = normalizeRepoPath(section.contractRef);
      if (!refs.has(refKey)) refs.set(refKey, []);
      refs.get(refKey).push(sample.subject);
      const hashKey = String(section.contractSha256 || "<missing>");
      if (!hashes.has(hashKey)) hashes.set(hashKey, []);
      hashes.get(hashKey).push(sample.subject);
      const semanticsKey = stableKey(retrievalSemantics(section));
      if (!semantics.has(semanticsKey)) semantics.set(semanticsKey, []);
      semantics.get(semanticsKey).push(sample.subject);
    }

    if (refs.size > 1) {
      result.push(finding(
        "CROSS_SCREEN_RETRIEVAL_CONTRACT_REF_DRIFT",
        "interaction-affordance",
        `Application-shell samples for '${productContextRef}' resolve different global retrieval contracts.`,
        [...refs.values()].flat(),
        ["global-retrieval", "screen-specification", "product-context"],
        ["global-retrieval", "screen-specification", "product-semantics-evidence", "browser-evidence"]
      ));
    }
    if (hashes.size > 1) {
      result.push(finding(
        "CROSS_SCREEN_RETRIEVAL_CONTRACT_HASH_DRIFT",
        "interaction-affordance",
        `Application-shell samples for '${productContextRef}' were captured against different global retrieval contract revisions.`,
        [...hashes.values()].flat(),
        ["global-retrieval"],
        ["global-retrieval", "product-semantics-evidence", "browser-evidence"]
      ));
    }
    if (semantics.size > 1) {
      result.push(finding(
        "CROSS_SCREEN_RETRIEVAL_SHELL_SEMANTICS_DRIFT",
        "interaction-affordance",
        `Application-shell samples for '${productContextRef}' disagree on global retrieval invocation/authorization semantics. Literal labels, current result state and result content are intentionally excluded from this comparison.`,
        [...semantics.values()].flat(),
        ["global-retrieval", "screen-specification", "global-retrieval-backend"],
        ["global-retrieval", "global-retrieval-backend", "screen-specification", "product-semantics-evidence", "browser-evidence"]
      ));
    }
  }
  return result;
}

export function validateCrossScreenProductSemantics({ root, manifest }) {
  const samples = loadSamples({ root, manifest });
  return [
    ...semanticFindings(samples),
    ...navigationFindings(samples),
    ...retrievalFindings(samples)
  ];
}
