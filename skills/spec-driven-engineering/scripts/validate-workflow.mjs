#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { parseArgs, printReport, readJson } from "./lib/workflow-utils.mjs";
import { validateJsonSchema, validateSchemaSupport } from "./lib/json-schema.mjs";

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(String(args.root || process.cwd()));
const manifestPath = path.join(root, "prompts/spec-driven/manifest.json");
const manifestSchemaPath = path.join(root, "prompts/spec-driven/manifest.schema.json");
const errors = [];
const warnings = [];
const information = [];
const forbiddenInstallFragment = [".agents", "skills"].join("/") + "/";

function skillNamesUnder(directory) {
  const names = new Set();
  if (!directory || !fs.existsSync(directory)) return names;
  const pending = [directory];
  while (pending.length) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const child = path.join(current, entry.name);
      const skillFile = path.join(child, "SKILL.md");
      if (fs.existsSync(skillFile)) {
        const frontmatterName = fs.readFileSync(skillFile, "utf8").match(/^name:\s*([^\n]+)$/m)?.[1]?.trim();
        names.add(frontmatterName || entry.name);
      } else if (!entry.name.startsWith(".")) {
        pending.push(child);
      }
    }
  }
  return names;
}

const FRONTEND_CANONICAL_WORKFLOW = [
  "DISCOVER", "PRIORITIZE", "VISUAL DIRECTION", "COMPOSITION PROOF", "CLASSIFY",
  "RECIPE", "TOKENS", "COMPONENT MAP", "PLAN", "SMALL SLICE", "BUILD", "BROWSER",
  "SCREENSHOTS", "COMPOSITION AUDIT", "DS AUDIT", "PATCH", "REPORT"
];

function normalizeStageToken(token) {
  return token
    .replace(/`/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .replace("DESIGN-SYSTEM AUDIT", "DS AUDIT");
}

function extractCanonicalSequences(content) {
  const raw = [];
  for (const match of content.matchAll(/```text\n(DISCOVER[\s\S]*?REPORT)\n```/g)) {
    raw.push(match[1]);
  }
  for (const match of content.matchAll(/`(DISCOVER(?:\s*(?:->|→)\s*[A-Z][A-Z0-9 -]*?)*\s*(?:->|→)\s*REPORT)`/g)) {
    raw.push(match[1]);
  }
  return raw
    .filter((sequence) => sequence.includes("VISUAL DIRECTION"))
    .map((sequence) => sequence.split(/->|→/).map(normalizeStageToken).filter(Boolean));
}

function checkFrontendCanonicalWorkflowConsistency(root) {
  const sources = [
    "skills/frontend-product-builder/SKILL.md",
    "rules.md",
    "skills/spec-driven-engineering/SKILL.md",
    "skills/spec-driven-engineering/references/frontend-overlay.md"
  ];

  let anyFound = false;
  for (const relativeSource of sources) {
    const sourcePath = path.join(root, relativeSource);
    if (!fs.existsSync(sourcePath)) {
      errors.push(`FRONTEND_CANONICAL_WORKFLOW source not found: ${relativeSource}`);
      continue;
    }
    const content = fs.readFileSync(sourcePath, "utf8");
    const sequences = extractCanonicalSequences(content);
    if (sequences.length === 0) {
      errors.push(`${relativeSource} does not declare the FRONTEND_CANONICAL_WORKFLOW sequence (expected DISCOVER…REPORT, fenced or inline-code)`);
      continue;
    }
    anyFound = true;
    sequences.forEach((sequence, index) => {
      const occurrenceLabel = sequences.length > 1 ? `${relativeSource} (occurrence ${index + 1})` : relativeSource;
      if (JSON.stringify(sequence) !== JSON.stringify(FRONTEND_CANONICAL_WORKFLOW)) {
        errors.push(
          `${occurrenceLabel} declares a workflow sequence that diverges from FRONTEND_CANONICAL_WORKFLOW.\n  expected: ${FRONTEND_CANONICAL_WORKFLOW.join(" → ")}\n  actual:   ${sequence.join(" → ")}`
        );
      }
    });
  }
  if (anyFound) {
    information.push(`FRONTEND_CANONICAL_WORKFLOW consistency checked across ${sources.length} sources.`);
  }
}

if (!fs.existsSync(manifestPath)) {
  errors.push(`Manifest not found: ${manifestPath}`);
} else {
  let manifest;
  try {
    manifest = readJson(manifestPath);
  } catch (error) {
    errors.push(`Manifest is invalid JSON: ${error.message}`);
  }

  if (manifest) {
    if (!fs.existsSync(manifestSchemaPath)) {
      errors.push(`Manifest schema not found: ${manifestSchemaPath}`);
    } else {
      try {
        const schema = readJson(manifestSchemaPath);
        for (const error of validateSchemaSupport(schema)) errors.push(`Manifest schema definition: ${error}`);
        for (const error of validateJsonSchema(manifest, schema)) errors.push(`Manifest schema: ${error}`);
      } catch (error) {
        errors.push(`Manifest schema is invalid JSON or unsupported: ${error.message}`);
      }
    }

    const requiredKeys = [
      "workflowVersion",
      "orchestratorSkill",
      "consumerRuntime",
      "sharedRules",
      "contextBootstrap",
      "placeholderPolicy",
      "frontendStylingPolicy",
      "frontendCompositionPolicy",
      "frontendUiControlPolicy",
      "artifactSequence",
      "complexityPolicy",
      "criticalityPolicy",
      "gates",
      "skillRoutes",
      "sessionClosure",
      "prompts"
    ];
    for (const key of requiredKeys) {
      if (!(key in manifest)) errors.push(`Manifest key is missing: ${key}`);
    }
    if (manifest.orchestratorSkill !== "spec-driven-engineering") {
      errors.push("orchestratorSkill must be spec-driven-engineering");
    }
    if (manifest.workflowVersion !== "2.4.0") {
      errors.push("workflowVersion must be 2.4.0");
    }

    const consumerRuntime = manifest.consumerRuntime;
    const expectedConsumerRuntime = {
      sourceOfTruth: "this-repository",
      installationModel: "versioned-managed-copy",
      distributionManifest: "prompts/spec-driven/consumer-runtime.manifest.json",
      installer: "skills/spec-driven-engineering/scripts/consumer-runtime.mjs",
      batchInstaller: "skills/spec-driven-engineering/scripts/consumer-runtime-all.mjs",
      state: ".specs/workflow-runtime-install.json",
      stateSchema: "skills/spec-driven-engineering/assets/consumer-runtime-install.schema.json",
      guide: "prompts/spec-driven/CONSUMER-RUNTIME.md"
    };
    for (const [key, expected] of Object.entries(expectedConsumerRuntime)) {
      if (consumerRuntime?.[key] !== expected) errors.push(`consumerRuntime.${key} must be ${expected}`);
      else if (!["sourceOfTruth", "installationModel", "state"].includes(key) && !fs.existsSync(path.join(root, expected))) {
        errors.push(`consumerRuntime.${key} does not resolve to a repository file: ${expected}`);
      }
    }
    if (JSON.stringify(consumerRuntime?.commands || []) !== JSON.stringify(["install", "update", "check", "uninstall"])) {
      errors.push("consumerRuntime.commands must be install, update, check, uninstall in order");
    }
    if (JSON.stringify(consumerRuntime?.batchCommands || []) !== JSON.stringify(["sync", "install", "update", "check"])) {
      errors.push("consumerRuntime.batchCommands must be sync, install, update, check in order");
    }
    if (consumerRuntime?.defaultProjectsRoot !== "../projetos") errors.push("consumerRuntime.defaultProjectsRoot must be ../projetos");
    const consumerManifestPath = path.join(root, expectedConsumerRuntime.distributionManifest);
    const consumerManifestSchemaPath = path.join(root, "prompts/spec-driven/consumer-runtime.manifest.schema.json");
    if (fs.existsSync(consumerManifestPath) && fs.existsSync(consumerManifestSchemaPath)) {
      try {
        const consumerManifest = readJson(consumerManifestPath);
        const consumerManifestSchema = readJson(consumerManifestSchemaPath);
        for (const error of validateSchemaSupport(consumerManifestSchema)) errors.push(`Consumer runtime manifest schema definition: ${error}`);
        for (const error of validateJsonSchema(consumerManifest, consumerManifestSchema)) errors.push(`Consumer runtime manifest schema: ${error}`);
        if (consumerManifest.workflowVersion !== manifest.workflowVersion) errors.push("Consumer runtime workflowVersion must match manifest.workflowVersion");
        const requiredFixedEntries = [
          "rules.md", "workflow.lock.json", "prompts/spec-driven", "integrations/governance",
          "integrations/frontend", "integrations/impeccable", ".github/agents",
          ".github/hooks/impeccable.json", ".github/skills/impeccable"
        ];
        const actualFixedEntries = new Set((consumerManifest.fixedEntries || []).map((entry) => entry.path));
        for (const requiredEntry of requiredFixedEntries) {
          if (!actualFixedEntries.has(requiredEntry)) errors.push(`Consumer runtime distribution is missing fixed entry: ${requiredEntry}`);
        }
        for (const forbiddenSegment of ["node_modules", "evals", ".git", ".gitnexus"]) {
          if (!(consumerManifest.excludedSegments || []).includes(forbiddenSegment)) errors.push(`Consumer runtime distribution must exclude segment: ${forbiddenSegment}`);
        }
      } catch (error) {
        errors.push(`Consumer runtime manifest is invalid: ${error.message}`);
      }
    } else {
      if (!fs.existsSync(consumerManifestPath)) errors.push(`Consumer runtime manifest not found: ${consumerManifestPath}`);
      if (!fs.existsSync(consumerManifestSchemaPath)) errors.push(`Consumer runtime manifest schema not found: ${consumerManifestSchemaPath}`);
    }
    const consumerStateSchemaPath = path.join(root, expectedConsumerRuntime.stateSchema);
    if (fs.existsSync(consumerStateSchemaPath)) {
      try {
        for (const error of validateSchemaSupport(readJson(consumerStateSchemaPath))) errors.push(`Consumer runtime state schema definition: ${error}`);
      } catch (error) {
        errors.push(`Consumer runtime state schema is invalid: ${error.message}`);
      }
    }

    const expectedArtifacts = [
      "00-intent.md",
      "01-spec.md",
      "02-assumptions.md",
      "03-acceptance-criteria.md",
      "04-behavior-scenarios.feature",
      "05-executable-acceptance-tests.md",
      "06-properties.md",
      "07-design.md",
      "08-test-plan.md",
      "09-tasks.md",
      "10-adversarial-review.md",
      "11-evidence.md"
    ];
    const actualArtifacts = (manifest.artifactSequence || []).map((item) => item.file);
    if (JSON.stringify(actualArtifacts) !== JSON.stringify(expectedArtifacts)) {
      errors.push("artifactSequence does not match the canonical 00-11 sequence");
    }
    for (const [index, artifact] of (manifest.artifactSequence || []).entries()) {
      if (artifact.order !== index) errors.push(`artifactSequence order mismatch at ${artifact.file}: expected ${index}, received ${artifact.order}`);
    }

    const promptIds = new Set();
    const usedPlaceholderNames = new Set();
    const declaredPlaceholderNames = new Set();
    for (const prompt of manifest.prompts || []) {
      if (!prompt.id || !prompt.file) {
        errors.push("Every prompt requires id and file");
        continue;
      }
      if (promptIds.has(prompt.id)) errors.push(`Duplicate prompt id: ${prompt.id}`);
      promptIds.add(prompt.id);
      const promptPath = path.join(root, "prompts/spec-driven", prompt.file);
      if (!fs.existsSync(promptPath)) {
        errors.push(`Prompt file not found: ${prompt.file}`);
        continue;
      }
      const content = fs.readFileSync(promptPath, "utf8");
      const requiredFragments = [
        "$spec-driven-engineering",
        "<allowed_outputs>",
        "<forbidden_outputs>",
        "<gate>",
        "<placeholders>",
        "<bootstrap>",
        "</bootstrap>",
        "rules-resolution:",
        "context-load:",
        "instruction-trust:",
        "output-language: pt-BR",
        "stage-contract:",
        "self-check:",
        "<placeholder_resolution>",
        "</placeholder_resolution>",
        "literal-placeholder:",
        "inference-policy:",
        "ambiguity-policy:",
        "provenance:",
        "persistence-policy:",
        "AGENTS.md",
        ".agents/rules.md",
        "rules.md",
        ".specs/project/STATE.md",
        ".specs/HANDOFF.md",
        "Perguntas em aberto",
        "Ideias adiadas",
        "Bloqueios",
        "Próximo passo"
      ];
      for (const fragment of requiredFragments) {
        if (!content.includes(fragment)) errors.push(`${prompt.file} is missing: ${fragment}`);
      }
      if (content.includes(forbiddenInstallFragment)) {
        errors.push(`${prompt.file} hardcodes a global skill installation path`);
      }
      const placeholderBlock = content.match(/<placeholders>([\s\S]*?)<\/placeholders>/)?.[1] || "";
      const placeholders = [...content.matchAll(/\{\{([A-Z][A-Z0-9_]*)\}\}/g)].map((match) => match[1]);
      const declared = [...placeholderBlock.matchAll(/^\s*-\s+`([A-Z][A-Z0-9_]*)`:\s+\{\{([A-Z][A-Z0-9_]*)\}\}\s*$/gm)];
      const declaredInPrompt = new Set();
      for (const match of declared) {
        if (match[1] !== match[2]) errors.push(`${prompt.file} declares mismatched placeholder: ${match[1]} vs ${match[2]}`);
        if (declaredInPrompt.has(match[1])) errors.push(`${prompt.file} declares duplicate placeholder: ${match[1]}`);
        declaredInPrompt.add(match[1]);
        declaredPlaceholderNames.add(match[1]);
      }
      for (const placeholder of new Set(placeholders)) {
        usedPlaceholderNames.add(placeholder);
        if (!declaredInPrompt.has(placeholder)) {
          errors.push(`${prompt.file} uses undeclared placeholder: ${placeholder}`);
        }
      }
      for (const placeholder of declaredInPrompt) {
        if (!placeholders.includes(placeholder)) errors.push(`${prompt.file} declares unused placeholder: ${placeholder}`);
      }
      const allowedOutputs = content.match(/<allowed_outputs>([\s\S]*?)<\/allowed_outputs>/)?.[1] || "";
      if (!allowedOutputs.includes(".specs/project/STATE.md")) {
        errors.push(`${prompt.file} must permit conditional durable STATE.md updates`);
      }
      for (const dependency of prompt.dependsOn || []) {
        if (!promptIds.has(dependency)) {
          errors.push(`${prompt.id} depends on a prompt not ordered before it: ${dependency}`);
        }
      }
    }

    const adversarialPrompt = (manifest.prompts || []).find((prompt) => prompt.id === "adversarial");
    const adversarialPromptDependsOn = new Set(adversarialPrompt?.dependsOn || []);
    for (const requiredPredecessor of ["backend-representative-gate", "frontend-representative-gate"]) {
      if (!adversarialPromptDependsOn.has(requiredPredecessor)) {
        errors.push(
          `The 'adversarial' prompt must dependOn '${requiredPredecessor}' — the prompt graph must mirror gates[]'s 'adversarial' gate, which already depends on both representative gates. A workflow must not have two independent execution graphs.`
        );
      }
    }

    const resolutionNames = (manifest.placeholderPolicy?.resolutions || []).map((item) => item.name);
    const resolutionSet = new Set(resolutionNames);
    if (resolutionSet.size !== resolutionNames.length) errors.push("placeholderPolicy contains duplicate resolution names");
    for (const placeholder of usedPlaceholderNames) {
      if (!resolutionSet.has(placeholder)) errors.push(`placeholderPolicy has no resolution for: ${placeholder}`);
    }
    for (const placeholder of resolutionSet) {
      if (!declaredPlaceholderNames.has(placeholder)) errors.push(`placeholderPolicy declares unused placeholder: ${placeholder}`);
    }
    const evaluationScope = (manifest.placeholderPolicy?.resolutions || []).find((item) => item.name === "EVALUATION_SCOPE");
    if (!evaluationScope || evaluationScope.codeAllowed !== false || !evaluationScope.sources?.includes("approved-00-09")) {
      errors.push("EVALUATION_SCOPE must be derived from approved 00-09 contracts without implementation code");
    }

    const localSkillsRoot = path.join(root, "skills");
    const discoveredSkillNames = new Set([
      ...skillNamesUnder(localSkillsRoot),
      ...skillNamesUnder(path.join(process.env.HOME || "", ".agents/skills")),
      ...skillNamesUnder(path.join(process.env.HOME || "", ".codex/skills"))
    ]);
    for (const route of manifest.skillRoutes || []) {
      if (!route.skill) {
        errors.push("Every skill route requires a skill name");
        continue;
      }
      const candidates = [
        path.join(localSkillsRoot, route.skill, "SKILL.md"),
        path.join(process.env.HOME || "", ".agents/skills", route.skill, "SKILL.md"),
        path.join(process.env.HOME || "", ".codex/skills", route.skill, "SKILL.md")
      ];
      if (!candidates.some((candidate) => fs.existsSync(candidate)) && !discoveredSkillNames.has(route.skill)) {
        const message = `Routed skill is not currently discoverable: ${route.skill}`;
        if (route.required) errors.push(message);
        else warnings.push(message);
      }

      const validRequirementLevels = ["hard-required", "required-with-degraded-fallback", "optional"];
      if (!validRequirementLevels.includes(route.requirementLevel)) {
        errors.push(`Skill route '${route.skill}' has an invalid or missing requirementLevel`);
      } else {
        const expectedRequired = route.requirementLevel === "hard-required";
        if (route.required !== expectedRequired) {
          errors.push(`Skill route '${route.skill}' has required=${route.required} inconsistent with requirementLevel='${route.requirementLevel}' (required must be true only for hard-required)`);
        }
        if (route.requirementLevel === "required-with-degraded-fallback" && !route.fallback) {
          errors.push(`Skill route '${route.skill}' declares requirementLevel='required-with-degraded-fallback' but no fallback text`);
        }
        if (route.requirementLevel !== "required-with-degraded-fallback" && route.fallback) {
          errors.push(`Skill route '${route.skill}' declares a fallback but requirementLevel is '${route.requirementLevel}', not 'required-with-degraded-fallback'`);
        }
      }
    }

    const frontendDesignRoute = (manifest.skillRoutes || []).find(
      (route) => route.skill === "frontend-design" && route.required === true
    );
    if (!frontendDesignRoute) {
      errors.push("frontend-design must be a required route for user-visible web interface changes");
    }
    const redesignRoute = (manifest.skillRoutes || []).find(
      (route) => route.skill === "ui-audit-redesign-engineer" && route.required === true
    );
    if (!redesignRoute) {
      errors.push("ui-audit-redesign-engineer must be a required route for incremental visual modernization");
    }

    const stylingPolicy = manifest.frontendStylingPolicy;
    for (const [key, expected] of Object.entries({
      contract: "docs/frontend/styling-authority.json",
      classOwnership: "trace-before-edit-or-override",
      unresolvedClass: "blocked-never-inject-global-override",
      globalStyles: "app-wide-concerns-only-unless-legacy-authority-or-approved-exception",
      visualReferences: "v2-adopted-ids-bound-to-visual-research-digest",
      redesignMode: "ui-audit-redesign-engineer-required"
    })) {
      if (stylingPolicy?.[key] !== expected) errors.push(`frontendStylingPolicy.${key} must be ${expected}`);
    }

    const compositionPolicy = manifest.frontendCompositionPolicy;
    for (const [key, expected] of Object.entries({
      requiredFor: "new-redesign-substantial-dominant-task-typography-region-or-action-hierarchy-change",
      designSystemField: "visualGrammar",
      screenField: "visualHierarchy",
      proofArtifact: "docs/frontend/screens/<screen-id>/composition-proof.json",
      evidenceArtifact: "docs/frontend/screens/<screen-id>/visual-composition-evidence.json",
      scorecardArtifact: "docs/frontend/screens/<screen-id>/visual-quality-scorecard.json",
      semanticHeadingPolicy: "headings-structure-not-visual-scale",
      humanApproval: "existing-frontend-representative-gate"
    })) {
      if (compositionPolicy?.[key] !== expected) errors.push(`frontendCompositionPolicy.${key} must be ${expected}`);
    }
    const expectedCompositionValidators = [
      "validate-visual-composition-contract.mjs",
      "audit-visual-composition-evidence.mjs",
      "validate-visual-quality-scorecard.mjs"
    ];
    if (JSON.stringify(compositionPolicy?.baseProfiles || []) !== JSON.stringify(["productive", "expressive"])) {
      errors.push("frontendCompositionPolicy.baseProfiles must be productive, expressive");
    }
    if (JSON.stringify(compositionPolicy?.validators || []) !== JSON.stringify(expectedCompositionValidators)) {
      errors.push("frontendCompositionPolicy.validators must declare the three visual composition validators in order");
    }

    const approvalRunbook = manifest.sessionClosure?.humanApprovalRunbook;
    for (const [key, expected] of Object.entries({
      requiredWhen: "blocked-or-awaiting-review-on-human-action",
      handoffSection: "Ação humana pendente",
      finalHeading: "Como validar e aprovar",
      commandSource: "real-project-evidence-only",
      automatableChecks: "agent-runs-before-handoff-when-safe-and-authorized"
    })) {
      if (approvalRunbook?.[key] !== expected) errors.push(`sessionClosure.humanApprovalRunbook.${key} must be ${expected}`);
    }
    for (const key of ["copyPasteCommands", "approvalNeverInferredFromExecution", "scopedDecisionResponse"]) {
      if (approvalRunbook?.[key] !== true) errors.push(`sessionClosure.humanApprovalRunbook.${key} must be true`);
    }

    const tlcRoute = (manifest.skillRoutes || []).find(
      (route) => route.skill === "tlc-spec-driven" && route.requirementLevel && route.requirementLevel !== "optional"
    );
    if (!tlcRoute) {
      errors.push("tlc-spec-driven must be a non-optional (hard-required or required-with-degraded-fallback) specialist route for project/codebase governance");
    }

    const backendBuilderRoute = (manifest.skillRoutes || []).find(
      (route) => route.skill === "backend-product-builder" && route.required === true
    );
    if (!backendBuilderRoute) {
      errors.push("backend-product-builder must be a required route for material backend changes");
    }
    const rustRoute = (manifest.skillRoutes || []).find(
      (route) => route.when === "backend-technology-selection-rust-axum-default"
        && route.skill === "rust-pro"
        && route.required === true
        && route.requirementLevel === "hard-required"
    );
    if (!rustRoute) {
      errors.push("rust-pro must be hard-required exactly when backend technology selection is rust-axum-default");
    }
    const rustSkillRoot = path.join(localSkillsRoot, "rust-pro");
    const rustSkillFiles = [
      "SKILL.md",
      "agents/openai.yaml",
      "references/stack-selection.md",
      "references/axum-service-design.md",
      "references/data-reliability.md",
      "references/quality-gates.md"
    ];
    for (const file of rustSkillFiles) {
      if (!fs.existsSync(path.join(rustSkillRoot, file))) errors.push(`rust-pro canonical skill file is missing: ${file}`);
    }
    const rustSkill = fs.existsSync(path.join(rustSkillRoot, "SKILL.md"))
      ? fs.readFileSync(path.join(rustSkillRoot, "SKILL.md"), "utf8")
      : "";
    for (const fragment of ["technology.selection=rust-axum-default", "Router::with_state", "spawn_blocking", "cargo check", "Clippy", "Context7"]) {
      if (!rustSkill.includes(fragment)) errors.push(`rust-pro is missing workflow contract: ${fragment}`);
    }
    for (const staleClaim of ["Rust 1.75+", "cutting-edge crates", "modern web frameworks: axum, warp, actix-web"]) {
      if (rustSkill.includes(staleClaim)) errors.push(`rust-pro still contains stale generic guidance: ${staleClaim}`);
    }

    const expectedGates = [
      "discovery",
      "specification",
      "acceptance",
      "design-readiness",
      "implementation",
      "backend-representative",
      "frontend-representative",
      "adversarial",
      "evidence-release"
    ];
    const actualGates = (manifest.gates || []).map((gate) => gate.id);
    if (JSON.stringify(actualGates) !== JSON.stringify(expectedGates)) {
      errors.push("gates do not match the canonical backend/frontend 2.1 order");
    }
    for (const [index, gate] of (manifest.gates || []).entries()) {
      if (gate.order !== index + 1) errors.push(`Gate order mismatch for ${gate.id}: expected ${index + 1}, received ${gate.order}`);
    }
    const backendGate = (manifest.gates || []).find((gate) => gate.id === "backend-representative");
    if (backendGate?.humanApproval !== "conditional" || !backendGate?.humanApprovalWhen) {
      errors.push("backend representative gate must declare conditional human approval policy");
    }

    const gateOrderById = new Map((manifest.gates || []).map((gate) => [gate.id, gate.order]));
    for (const gate of manifest.gates || []) {
      if (gate.id === "discovery") continue;
      if (!Array.isArray(gate.dependsOn) || gate.dependsOn.length === 0) {
        errors.push(`Gate '${gate.id}' must declare dependsOn (the real state-machine predecessor), not rely on order alone`);
        continue;
      }
      for (const dependency of gate.dependsOn) {
        if (!gateOrderById.has(dependency)) {
          errors.push(`Gate '${gate.id}' depends on an unknown gate: ${dependency}`);
        } else if (gateOrderById.get(dependency) >= gate.order) {
          errors.push(`Gate '${gate.id}' depends on '${dependency}', which does not precede it in order`);
        }
      }
    }
    const adversarialGate = (manifest.gates || []).find((gate) => gate.id === "adversarial");
    const adversarialDependsOn = new Set(adversarialGate?.dependsOn || []);
    for (const requiredPredecessor of ["backend-representative", "frontend-representative"]) {
      if (!adversarialDependsOn.has(requiredPredecessor)) {
        errors.push(`adversarial gate must dependOn '${requiredPredecessor}' — it cannot be reachable from implementation alone while a representative gate is still pending/rejected`);
      }
    }

    const frontendPromptContracts = [
      ["05-design-readiness.prompt.md", ["$frontend-design", "$backend-product-builder", "$ui-audit-redesign-engineer", "ready-for-backend-slice", "ready-for-small-slice", "styling-authority:", "canonical-design-evidence:", "--check-references", "visual-reference-contract:", "composition-proof:", "visualHierarchy", "human-approval-runbook:", "## Como validar e aprovar"]],
      ["07-execute.prompt.md", ["$frontend-design", "$frontend-product-builder", "broad-build-approved", "class-ownership-trace:", "request-constraint-execution:", "docs/frontend/styling-authority.json", "human-approval-runbook:", "## Como validar e aprovar", "## Ação humana pendente"]],
      ["07.1-frontend-representative-gate.prompt.md", ["$frontend-design", "$web-design-guidelines", "scorecard", "broad-build-approved", "global-css-policy:", "composition-audit:", "visual-composition-evidence.json", "validate-visual-composition-contract.mjs", "styling-authority.json", "audit-styling-authority.mjs", "human-approval-runbook:", "approval-response-contract:", "Terminal 1", "## Ação humana pendente"]],
      ["08-adversarial.prompt.md", ["reference-drift:", "styling-authority.json"]],
      ["09-validate-evidence.prompt.md", ["$frontend-design", "scorecard", "broad-build-approved", "styling-authority.json", "request-constraint-evidence:", "human-approval-runbook:", "## Ação humana pendente"]]
    ];
    for (const [file, fragments] of frontendPromptContracts) {
      const promptPath = path.join(root, "prompts/spec-driven", file);
      if (!fs.existsSync(promptPath)) continue;
      const content = fs.readFileSync(promptPath, "utf8");
      for (const fragment of fragments) {
        if (!content.includes(fragment)) errors.push(`${file} is missing frontend quality contract: ${fragment}`);
      }
    }

    const backendPromptContracts = [
      ["00-project-init.prompt.md", ["machine-readable", "tenancy", "rollback"]],
      ["00.5-brownfield-map.prompt.md", ["OpenAPI", "migrations", "contract drift"]],
      ["01-intent.prompt.md", ["request-constraint-ledger:"]],
      ["02-spec-assumptions.prompt.md", ["idempotência", "concorrência", "tenancy", "request-constraint-traceability:"]],
      ["04-behavior-tests.prompt.md", ["testes de contrato", "migration", "tenant isolation"]],
      ["05-design-readiness.prompt.md", ["$backend-product-builder", "docs/backend/", "ready-for-backend-slice", "gate.conditions", "backend-technology-selection:", "technology-constraint-preservation:", "$rust-pro"]],
      ["06-test-plan-tasks.prompt.md", ["contract/integration/persistence/migration", "representative vertical slice", "rust-quality-plan:", "cargo clippy"]],
      ["07-execute.prompt.md", ["$backend-product-builder", "backend-broad-build-approved", "vertical slice", "hash do contrato", "rust-execution:", "request-constraint-execution:", "$rust-pro"]],
      ["07.2-backend-representative-gate.prompt.md", ["$backend-product-builder", "scenario matrix", "BOLA/IDOR", "backend-broad-build-approved", "--run-contract-validators", "backend-representative-scorecard.json", "RULE-BE-STACK-001", "human-approval-runbook:", "approval-response-contract:", "Terminal 1", "## Ação humana pendente"]],
      ["08-adversarial.prompt.md", ["contract drift", "tenant isolation", "complexidade especulativa", "backend-technology-adversarial:"]],
      ["09-validate-evidence.prompt.md", ["backend-broad-build-approved", "tenant isolation", "observabilidade/SLO", "SHA-256 atual do contrato", "backend-technology-evidence:", "request-constraint-evidence:"]]
    ];
    for (const [file, fragments] of backendPromptContracts) {
      const promptPath = path.join(root, "prompts/spec-driven", file);
      if (!fs.existsSync(promptPath)) {
        errors.push(`Backend workflow prompt not found: ${file}`);
        continue;
      }
      const content = fs.readFileSync(promptPath, "utf8");
      for (const fragment of fragments) {
        if (!content.includes(fragment)) errors.push(`${file} is missing backend product contract: ${fragment}`);
      }
    }

    const contextPromptContracts = [
      ["00-project-init.prompt.md", ["$tlc-spec-driven", "workflow.rulesFile", "PROJECT_CONTEXT"]],
      ["00.5-brownfield-map.prompt.md", ["$tlc-spec-driven", "INVESTIGATION_SCOPE"]],
      ["00.8-migrate-v1.prompt.md", ["default seguro `dry-run`", "único pacote legado"]],
      ["01-intent.prompt.md", ["REQUEST", "não derive intenção de produto"]],
      ["05-design-readiness.prompt.md", ["scope-inference: backend-frontend", "not-applicable|lightweight|substantial", "00–06"]],
      ["06.5-freeze-evaluation-baseline.prompt.md", ["evaluation-scope-source: approved-contracts-only", "Não use implementação", "P0/P1/P2"]],
      ["07-execute.prompt.md", ["única task `ready|in-progress`"]],
      ["07.1-frontend-representative-gate.prompt.md", ["readiness aprovada", "router real"]],
      ["07.2-backend-representative-gate.prompt.md", ["manifest, readiness, scenario matrix"]],
      ["08-adversarial.prompt.md", ["diff ou inventário"]],
      ["09-validate-evidence.prompt.md", ["readiness-review-only"]],
      ["10-evaluate.prompt.md", ["pointer/hash congelado", "não rederivar"]]
    ];
    for (const [file, fragments] of contextPromptContracts) {
      const promptPath = path.join(root, "prompts/spec-driven", file);
      if (!fs.existsSync(promptPath)) continue;
      const content = fs.readFileSync(promptPath, "utf8");
      for (const fragment of fragments) {
        if (!content.includes(fragment)) errors.push(`${file} is missing context/bootstrap contract: ${fragment}`);
      }
    }

    const rulesPath = path.join(root, "rules.md");
    if (!fs.existsSync(rulesPath)) {
      errors.push(`Canonical workflow rules not found: ${rulesPath}`);
    } else {
      const rules = fs.readFileSync(rulesPath, "utf8");
      for (const fragment of [
        "## Bootstrap de Contexto em Janela Limpa",
        "## Resolução de Placeholders",
        "EVALUATION_SCOPE",
        "Respeite os outputs da etapa",
        "STATE é condicional",
        "## Autoridade de Estilização Frontend",
        "## Composição Visual Frontend",
        "visualGrammar",
        "visualHierarchy",
        "composition-proof.json",
        "class ownership",
        "globals.css",
        "## Aprovação Humana Acionável",
        "## Como validar e aprovar",
        "Rodar um comando com sucesso não significa aprovar",
        "update-handoff.mjs"
      ]) {
        if (!rules.includes(fragment)) errors.push(`rules.md is missing workflow 2.4.0 contract: ${fragment}`);
      }
    }

    if (fs.existsSync(path.join(root, "prompts/spec-driven/05-design-frontend.prompt.md"))) {
      errors.push("Legacy active design prompt still exists: 05-design-frontend.prompt.md");
    }
    information.push(`Prompts validated: ${(manifest.prompts || []).length}`);
    information.push(`Artifacts validated: ${actualArtifacts.length}`);
  }
}

checkFrontendCanonicalWorkflowConsistency(root);

const ok = printReport("Spec-Driven Engineering — Workflow Validation", errors, warnings, information);
process.exitCode = ok ? 0 : 1;
