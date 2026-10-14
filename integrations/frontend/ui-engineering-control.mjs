#!/usr/bin/env node
import crypto from "node:crypto";
import { validateJsonSchema } from "../../skills/spec-driven-engineering/scripts/lib/json-schema.mjs";
import { sourceSnapshot, projectFile, gitOutput, loadExecutionContext } from "../governance/execution-context.mjs";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { validateHumanDecisionScope, validateProductDesignReadinessReceipt } from "./product-design-control.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../..");
const runtimeRequire = createRequire(path.join(ROOT, "skills/frontend-product-builder/package.json"));
const VOLATILE_KEYS = new Set([
  "absolutePath",
  "capturedAt",
  "completedAt",
  "generatedAt",
  "startedAt",
  "timestamp"
]);
const PRIVATE_KEY_NAMES = /^(?:screenshot|screenshots|domText|sourceSnippet|debugPath|absolutePath|token|secret|privateEvidence)$/i;
const PRIVATE_VALUE_PATTERNS = [
  /data:image\/[a-z+.-]+;base64,/i,
  /\/home\/[A-Za-z0-9._-]+\//,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  /\b(?:api[_-]?key|secret|token)\s*[:=]\s*[A-Za-z0-9_./+-]{12,}\b/i,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/
];

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

export function canonicalDigest(value) {
  return crypto.createHash("sha256").update(JSON.stringify(sortCanonical(value))).digest("hex");
}

function fileDigest(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function artifact(artifactKind, value, schemaVersion = "1.0.0") {
  const result = { artifactKind, schemaVersion, ...value };
  result.semanticDigest = canonicalDigest(result);
  return result;
}

function finding(id, message, overrides = {}) {
  return {
    id,
    severity: "P1",
    source: "objective",
    message,
    ...overrides
  };
}

function uniqueFindings(findings) {
  const byKey = new Map();
  for (const item of findings) {
    const key = item.findingKey ?? `${item.id}:${item.targetId ?? item.location ?? item.message}`;
    if (!byKey.has(key)) byKey.set(key, { ...item, findingKey: key });
  }
  return [...byKey.values()].sort((left, right) =>
    left.id.localeCompare(right.id) || left.findingKey.localeCompare(right.findingKey)
  );
}

function requireObject(value, label) {
  if (!isObject(value)) throw new Error(`${label} must be a JSON object.`);
}

function subjectFrom(value) {
  const subject = value?.subject ?? { project: "unknown", commit: "unknown" };
  return { project: String(subject.project ?? "unknown"), commit: String(subject.commit ?? "unknown") };
}

export function resolveUiPlatformProfile(input) {
  requireObject(input, "platform profile input");
  const subject = subjectFrom(input);
  const uiSurfaces = Array.isArray(input.uiSurfaces) ? input.uiSurfaces : [];
  const findings = [];
  let adapterId = null;

  if (uiSurfaces.length === 0) {
    findings.push(finding("UI-SURFACE-MISSING", "No UI surface was discovered."));
  }

  for (const surface of uiSurfaces) {
    const supported = surface.framework === "react" && surface.styling === "tailwind-v4" && surface.runtime === "web-dom";
    if (!supported) {
      findings.push(finding(
        "UI-ADAPTER-UNSUPPORTED",
        `UI surface '${surface.id ?? "unknown"}' has no supported adapter.`,
        { targetId: String(surface.id ?? "unknown"), actual: { framework: surface.framework, styling: surface.styling, runtime: surface.runtime } }
      ));
    } else if (adapterId && adapterId !== "react-tailwind-v4") {
      findings.push(finding("UI-ADAPTER-CONFLICT", "UI surfaces resolve to conflicting adapters."));
    } else {
      adapterId = "react-tailwind-v4";
    }
  }

  const profile = artifact("ui-platform-profile", { subject, uiSurfaces });
  const resolution = artifact("ui-adapter-resolution", {
    subject,
    profileDigest: profile.semanticDigest,
    status: findings.length === 0 ? "resolved" : "unsupported",
    adapterId,
    sourceParser: adapterId ? { id: "typescript-compiler-api", version: runtimeRequire("typescript/package.json").version } : null,
    runtimeCollector: adapterId ? { id: "playwright-web-dom", version: runtimeRequire("playwright/package.json").version } : null
  });
  return { profile, resolution, findings: uniqueFindings(findings) };
}

function collectTokenReferences(bundle) {
  const references = new Set();
  const visit = (value, key = "") => {
    if (typeof value === "string" && (key === "tokenRef" || key === "$ref" || key === "token")) references.add(value);
    if (Array.isArray(value)) {
      if (key === "tokenRefs") for (const item of value) if (typeof item === "string") references.add(item);
      for (const item of value) visit(item, key);
    } else if (isObject(value)) {
      for (const [childKey, child] of Object.entries(value)) visit(child, childKey);
    }
  };
  for (const area of [bundle.recipes, bundle.components, bundle.statuses, bundle.locale]) visit(area);
  return references;
}

function resolveTokenGraph(tokens, findings) {
  const resolved = {};
  const visiting = new Set();
  const visited = new Set();

  const resolve = (name) => {
    if (visited.has(name)) return resolved[name];
    if (visiting.has(name)) {
      findings.push(finding("UI-TOKEN-CYCLE", `Token cycle includes '${name}'.`, { targetId: name }));
      return null;
    }
    const token = tokens[name];
    if (!token) {
      findings.push(finding("UI-TOKEN-MISSING", `Token '${name}' is referenced but not defined.`, { targetId: name }));
      return null;
    }
    visiting.add(name);
    let value = token.value;
    if (typeof value === "string" && value.startsWith("{" ) && value.endsWith("}")) {
      const reference = value.slice(1, -1);
      const target = tokens[reference];
      if (target && target.type !== token.type) {
        findings.push(finding("UI-TOKEN-TYPE", `Token '${name}' references incompatible '${reference}'.`, { targetId: name }));
      }
      const targetResolved = resolve(reference);
      value = targetResolved?.value ?? null;
    }
    visiting.delete(name);
    visited.add(name);
    resolved[name] = { type: token.type, value };
    return resolved[name];
  };

  for (const name of Object.keys(tokens).sort()) resolve(name);
  return resolved;
}

function compileTailwindTheme(tokens) {
  const rootVariables = {};
  const themeVariables = {};
  const allowedUtilities = new Set();
  for (const [name, token] of Object.entries(tokens).sort(([left], [right]) => left.localeCompare(right))) {
    const slug = name.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
    const role = name.split(".").slice(1).join("-") || slug;
    if (token.type === "typography" && isObject(token.value)) {
      if (token.value.fontSize) {
        rootVariables[`--ds-${slug}-size`] = token.value.fontSize;
        themeVariables[`--text-${role}`] = `var(--ds-${slug}-size)`;
        allowedUtilities.add(`text-${role}`);
      }
      if (token.value.fontWeight) {
        rootVariables[`--ds-${slug}-weight`] = String(token.value.fontWeight);
        themeVariables[`--font-weight-${role}`] = `var(--ds-${slug}-weight)`;
        allowedUtilities.add(`font-${role}`);
      }
      continue;
    }
    rootVariables[`--ds-${slug}`] = String(token.value);
    if (token.type === "color") {
      themeVariables[`--color-${slug}`] = `var(--ds-${slug})`;
      allowedUtilities.add(`bg-${slug}`);
      allowedUtilities.add(`border-${slug}`);
      allowedUtilities.add(`text-${slug}`);
    } else if (token.type === "length") {
      themeVariables[`--spacing-${role}`] = `var(--ds-${slug})`;
      for (const prefix of ["gap", "p", "px", "py", "m", "mx", "my", "space-x", "space-y"]) allowedUtilities.add(`${prefix}-${role}`);
    } else if (token.type === "shadow") {
      themeVariables[`--shadow-${role}`] = `var(--ds-${slug})`;
      allowedUtilities.add(`shadow-${role}`);
    }
  }
  const declarations = (values) => Object.entries(values).map(([name, value]) => `  ${name}: ${value};`).join("\n");
  return {
    rootVariables,
    themeVariables,
    allowedUtilities: [...allowedUtilities].sort(),
    css: `:root {\n${declarations(rootVariables)}\n}\n\n@theme inline {\n${declarations(themeVariables)}\n}\n`
  };
}

export function compileUiPolicy(bundle, profile, resolution) {
  requireObject(bundle, "design bundle");
  requireObject(profile, "platform profile");
  requireObject(resolution, "adapter resolution");
  const findings = [];
  if (resolution.status !== "resolved" || !resolution.adapterId) {
    findings.push(finding("UI-ADAPTER-UNSUPPORTED", "Policy cannot compile without a resolved adapter."));
  }
  const tokens = isObject(bundle.tokens) ? bundle.tokens : {};
  const resolvedTokens = resolveTokenGraph(tokens, findings);
  const tailwind = compileTailwindTheme(resolvedTokens);
  const references = collectTokenReferences(bundle);

  for (const reference of references) {
    if (!tokens[reference]) findings.push(finding("UI-TOKEN-MISSING", `Token '${reference}' is not defined.`, { targetId: reference }));
  }
  for (const name of Object.keys(tokens)) {
    const isAliasTarget = Object.values(tokens).some((token) => token.value === `{${name}}`);
    if (!references.has(name) && !isAliasTarget) {
      findings.push(finding("UI-TOKEN-ORPHAN", `Token '${name}' is not consumed by a governed contract.`, { targetId: name }));
    }
  }

  const components = Array.isArray(bundle.components) ? bundle.components : [];
  for (const component of components) {
    if (!String(component.owner ?? "").trim()) {
      findings.push(finding("UI-RESPONSIBILITY-OWNER-MISSING", `Component '${component.id ?? "unknown"}' has no owner.`, { targetId: component.id }));
    }
  }
  const recipes = Array.isArray(bundle.recipes) ? bundle.recipes : [];
  for (const recipe of recipes) {
    if (!String(recipe.owner ?? "").trim()) {
      findings.push(finding("UI-RESPONSIBILITY-OWNER-MISSING", `Recipe '${recipe.id ?? "unknown"}' has no owner.`, { targetId: recipe.id }));
    }
    if (!Array.isArray(recipe.expected) || recipe.expected.length === 0) {
      findings.push(finding("UI-EXPECTED-COVERAGE-EMPTY", `Recipe '${recipe.id ?? "unknown"}' has no expected render coverage.`, { targetId: recipe.id }));
    }
    for (const primitive of recipe.requiredPrimitives ?? []) {
      if (!components.some((component) => component.id === primitive)) {
        findings.push(finding("UI-PRIMITIVE-MISSING", `Recipe '${recipe.id}' requires unknown primitive '${primitive}'.`, { targetId: primitive }));
      }
    }
  }

  const statuses = isObject(bundle.statuses) ? bundle.statuses : {};
  for (const [domainValue, mapping] of Object.entries(statuses)) {
    if (!mapping.semanticRole || !mapping.variant || !mapping.tokenRef) {
      findings.push(finding("UI-STATUS-MAPPING-INCOMPLETE", `Domain status '${domainValue}' is not exhaustively mapped.`, { targetId: domainValue }));
    }
  }

  const expectedElements = recipes.flatMap((recipe) => (recipe.expected ?? []).map((element) => ({ recipeId: recipe.id, ...element })));
  const subject = subjectFrom(bundle);
  const tokenResolution = artifact("ui-token-resolution", {
    subject,
    profileDigest: profile.semanticDigest ?? canonicalDigest(profile),
    tokens: resolvedTokens,
    cssVariables: tailwind.rootVariables,
    tailwindThemeVariables: tailwind.themeVariables
  });
  const policy = artifact("ui-policy-compiled", {
    subject,
    adapterId: resolution.adapterId,
    profileDigest: profile.semanticDigest ?? canonicalDigest(profile),
    tokenResolutionDigest: tokenResolution.semanticDigest,
    recipes,
    components,
    statuses,
    locale: bundle.locale ?? null,
    allowedUtilities: [...new Set([...(bundle.staticUtilities ?? []), ...tailwind.allowedUtilities])].sort(),
    tailwindThemeDigest: canonicalDigest(tailwind.css)
  });
  const expectedRenderModel = artifact("expected-render-model", {
    subject,
    policyDigest: policy.semanticDigest,
    elements: expectedElements,
    relations: bundle.relations ?? {}
  });
  return { policy, tokenResolution, expectedRenderModel, tailwindCss: tailwind.css, findings: uniqueFindings(findings) };
}

function visibleLiteralFindings(source, catalog) {
  const findings = [];
  const degraded = ["Aprovacoes", "Movimentacoes", "Nao", "analise"];
  for (const literal of degraded) {
    if (source.includes(literal) && !catalog.includes(literal)) {
      findings.push(finding("UI-10", `Visible pt-BR copy '${literal}' is degraded or outside the catalog.`, { targetId: literal }));
    }
  }
  return findings;
}

export function lintReactTailwindSource(source, policy = {}) {
  if (typeof source !== "string") throw new Error("React/Tailwind source must be a string.");
  const findings = [];
  const add = (id, message, overrides = {}) => findings.push(finding(id, message, overrides));
  const has = (pattern) => pattern.test(source);
  let typescript;
  try {
    typescript = runtimeRequire("typescript");
  } catch {
    return { findings: [finding("UI-ADAPTER-UNAVAILABLE", "The react-tailwind-v4 adapter requires the pinned TypeScript Compiler API.", { severity: "P0" })] };
  }
  const sourceFile = typescript.createSourceFile(
    "source.tsx",
    source,
    typescript.ScriptTarget.Latest,
    true,
    typescript.ScriptKind.TSX
  );
  for (const diagnostic of sourceFile.parseDiagnostics ?? []) {
    const location = sourceFile.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
    add("UI-SOURCE-PARSE", typescript.flattenDiagnosticMessageText(diagnostic.messageText, " "), {
      severity: "P0",
      location: `${location.line + 1}:${location.character + 1}`
    });
  }

  const classValues = [];
  const visibleLiterals = new Set();
  let hasTable = false;
  const attributeName = (attribute) => attribute.name?.getText(sourceFile) ?? "";
  const expressionStrings = (expression) => {
    const texts = [];
    let dynamic = false;
    const inspect = (node) => {
      if (typescript.isStringLiteral(node) || typescript.isNoSubstitutionTemplateLiteral(node)) texts.push(node.text);
      if (typescript.isTemplateExpression(node)) dynamic = true;
      typescript.forEachChild(node, inspect);
    };
    inspect(expression);
    return { dynamic, texts };
  };
  const attributeValue = (attribute) => {
    if (!attribute.initializer) return true;
    if (typescript.isStringLiteral(attribute.initializer)) return attribute.initializer.text;
    if (!typescript.isJsxExpression(attribute.initializer) || !attribute.initializer.expression) return null;
    const expression = attribute.initializer.expression;
    if (typescript.isStringLiteral(expression) || typescript.isNoSubstitutionTemplateLiteral(expression)) return expression.text;
    if (typescript.isTemplateExpression(expression)) return { dynamic: true, texts: expression.templateSpans.length > 0 ? [expression.head.text] : [] };
    const extracted = expressionStrings(expression);
    return extracted.texts.length > 0 || extracted.dynamic ? extracted : null;
  };
  const openingFacts = (node) => {
    const tag = node.tagName.getText(sourceFile);
    const attributes = new Map(node.attributes.properties
      .filter((property) => typescript.isJsxAttribute(property))
      .map((property) => [attributeName(property), attributeValue(property)]));
    const classValue = attributes.get("className") ?? attributes.get("class");
    const classes = typeof classValue === "string" ? classValue : isObject(classValue) ? (classValue.texts ?? []).join(" ") : "";
    const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    const location = `${position.line + 1}:${position.character + 1}`;

    for (const attribute of node.attributes.properties.filter((property) => typescript.isJsxAttribute(property))) {
      const name = attributeName(attribute);
      const value = attributeValue(attribute);
      if (["aria-label", "title", "placeholder", "alt", "value"].includes(name) && typeof value === "string" && value.trim()) {
        visibleLiterals.add(value.trim().replace(/\s+/g, " "));
      }
    }

    if (attributes.has("style")) add("UI-SOURCE-INLINE-STYLE", "Inline style bypasses semantic tokens.", { location });
    if (isObject(classValue) && classValue.dynamic) add("UI-SOURCE-DYNAMIC-UTILITY", "Dynamically constructed Tailwind utilities are not statically detectable.", { location });
    if (classes) classValues.push(classes);
    if (["div", "span", "tr"].includes(tag) && attributes.has("onClick")) add("UI-05", "Interactive action uses a non-semantic element.", { location });
    if (["div", "span", "tr"].includes(tag) && /(?:^|\s)hover:/.test(classes)) add("UI-05", "Hover signifier exists without semantic action affordance.", { location });
    if (tag === "fieldset") {
      let containsLegend = false;
      const inspect = (child) => {
        if ((typescript.isJsxOpeningElement(child) || typescript.isJsxSelfClosingElement(child)) && child.tagName.getText(sourceFile) === "legend") containsLegend = true;
        typescript.forEachChild(child, inspect);
      };
      typescript.forEachChild(node.parent, inspect);
      if (containsLegend) add("UI-09", "fieldset/legend is used as page structure rather than form grouping.", { location });
    }
    if (["table", "Table", "DataTable"].includes(tag)) hasTable = true;
    if (/\bgrid-cols-4\b/.test(classes) && String(attributes.get("data-metric-count")) === "5") add("UI-01", "Metric cardinality and columns create an orphan final row.", { location });
    if (/\bamber-\d{2,3}\b/.test(classes) && String(attributes.get("data-domain-status") ?? "").trim().split(/\s+/).length > 1) add("UI-04", "Distinct domain statuses collapse to one visual role.", { location });
    if (/\blg:grid-cols-3\b/.test(classes) && typescript.isJsxOpeningElement(node) && typescript.isJsxElement(node.parent)) {
      const directElements = node.parent.children.filter((child) => typescript.isJsxElement(child) || typescript.isJsxSelfClosingElement(child));
      const hasOwnedMain = directElements.some((child) => /\blg:col-span-2\b/.test(child.getText(sourceFile)));
      const hasAside = directElements.some((child) => /^<aside\b/.test(child.getText(sourceFile)));
      if (directElements.length >= 3 && !hasOwnedMain && !hasAside) add("UI-07", "Three-column detail layout has no owned main/aside region policy.", { location });
    }
  };
  const visit = (node) => {
    if (typescript.isJsxOpeningElement(node) || typescript.isJsxSelfClosingElement(node)) openingFacts(node);
    if (typescript.isJsxText(node)) {
      const literal = node.text.trim().replace(/\s+/g, " ");
      if (/[\p{L}\p{N}]/u.test(literal)) visibleLiterals.add(literal);
    }
    typescript.forEachChild(node, visit);
  };
  visit(sourceFile);

  const staticClasses = classValues.join(" ");
  const allowedUtilities = new Set(policy.allowedUtilities ?? []);
  const rawColorUtilities = staticClasses.split(/\s+/).filter((utility) =>
    /^(?:bg|text|border|ring|fill|stroke)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}(?:\/\d+)?$|^bg-panel-graphite(?:\/\d+)?$/.test(utility)
      && !allowedUtilities.has(utility)
  );
  if (rawColorUtilities.length > 0) {
    add("UI-06", "Raw Tailwind palette bypasses semantic surface/color roles.");
  }
  if (/\btransition-all\b/.test(staticClasses)) add("UI-SOURCE-TRANSITION-ALL", "transition-all is prohibited.");
  if (/(?:^|\s)[^\s]*\[[^\]]+\]/.test(staticClasses)) add("UI-SOURCE-ARBITRARY-VALUE", "Unregistered arbitrary Tailwind value is prohibited.");
  if ((has(/grid-cols-4/) && has(/data-metric-count=["']5["']/)) || has(/repeat\(auto-fit,\s*minmax\(180px,\s*1fr\)\)/)) {
    add("UI-01", "Metric cardinality and columns create an orphan final row.");
  }
  if (/\bflex\b[^\n]*\bjustify-between\b|\bjustify-between\b[^\n]*\bflex\b/.test(staticClasses)) add("UI-02", "Related row uses unconstrained justify-between instead of a semantic two-column grid.");
  if (/\bfont-serif\b/.test(staticClasses)) add("UI-08", "Application heading bypasses the governed section-title typography role.");
  if (has(/\blg:grid-cols-3\b/) && has(/financial-summary-card/) && !has(/<aside\b/)) add("UI-07", "Detail summaries are direct grid children instead of an owned aside region.");
  if (hasTable && !has(/PageHeader|SectionHeader|EmptyState/)) add("UI-12", "Data table lacks required task context or state support.");

  const catalog = Array.isArray(policy.locale?.catalog) ? policy.locale.catalog : [];
  const catalogEntries = new Set(catalog.map((entry) => typeof entry === "string" ? entry : entry?.value).filter(Boolean));
  for (const literal of visibleLiterals) {
    if (!catalogEntries.has(literal)) add("UI-10", `Visible copy '${literal}' is outside the compiled locale catalog.`, { targetId: literal });
  }
  findings.push(...visibleLiteralFindings(source, catalog));
  return { findings: uniqueFindings(findings) };
}

function number(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sameStyle(left, right) {
  return left?.fontSizePx === right?.fontSizePx && left?.fontWeight === right?.fontWeight;
}

export function analyzeUiFacts(expected, rendered, sourceFacts = null) {
  requireObject(expected, "expected render model");
  requireObject(rendered, "rendered UI evidence");
  const expectedElements = Array.isArray(expected.elements) ? expected.elements : [];
  const renderedElements = Array.isArray(rendered.elements) ? rendered.elements : [];
  const observed = new Set(renderedElements.map((element) => element.id));
  const missing = expectedElements.filter((element) => !observed.has(element.id)).map((element) => element.id).sort();
  const findings = [];

  if (missing.length > 0) {
    findings.push(finding("UI-COVERAGE-MISSING", `${missing.length} expected render item(s) were not observed.`, { severity: "P0", expected: expectedElements.length, actual: renderedElements.length, missing }));
  }
  const grid = expected.relations?.grid;
  if (grid && number(grid.cardinality) !== null && number(grid.columns) !== null && grid.cardinality % grid.columns !== 0 && !grid.lastRowPolicy) {
    findings.push(finding("UI-01", "Metric grid has an orphan last row without a compiled policy.", { targetId: grid.id, expected: { lastRowPolicy: "compiled" }, actual: { cardinality: grid.cardinality, columns: grid.columns } }));
  }
  const expectedProximity = expected.relations?.proximity;
  const renderedProximity = rendered.relations?.proximity;
  if (expectedProximity && renderedProximity && number(expectedProximity.expectedGapPx) !== null && number(renderedProximity.actualGapPx) !== null && renderedProximity.actualGapPx > expectedProximity.expectedGapPx) {
    findings.push(finding("UI-02", "Related content exceeds its compiled proximity token.", { targetId: expectedProximity.id, expected: expectedProximity.expectedGapPx, actual: renderedProximity.actualGapPx }));
  }
  const expectedTypes = expected.relations?.typeRoles;
  const renderedTypes = rendered.relations?.typeRoles;
  if (expectedTypes && renderedTypes && (!sameStyle(expectedTypes.label, renderedTypes.label) || !sameStyle(expectedTypes.metric, renderedTypes.metric) || sameStyle(renderedTypes.label, renderedTypes.metric))) {
    findings.push(finding("UI-03", "Computed typography does not preserve the compiled label/metric hierarchy.", { expected: expectedTypes, actual: renderedTypes }));
  }
  const expectedSurfaces = expected.relations?.surfaces;
  const renderedSurfaces = rendered.relations?.surfaces;
  if (expectedSurfaces && renderedSurfaces && expectedSurfaces.canvas !== expectedSurfaces.raised && renderedSurfaces.canvas === renderedSurfaces.raised) {
    findings.push(finding("UI-06", "Computed surface roles are visually collapsed.", { expected: expectedSurfaces, actual: renderedSurfaces }));
  }

  const statusSignatures = new Map();
  for (const status of rendered.statuses ?? []) {
    const signature = `${status.semanticRole ?? ""}:${status.variant ?? ""}:${status.computedColor ?? ""}`;
    if (!statusSignatures.has(signature)) statusSignatures.set(signature, new Set());
    statusSignatures.get(signature).add(status.domainValue);
  }
  for (const [signature, domainValues] of statusSignatures) {
    if (domainValues.size > 1) {
      findings.push(finding("UI-04", "Distinct domain statuses resolve to the same rendered semantic signature.", {
        targetId: signature,
        actual: [...domainValues].sort()
      }));
    }
  }

  for (const interaction of rendered.interactions ?? []) {
    const actionExpected = interaction.actionExpected === true || interaction.clickable === true;
    const semanticElement = ["a", "button"].includes(String(interaction.tagName ?? "").toLowerCase());
    const missingSignals = [
      !semanticElement && "semantic-element",
      interaction.keyboard !== true && "keyboard",
      interaction.focusVisible !== true && "focus-visible",
      !String(interaction.accessibleName ?? "").trim() && "accessible-name"
    ].filter(Boolean);
    if (actionExpected && missingSignals.length > 0) {
      findings.push(finding("UI-05", "Action affordance is incomplete or non-semantic.", { targetId: interaction.id, actual: { missingSignals } }));
    }
    if (!actionExpected && interaction.hover === true) {
      findings.push(finding("UI-05", "Hover signifier implies an action that does not exist.", { targetId: interaction.id }));
    }
    const minimumTarget = expected.relations?.hitTargets?.[interaction.role] ?? expected.relations?.hitTargets?.default;
    if (minimumTarget && interaction.box && (interaction.box.width < minimumTarget.width || interaction.box.height < minimumTarget.height)) {
      findings.push(finding("UI-HIT-TARGET", "Interactive hit target is smaller than its compiled role token.", { targetId: interaction.id, expected: minimumTarget, actual: interaction.box }));
    }
    const requiredStates = expected.relations?.interactiveStates?.[interaction.role] ?? [];
    const missingStates = requiredStates.filter((state) => !(interaction.states ?? []).includes(state));
    if (missingStates.length > 0) findings.push(finding("UI-INTERACTIVE-STATE", "Required interactive states were not observed.", { targetId: interaction.id, missing: missingStates }));
  }

  for (const region of rendered.regions ?? []) {
    const expectedRegion = (expected.relations?.regions ?? []).find((item) => item.id === region.id);
    if (!expectedRegion) continue;
    const orphan = expectedRegion.allowUnit !== true && region.childCount === 1 && region.span < expectedRegion.minimumUnitSpan;
    const spanDrift = number(expectedRegion.expectedSpan) !== null && number(region.span) !== null && region.span < expectedRegion.expectedSpan;
    if (orphan || spanDrift) {
      findings.push(finding("UI-07", "A summary region is orphaned or occupies less grid span than its recipe requires.", { targetId: region.id, expected: expectedRegion, actual: region }));
    }
  }

  for (const heading of rendered.headings ?? []) {
    const expectedHeading = (expected.relations?.headings ?? []).find((item) => item.id === heading.id || item.role === heading.role);
    if (expectedHeading && (
      (expectedHeading.fontFamily && heading.fontFamily !== expectedHeading.fontFamily) ||
      (expectedHeading.textRole && heading.textRole !== expectedHeading.textRole)
    )) {
      findings.push(finding("UI-08", "Heading computed typography diverges from its application role.", { targetId: heading.id, expected: expectedHeading, actual: heading }));
    }
  }

  for (const outline of rendered.outline ?? []) {
    if (outline.role === "page-title" && ["legend", "fieldset"].includes(String(outline.tagName).toLowerCase())) {
      findings.push(finding("UI-09", "Page heading semantics are implemented with form grouping elements.", { targetId: outline.id, actual: outline.tagName }));
    }
  }

  for (const contentIssue of rendered.contentQuality ?? []) {
    if (contentIssue.valid === false || contentIssue.catalogMatch === false || contentIssue.localeMatch === false) {
      findings.push(finding("UI-10", "Visible content violates the compiled locale/catalog contract.", { targetId: contentIssue.id, actual: contentIssue.text }));
    }
  }

  const colorFamily = rendered.relations?.colorFamily;
  if (colorFamily && colorFamily.navActiveFamily !== colorFamily.accentFamily && colorFamily.exceptionApproved !== true) {
    findings.push(finding("UI-11", "Active navigation and application accent use conflicting color families.", { expected: colorFamily.accentFamily, actual: colorFamily.navActiveFamily }));
  }

  const requiredSignals = expected.relations?.decisionSupport?.requiredSignals ?? [];
  const observedSignals = new Set(rendered.decisionSupport?.signals ?? []);
  const missingSignals = requiredSignals.filter((signal) => !observedSignals.has(signal));
  if (missingSignals.length > 0) {
    findings.push(finding("UI-12", "Operational surface is missing compiled decision-support signals.", { missing: missingSignals }));
  }

  for (const layout of rendered.layoutChecks ?? []) {
    if (layout.overflow === true) findings.push(finding("UI-OVERFLOW", "Rendered content overflows its governed container.", { targetId: layout.id }));
    if (layout.occluded === true) findings.push(finding("UI-OCCLUSION", "Rendered content is occluded.", { targetId: layout.id }));
    if (layout.layerValid === false) findings.push(finding("UI-LAYERING", "Rendered z-index/layer violates the compiled layer contract.", { targetId: layout.id }));
    if (number(layout.layoutShift) !== null && number(layout.maximumLayoutShift) !== null && layout.layoutShift > layout.maximumLayoutShift) {
      findings.push(finding("UI-LAYOUT-STABILITY", "Layout shift exceeds the compiled state budget.", { targetId: layout.id, expected: layout.maximumLayoutShift, actual: layout.layoutShift }));
    }
    if (layout.textResilience === false) findings.push(finding("UI-TEXT-RESILIENCE", "Content does not survive the compiled text expansion case.", { targetId: layout.id }));
  }

  const expectedFocusOrder = expected.relations?.focusOrder ?? [];
  const actualFocusOrder = rendered.focusOrder ?? [];
  if (expectedFocusOrder.length > 0 && JSON.stringify(expectedFocusOrder) !== JSON.stringify(actualFocusOrder)) {
    findings.push(finding("UI-FOCUS-ORDER", "Focus order diverges from the compiled interaction order.", { expected: expectedFocusOrder, actual: actualFocusOrder }));
  }

  const spacingScale = new Set(expected.relations?.spacingRhythm?.allowedPx ?? []);
  for (const spacing of rendered.spacing ?? []) {
    if (spacingScale.size > 0 && !spacingScale.has(spacing.valuePx)) {
      findings.push(finding("UI-SPACING-RHYTHM", "Rendered spacing does not resolve to an allowed semantic spacing token.", { targetId: spacing.id, actual: spacing.valuePx }));
    }
  }

  for (const issue of rendered.accessibility ?? []) {
    if (["P0", "P1", "critical", "serious"].includes(issue.severity)) {
      const kind = String(issue.kind ?? issue.id ?? "axe").toUpperCase().replace(/[^A-Z0-9]+/g, "-");
      const id = kind.includes("CONTRAST") ? "UI-A11Y-CONTRAST" : kind.includes("KEYBOARD") ? "UI-A11Y-KEYBOARD" : "UI-A11Y-AXE";
      findings.push(finding(id, issue.message ?? "Blocking accessibility failure.", { severity: issue.severity === "P0" ? "P0" : "P1", targetId: issue.id, findingKey: `${id}:${issue.id}` }));
    }
  }
  for (const sourceFinding of sourceFacts?.findings ?? []) findings.push(sourceFinding);

  return artifact("ui-findings", {
    subject: subjectFrom(expected),
    policyDigest: expected.policyDigest ?? null,
    expectedDigest: expected.semanticDigest ?? canonicalDigest(expected),
    renderedDigest: rendered.semanticDigest ?? canonicalDigest(rendered),
    coverage: { expected: expectedElements.length, observed: observed.size, missing },
    findings: uniqueFindings(findings)
  });
}

export function deriveUiQualityGate(findingsInput, perceptual = {}, receipts = [], productDesignReadiness = null) {
  const findings = Array.isArray(findingsInput) ? uniqueFindings(findingsInput) : uniqueFindings(findingsInput?.findings ?? []);
  const blocking = findings.filter((item) => ["P0", "P1", "critical", "serious"].includes(item.severity));
  const requiredExecutions = new Map([
    ["profile", "frontend-ui-policy-control"],
    ["compile", "frontend-ui-policy-control"],
    ["lint", "frontend-ui-source-control"],
    ["collect", "frontend-ui-render-control"],
    ["analyze", "frontend-ui-render-control"]
  ]);
  const observedExecutions = new Map(receipts.map((receipt) => [receipt?.command?.[0], receipt?.capabilityId]));
  const missingExecutions = [...requiredExecutions].filter(([command, capabilityId]) => observedExecutions.get(command) !== capabilityId).map(([command]) => command).sort();
  const invalidCapabilities = receipts.filter((receipt) => !verifyCapabilityReceipt(receipt).valid).map((receipt) => receipt?.capabilityId ?? "unknown").sort();
  const failedCapabilities = receipts.filter((receipt) => receipt?.exitCode !== 0).map((receipt) => receipt?.capabilityId ?? "unknown").sort();
  const subject = subjectFrom(findingsInput);
  const staleCapabilities = receipts.filter((receipt) => {
    const receiptSubject = subjectFrom(receipt);
    const commitMismatch = subject.commit && receiptSubject.commit && subject.commit !== receiptSubject.commit;
    const policyMismatch = findingsInput?.policyDigest && receipt?.policyDigest && findingsInput.policyDigest !== receipt.policyDigest;
    return commitMismatch || policyMismatch;
  }).map((receipt) => receipt?.capabilityId ?? "unknown").sort();
  const chainErrors = verifyUiReceiptChain(findingsInput, receipts);
  const receiptBlockingIds = [
    ...(chainErrors.length ? ["UI-CAPABILITY-CHAIN-INVALID"] : []),
    ...(missingExecutions.length > 0 ? ["UI-CAPABILITY-NOT-RUN"] : []),
    ...(invalidCapabilities.length > 0 ? ["UI-CAPABILITY-RECEIPT-INVALID"] : []),
    ...(failedCapabilities.length > 0 ? ["UI-CAPABILITY-RECEIPT-FAILED"] : []),
    ...(staleCapabilities.length > 0 ? ["UI-CAPABILITY-RECEIPT-STALE"] : [])
  ];
  const productDesignRequired = findingsInput?.productDesignRequired === true;
  const productDesignVerification = productDesignReadiness
    ? validateProductDesignReadinessReceipt(productDesignReadiness, { subject, policyDigest: findingsInput?.policyDigest })
    : { valid: false, passed: false, stale: false, status: "not-supplied", digest: "", errors: [] };
  const productDesignBlockingIds = !productDesignReadiness
    ? (productDesignRequired ? ["UI-PRODUCT-DESIGN-NOT-RUN"] : [])
    : productDesignVerification.stale
      ? ["UI-PRODUCT-DESIGN-STALE"]
      : !productDesignVerification.valid
        ? ["UI-PRODUCT-DESIGN-INVALID"]
        : !productDesignVerification.passed
          ? ["UI-PRODUCT-DESIGN-FAILED"]
          : [];
  // RULE-FE-UI-RENDER-001 requires deterministic browser facts, but `collect`
  // accepts hand-written observations when no --url is given. That path emits
  // provenance.browser = null and a browserDigest = null receipt, and nothing
  // downstream noticed — so the rule was satisfiable without ever launching a
  // browser. The render receipt itself carries the evidence, so check it here.
  const renderReceipts = receipts.filter(
    (receipt) => receipt?.capabilityId === "frontend-ui-render-control"
  );
  const fabricatedRenderEvidence = renderReceipts.length > 0
    && renderReceipts.every((receipt) => !receipt.browserDigest);
  const renderProvenanceBlockingIds = fabricatedRenderEvidence
    ? ["UI-RENDER-PROVENANCE-MISSING"]
    : [];

  const receiptDigests = receipts.map((receipt) => receipt.semanticDigest).filter(Boolean).sort();
  return artifact("ui-quality-gate", {
    subject,
    policyDigest: findingsInput?.policyDigest ?? null,
    eligible: blocking.length === 0
      && receiptBlockingIds.length === 0
      && productDesignBlockingIds.length === 0
      && renderProvenanceBlockingIds.length === 0,
    blockingFindingIds: [...new Set([
      ...blocking.map((item) => item.id),
      ...receiptBlockingIds,
      ...productDesignBlockingIds,
      ...renderProvenanceBlockingIds
    ])].sort(),
    objectiveFindingDigest: canonicalDigest(findings),
    receiptDigests,
    receiptVerification: { missingExecutions, invalidCapabilities, failedCapabilities, staleCapabilities, chainErrors },
    productDesignVerification: {
      required: productDesignRequired,
      supplied: Boolean(productDesignReadiness),
      ...productDesignVerification
    },
    renderProvenance: {
      receipts: renderReceipts.length,
      browserBacked: renderReceipts.filter((receipt) => Boolean(receipt.browserDigest)).length
    },
    perceptualResidueDigest: canonicalDigest(perceptual)
  });
}

function commonDirectory(paths) {
  const absolutePaths = paths.map((filePath) => path.resolve(filePath));
  let candidate = path.dirname(absolutePaths[0]);
  while (!absolutePaths.every((filePath) => {
    const relative = path.relative(candidate, filePath);
    return relative && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative);
  })) {
    const parent = path.dirname(candidate);
    if (parent === candidate) throw new Error("Receipt paths do not share a safe evidence root.");
    candidate = parent;
  }
  return candidate;
}

function pathRecords(paths, evidenceRoot) {
  return [...paths].map((filePath) => {
    const ref = path.relative(evidenceRoot, path.resolve(filePath)).split(path.sep).join("/");
    if (!ref || ref === ".." || ref.startsWith("../")) throw new Error(`Receipt path escapes its evidence root: ${filePath}`);
    return { ref, sha256: fileDigest(filePath) };
  }).sort((left, right) => left.ref.localeCompare(right.ref));
}

export function createCapabilityReceipt(input) {
  requireObject(input, "capability receipt input");
  if (!Number.isInteger(input.exitCode) || input.exitCode < 0) throw new Error("Capability receipt requires a real non-negative integer exit code.");
  if (!Array.isArray(input.outputs) || input.outputs.length === 0) throw new Error("Capability receipt requires at least one output.");
  for (const filePath of [...(input.inputs ?? []), ...input.outputs]) {
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) throw new Error(`Receipt file does not exist: ${filePath}`);
  }
  const receiptPaths = [...(input.inputs ?? []), ...input.outputs];
  const evidenceRoot = commonDirectory(receiptPaths);
  return artifact("capability-receipt", {
    capabilityId: String(input.capabilityId),
    command: [...(input.command ?? [])],
    subject: subjectFrom(input),
    policyDigest: input.policyDigest ?? null,
    adapterDigest: input.adapterDigest ?? null,
    browserDigest: input.browserDigest ?? null,
    fixtureDigest: input.fixtureDigest ?? null,
    evidenceRoot: { scheme: "receipt-relative-v1", absolutePath: evidenceRoot },
    inputs: pathRecords(input.inputs ?? [], evidenceRoot),
    outputs: pathRecords(input.outputs, evidenceRoot),
    exitCode: input.exitCode
  });
}

export function verifyCapabilityReceipt(receipt, options = {}) {
  const errors = validateJsonSchema(receipt, readJson(path.join(ROOT, "integrations/frontend/ui-engineering-control.schema.json")));
  if (errors.length) return { valid: false, successful: false, errors };
  if (!isObject(receipt) || receipt.artifactKind !== "capability-receipt") errors.push("artifact kind is not capability-receipt");
  if (!Number.isInteger(receipt?.exitCode) || receipt.exitCode < 0) errors.push("receipt exit code is invalid");
  if (receipt?.evidenceRoot?.scheme !== "receipt-relative-v1" || !path.isAbsolute(receipt?.evidenceRoot?.absolutePath ?? "")) errors.push("receipt evidence root is invalid");
  if (options.requireSuccess === true && receipt?.exitCode !== 0) errors.push("receipt command did not pass");
  for (const expected of [...(receipt?.inputs ?? []), ...(receipt?.outputs ?? [])]) {
    if (path.isAbsolute(expected.ref) || expected.ref === ".." || expected.ref.startsWith("../")) {
      errors.push(`receipt ref escapes its evidence root: ${expected.ref}`);
      continue;
    }
    const candidates = [receipt?.evidenceRoot?.absolutePath, options.baseDirectory, process.cwd()].filter(Boolean).map((root) => path.resolve(root, expected.ref));
    const resolved = candidates.find((candidate) => fs.existsSync(candidate));
    if (!resolved) errors.push(`receipt file is missing: ${expected.ref}`);
    else if (fileDigest(resolved) !== expected.sha256) errors.push(`receipt file digest changed: ${expected.ref}`);
  }
  if (receipt?.semanticDigest !== canonicalDigest(receipt)) errors.push("receipt semantic digest is invalid");
  return { valid: errors.length === 0, successful: receipt?.exitCode === 0, errors };
}

export function createHumanDecisionDraft(gate, input) {
  requireObject(gate, "UI quality gate");
  requireObject(input, "human decision input");
  if (gate.eligible !== true) throw new Error("Human decision draft requires an eligible objective gate.");
  if (!String(input.principal ?? "").trim()) throw new Error("Human decision requires a principal.");
  const allowed = ["approved", "approved-with-changes", "approved-with-accepted-risk", "rejected"];
  if (!allowed.includes(input.decision)) throw new Error("Unsupported human decision.");
  const scopeVerification = validateHumanDecisionScope(input.authorityScope);
  if (!scopeVerification.valid) throw new Error(`Human decision scope is invalid: ${scopeVerification.errors.join(", ")}`);
  if (input.decision === "approved-with-accepted-risk") {
    const missing = ["id", "owner", "scope", "expiry", "mitigation"].filter((key) => !String(input.risk?.[key] ?? "").trim());
    if (missing.length > 0) throw new Error(`Accepted risk requires ${missing.join(", ")}.`);
  }
  return artifact("human-decision-receipt", {
    subject: gate.subject,
    principal: input.principal,
    decision: input.decision,
    gateDigest: gate.semanticDigest ?? canonicalDigest(gate),
    policyDigest: gate.policyDigest ?? null,
    receiptDigests: gate.receiptDigests ?? [],
    authorityScope: input.authorityScope,
    risk: input.decision === "approved-with-accepted-risk" ? input.risk : null,
    signatureNamespace: "sde-human-decision-v1"
  });
}

export function verifyHumanDecision({ decisionPath, signaturePath, allowedSignersPath, principal, gate, purpose = "release-authorization", now = Date.now() }) {
  const errors = [];
  for (const filePath of [decisionPath, signaturePath, allowedSignersPath]) {
    if (!filePath || !fs.existsSync(filePath)) errors.push(`required verification file is missing: ${filePath ?? "<empty>"}`);
  }
  if (errors.length > 0) return { valid: false, errors };
  const decision = JSON.parse(fs.readFileSync(decisionPath, "utf8"));
  errors.push(...authorizationErrors(gate, decision, { purpose, now }));
  if (decision.principal !== principal) errors.push("decision principal does not match verifier principal");
  if (decision.signatureNamespace !== "sde-human-decision-v1") errors.push("decision signature namespace is invalid");
  if (decision.semanticDigest !== canonicalDigest(decision)) errors.push("decision semantic digest is invalid");
  const scopeVerification = validateHumanDecisionScope(decision.authorityScope);
  if (!scopeVerification.valid) errors.push(...scopeVerification.errors);
  if (decision.decision === "approved-with-accepted-risk") {
    const missing = ["id", "owner", "scope", "expiry", "mitigation"].filter((key) => !String(decision.risk?.[key] ?? "").trim());
    if (missing.length > 0) errors.push(`accepted risk is incomplete: ${missing.join(", ")}`);
  }
  if (errors.length === 0) {
    const result = spawnSync("ssh-keygen", [
      "-Y", "verify",
      "-f", allowedSignersPath,
      "-I", principal,
      "-n", "sde-human-decision-v1",
      "-s", signaturePath
    ], { input: fs.readFileSync(decisionPath), encoding: "utf8" });
    if (result.status !== 0) errors.push(`OpenSSH verification failed: ${String(result.stderr || result.stdout).trim()}`);
  }
  return { valid: errors.length === 0, errors, decision };
}

export function scanPrivateContent(value) {
  const findings = [];
  const visit = (current, pointer) => {
    if (Array.isArray(current)) return current.forEach((item, index) => visit(item, `${pointer}/${index}`));
    if (isObject(current)) {
      for (const [key, child] of Object.entries(current)) {
        if (PRIVATE_KEY_NAMES.test(key)) findings.push({ id: "UI-PRIVATE-FIELD", pointer: `${pointer}/${key}` });
        visit(child, `${pointer}/${key}`);
      }
      return;
    }
    if (typeof current === "string" && PRIVATE_VALUE_PATTERNS.some((pattern) => pattern.test(current))) {
      findings.push({ id: "UI-PRIVATE-VALUE", pointer });
    }
  };
  visit(value, "$");
  return findings;
}

export function createClientDeliveryAttestation(gate, decision) {
  requireObject(gate, "UI quality gate");
  requireObject(decision, "human decision receipt");
  const authorization = authorizationErrors(gate, decision);
  if (authorization.length) throw new Error(`Delivery authorization rejected: ${authorization.join("; ")}`);
  const gateDigest = gate.semanticDigest ?? canonicalDigest(gate);
  if (decision.gateDigest !== gateDigest) throw new Error("Human decision gate digest does not match the objective gate digest.");
  const result = artifact("ui-conformance-attestation", {
    subject: gate.subject,
    policyDigest: gate.policyDigest ?? null,
    gateDigest,
    receiptDigests: [...(gate.receiptDigests ?? [])],
    decision: decision.decision,
    decisionDigest: decision.semanticDigest ?? canonicalDigest(decision)
  });
  const privacy = scanPrivateContent(result);
  if (privacy.length > 0) throw new Error(`Client delivery attestation contains private content: ${JSON.stringify(privacy)}`);
  return result;
}

export function resolveVisualArtifactAuthority(value, rolloutMode) {
  const major = Number.parseInt(String(value?.schemaVersion ?? "1").split(".")[0], 10);
  if (major < 2) return rolloutMode === "shadow" ? "shadow" : "rejected";
  if (major === 2 && value?.generatedFrom?.gateDigest) return rolloutMode === "primary" ? "primary" : "shadow";
  return "rejected";
}

export function projectVisualCompositionEvidenceV2({ findings, gate }) {
  return artifact("visual-composition-evidence", {
    generatedFrom: { gateDigest: gate.semanticDigest },
    status: gate.eligible ? "eligible" : "ineligible",
    objectiveFindings: findings.map(({ id, severity, message, findingKey }) => ({ id, severity, message, findingKey: findingKey ?? `${id}:${message}` }))
  }, "2.0.0");
}

export function projectVisualQualityScorecardV2({ findings, gate }) {
  return artifact("visual-quality-scorecard", {
    generatedFrom: { gateDigest: gate.semanticDigest },
    decisionState: gate.eligible ? "eligible-for-human-decision" : "objective-gate-failed",
    objectiveCriteria: findings.map(({ id, severity, message, findingKey }) => ({ id, severity, message, findingKey: findingKey ?? `${id}:${message}` }))
  }, "2.0.0");
}

function parseArgs(argv) {
  const result = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) result._.push(item);
    else {
      const key = item.slice(2);
      if (Object.hasOwn(result, key)) throw new Error(`Repeated flag: --${key}`);
      const next = argv[index + 1];
      if (!next || next.startsWith("--")) result[key] = true;
      else { result[key] = next; index += 1; }
    }
  }
  return result;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8"));
}

function atomicWrite(filePath, value) {
  const target = path.resolve(filePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temporary, target);
}

function atomicWriteText(filePath, value) {
  const target = path.resolve(filePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, value.endsWith("\n") ? value : `${value}\n`);
  fs.renameSync(temporary, target);
}

function writeCommandReceipt({ args, capabilityId, inputPaths, outputPaths, subject, policyDigest = null, adapterDigest = null, browserDigest = null, fixtureDigest = null, exitCode = 0 }) {
  const receipt = createCapabilityReceipt({
    capabilityId,
    command: process.argv.slice(2),
    subject,
    policyDigest,
    adapterDigest,
    browserDigest,
    fixtureDigest,
    inputs: inputPaths,
    outputs: outputPaths,
    exitCode
  });
  const receiptPath = args.receipt ? path.resolve(args.receipt) : path.join(path.resolve(args["output-dir"] ?? path.dirname(outputPaths[0])), "capability-receipt.json");
  atomicWrite(receiptPath, receipt);
  return receiptPath;
}

function requireFlag(args, flag) {
  if (!args[flag] || args[flag] === true) throw new Error(`--${flag} is required.`);
  return String(args[flag]);
}

async function collectFromUrl(request) {
  let chromium;
  try {
    ({ chromium } = runtimeRequire("playwright"));
  } catch {
    const error = new Error("Playwright is unavailable for URL collection.");
    error.exitCode = 4;
    throw error;
  }
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      locale: request.locale ?? "pt-BR",
      timezoneId: request.timezoneId ?? "America/Sao_Paulo",
      viewport: request.viewport ?? { width: 1440, height: 900 },
      reducedMotion: "reduce"
    });
    const page = await context.newPage();
    if (request.clockIso) {
      await page.addInitScript((clockIso) => {
        const fixed = new Date(clockIso).valueOf();
        const NativeDate = Date;
        globalThis.Date = class extends NativeDate {
          constructor(...args) { super(...(args.length === 0 ? [fixed] : args)); }
          static now() { return fixed; }
        };
      }, request.clockIso);
    }
    const allowedOrigin = new URL(request.url).origin;
    await page.route("**/*", async (route) => {
      const target = new URL(route.request().url());
      if (request.allowNetwork === true || target.origin === allowedOrigin || ["data:", "blob:"].includes(target.protocol)) await route.continue();
      else await route.abort("blockedbyclient");
    });
    await page.goto(request.url, { waitUntil: "networkidle" });
    await page.addStyleTag({ content: "*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important;caret-color:transparent!important}" });
    await page.evaluate(() => document.fonts?.ready);
    const elements = await page.locator("[data-ui-evidence-id]").evaluateAll((nodes) => nodes.map((node) => {
      const style = getComputedStyle(node);
      const box = node.getBoundingClientRect();
      const parentBox = node.parentElement?.getBoundingClientRect();
      return {
        id: node.getAttribute("data-ui-evidence-id"),
        role: node.getAttribute("role") || node.tagName.toLowerCase(),
        tagName: node.tagName.toLowerCase(),
        accessibleName: node.getAttribute("aria-label") || node.getAttribute("alt") || node.getAttribute("title") || "",
        box: { x: box.x, y: box.y, width: box.width, height: box.height },
        parentBox: parentBox ? { x: parentBox.x, y: parentBox.y, width: parentBox.width, height: parentBox.height } : null,
        visible: box.width > 0 && box.height > 0 && style.visibility !== "hidden" && style.display !== "none",
        overflow: { x: node.scrollWidth > node.clientWidth, y: node.scrollHeight > node.clientHeight },
        computedStyle: {
          display: style.display,
          gap: style.gap,
          rowGap: style.rowGap,
          columnGap: style.columnGap,
          gridTemplateColumns: style.gridTemplateColumns,
          gridColumn: style.gridColumn,
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          lineHeight: style.lineHeight,
          letterSpacing: style.letterSpacing,
          color: style.color,
          backgroundColor: style.backgroundColor,
          borderColor: style.borderColor,
          boxShadow: style.boxShadow,
          zIndex: style.zIndex,
          position: style.position,
          overflow: style.overflow
        }
      };
    }));
    const interactions = [];
    const interactive = page.locator("a,button,input,select,textarea,[tabindex]:not([tabindex='-1']),[data-ui-action]");
    for (let index = 0; index < await interactive.count(); index += 1) {
      const locator = interactive.nth(index);
      await locator.focus();
      interactions.push(await locator.evaluate((node) => {
        const style = getComputedStyle(node);
        const box = node.getBoundingClientRect();
        return {
          id: node.getAttribute("data-ui-evidence-id") || node.id || `interactive-${node.tagName.toLowerCase()}`,
          role: node.getAttribute("role") || node.tagName.toLowerCase(),
          tagName: node.tagName.toLowerCase(),
          actionExpected: true,
          clickable: true,
          keyboard: true,
          focusVisible: node.matches(":focus-visible") && (style.outlineStyle !== "none" || style.boxShadow !== "none"),
          accessibleName: node.getAttribute("aria-label") || node.getAttribute("title") || "",
          box: { width: box.width, height: box.height },
          states: ["default", "focus-visible"]
        };
      }));
    }
    const screenshot = request.screenshotPath ? path.resolve(request.screenshotPath) : null;
    if (screenshot) {
      fs.mkdirSync(path.dirname(screenshot), { recursive: true });
      await page.screenshot({ path: screenshot, fullPage: true, animations: "disabled" });
    }
    return {
      observations: elements,
      interactions,
      screenshot,
      browser: { name: "chromium", version: browser.version(), playwright: runtimeRequire("playwright/package.json").version }
    };
  } finally {
    await browser.close();
  }
}

export function authorizationErrors(gate, decision, { purpose = "release-authorization", now = Date.now() } = {}) {
  const errors = [];
  if (!gate || gate.eligible !== true || gate.semanticDigest !== canonicalDigest(gate)) errors.push("Current eligible gate with valid digest is required");
  if (!["approved", "approved-with-accepted-risk"].includes(decision?.decision)) errors.push("Decision does not approve authorization; rejection or pending changes block");
  if (decision?.authorityScope?.kind !== purpose) errors.push(`Authorization requires ${purpose}`);
  if (!gate || decision?.gateDigest !== gate.semanticDigest) errors.push("Authorization gate digest does not match current gate");
  if (!gate || canonicalDigest(decision?.subject ?? null) !== canonicalDigest(gate.subject)) errors.push("Authorization subject differs from current snapshot");
  if (!gate || !gate.policyDigest || decision?.policyDigest !== gate.policyDigest) errors.push("Authorization policy differs from current gate");
  if (!Array.isArray(decision?.receiptDigests) || canonicalDigest([...decision.receiptDigests].sort()) !== canonicalDigest([...(gate?.receiptDigests ?? [])].sort())) errors.push("Authorization receipts differ from current gate");
  if (decision?.conditions?.length || decision?.pendingConditions?.length || decision?.authorityScope?.conditions?.length) errors.push("Pending authorization conditions must be resolved in a new approval");
  if (decision?.decision === "approved-with-accepted-risk") {
    const expiry = Date.parse(decision.risk?.expiry);
    if (!Number.isFinite(expiry) || expiry <= now) errors.push("Accepted risk is expired or has an invalid expiry");
    for (const key of ["id", "owner", "scope", "mitigation"]) if (!String(decision.risk?.[key] ?? "").trim()) errors.push(`Accepted risk requires ${key}`);
  }
  return errors;
}

function trustedHumanAuthority(root) {
  const configPath = process.env.SDE_HUMAN_AUTHORITY;
  if (!configPath || !path.isAbsolute(configPath)) throw new Error("Trusted executor must set SDE_HUMAN_AUTHORITY to an absolute configuration path outside the checkout");
  const real = fs.realpathSync(configPath);
  if (real === fs.realpathSync(root) || real.startsWith(`${fs.realpathSync(root)}${path.sep}`)) throw new Error("Human authority configuration must be outside the agent checkout");
  const config = readJson(real);
  if (!String(config.project ?? "").trim()) throw new Error("Trusted authority requires the current project identity");
  if (!String(config.principal ?? "").trim() || !path.isAbsolute(config.allowedSignersPath ?? "")) throw new Error("Trusted authority requires principal and absolute allowedSignersPath");
  const signers = fs.realpathSync(config.allowedSignersPath);
  if (signers.startsWith(`${fs.realpathSync(root)}${path.sep}`)) throw new Error("Allowed signers must be owned by the trusted executor outside checkout");
  return { principal: config.principal, allowedSignersPath: signers, project: config.project };
}

function verifyUiReceiptChain(findings, receipts) {
  const errors = [];
  if (!Array.isArray(receipts) || receipts.some(r => !verifyCapabilityReceipt(r).valid)) return ["Invalid receipts cannot form an execution chain"];
  const byCommand = new Map();
  for (const receipt of receipts) {
    const command = receipt.command[0];
    if (byCommand.has(command)) errors.push(`Duplicate execution ${command}`);
    byCommand.set(command, receipt);
  }
  const output = (command, kind) => {
    const receipt = byCommand.get(command);
    for (const record of receipt?.outputs ?? []) {
      try {
        const value = readJson(path.resolve(receipt.evidenceRoot.absolutePath, record.ref));
        if (value.artifactKind === kind) return { record, value };
      } catch { /* Non-JSON outputs such as CSS and screenshots are retained but not IR nodes. */ }
    }
    errors.push(`${command} did not produce ${kind}`);
    return null;
  };
  const profile = output("profile", "ui-platform-profile");
  const adapter = output("profile", "ui-adapter-resolution");
  const policy = output("compile", "ui-policy-compiled");
  const expected = output("compile", "expected-render-model");
  const source = output("lint", "source-ui-facts");
  const rendered = output("collect", "rendered-ui-evidence");
  const analyzed = output("analyze", "ui-findings");
  for (const [consumer, dependency] of [["compile", profile], ["compile", adapter], ["lint", policy], ["analyze", expected], ["analyze", source], ["analyze", rendered]]) {
    if (dependency && !(byCommand.get(consumer)?.inputs ?? []).some(record => record.sha256 === dependency.record.sha256)) errors.push(`${consumer} input is disconnected from its producer`);
  }
  if (analyzed && canonicalDigest(analyzed.value.findings) !== canonicalDigest(findings?.findings ?? findings)) errors.push("Presented findings are not the analyzed output");
  if (analyzed && (canonicalDigest(analyzed.value.subject) !== canonicalDigest(subjectFrom(findings)) || analyzed.value.policyDigest !== findings?.policyDigest)) errors.push("Presented findings context differs from analyzed output");
  if (rendered && (!rendered.value.provenance?.browser || canonicalDigest(rendered.value.provenance.browser) !== byCommand.get("collect")?.browserDigest)) errors.push("Browser evidence does not match collector receipt");
  if (expected && source && rendered && analyzed) {
    const recomputed = analyzeUiFacts(expected.value, rendered.value, source.value);
    if (canonicalDigest(recomputed) !== canonicalDigest(analyzed.value)) errors.push("Analysis differs from retained inputs");
  }
  return errors;
}

export async function executeUiPipeline(request, outputDir, { feature } = {}) {
  const root = process.cwd();
  const snapshot = sourceSnapshot(root);
  const output = path.resolve(outputDir);
  if (!output.startsWith(`${path.join(root, ".specs")}${path.sep}`)) throw new Error("UI execution output must be inside .specs to keep source snapshots stable");
  const input = key => projectFile(root, request[key]);
  const inputKeys = ["profileInput", "bundle", "sourceRequest", "collectRequest"];
  const inputDigests = inputKeys.map(key => canonicalDigest(readJson(input(key))));
  const commit = gitOutput(root, ["rev-parse", "HEAD"]).trim();
  const subject = readJson(input("profileInput")).subject;
  if (!subject?.project || subject.commit !== commit) throw new Error("UI execution subject must identify current HEAD");
  for (const key of inputKeys) if (canonicalDigest(readJson(input(key)).subject ?? null) !== canonicalDigest(subject)) throw new Error("UI input subjects must match current project and commit");
  const sourceRequest = readJson(input("sourceRequest"));
  if (!Array.isArray(sourceRequest.files) || !sourceRequest.files.length) throw new Error("Current source file inventory is required");
  const sourceRefs = sourceRequest.files.map(file => {
    const ref = path.relative(root, path.resolve(root, file)).split(path.sep).join("/");
    projectFile(root, ref);
    if (ref.startsWith(".specs/")) throw new Error("Evidence files cannot substitute for product source");
    return ref;
  });
  if (feature) {
    const context = loadExecutionContext(root, feature);
    const required = gitOutput(root, ["ls-files", "-z", "--cached", "--others", "--exclude-standard"]).split("\0").filter(ref => /\.(?:[cm]?[jt]sx?|css|scss|html|vue|svelte)$/.test(ref) && context.frontendPaths.some(directory => ref === directory || ref.startsWith(`${directory.replace(/\/$/, "")}/`)) && fs.existsSync(path.join(root, ref)));
    if (!context.frontendPaths.length || !required.length || required.some(ref => !sourceRefs.includes(ref))) throw new Error("UI source inventory omits frozen frontend scope");
  }
  const collectRequest = readJson(input("collectRequest"));
  if (!collectRequest.url || !/^https?:\/\//.test(collectRequest.url)) throw new Error("Gate execution requires a real browser URL; supplied observations cannot authorize a gate");
  const directories = Object.fromEntries(["profile", "compile", "lint", "collect", "analyze"].map(command => [command, path.join(output, command)]));
  const file = (command, name) => path.join(directories[command], name);
  const steps = [
    ["profile", "--input", input("profileInput")],
    ["compile", "--input", input("bundle"), "--profile", file("profile", "ui-platform-profile.json"), "--adapter", file("profile", "ui-adapter-resolution.json")],
    ["lint", "--input", input("sourceRequest"), "--policy", file("compile", "ui-policy.compiled.json")],
    ["collect", "--input", input("collectRequest")],
    ["analyze", "--expected", file("compile", "expected-render-model.json"), "--source", file("lint", "source-ui-facts.json"), "--rendered", file("collect", "rendered-ui-evidence.json")]
  ];
  for (const argv of steps) {
    const result = spawnSync(process.execPath, [SCRIPT_PATH, ...argv, "--output-dir", directories[argv[0]]], { cwd: root, encoding: "utf8", timeout: 120000 });
    if (result.status !== 0) throw new Error(`Fresh UI ${argv[0]} failed: ${result.stderr || result.stdout || result.error?.message}`);
  }
  if (inputKeys.some((key, index) => canonicalDigest(readJson(input(key))) !== inputDigests[index])) throw new Error("UI inputs changed during execution");
  if (sourceSnapshot(root) !== snapshot) throw new Error("Source changed during UI execution");
  return { snapshot, findingsPath: file("analyze", "ui-findings.json"), receiptPaths: steps.map(argv => file(argv[0], "capability-receipt.json")) };
}

async function runCli() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];
  if (args["report-only"] !== undefined || args["dry-run"] !== undefined) throw new Error("Diagnostic flags cannot change a UI verification operation");
  if (!command) throw new Error("A subcommand is required: profile|compile|lint|collect|analyze|gate|attest|verify.");

  if (command === "profile") {
    const inputPath = path.resolve(requireFlag(args, "input"));
    const outputDir = path.resolve(requireFlag(args, "output-dir"));
    const input = readJson(inputPath);
    const result = resolveUiPlatformProfile(input);
    fs.mkdirSync(outputDir, { recursive: true });
    const profilePath = path.join(outputDir, "ui-platform-profile.json");
    const resolutionPath = path.join(outputDir, "ui-adapter-resolution.json");
    atomicWrite(profilePath, result.profile);
    atomicWrite(resolutionPath, result.resolution);
    writeCommandReceipt({ args, capabilityId: "frontend-ui-policy-control", inputPaths: [inputPath], outputPaths: [profilePath, resolutionPath], subject: result.profile.subject, adapterDigest: result.resolution.semanticDigest, exitCode: result.findings.length > 0 ? 1 : 0 });
    if (result.findings.length > 0) { process.stdout.write(`${JSON.stringify(result)}\n`); process.exitCode = 1; }
    else process.stdout.write(`${JSON.stringify({ profile: profilePath, resolution: resolutionPath })}\n`);
    return;
  }

  if (command === "compile") {
    const inputPath = path.resolve(requireFlag(args, "input"));
    const profilePath = path.resolve(requireFlag(args, "profile"));
    const adapterPath = path.resolve(requireFlag(args, "adapter"));
    const outputDir = path.resolve(requireFlag(args, "output-dir"));
    const result = compileUiPolicy(readJson(inputPath), readJson(profilePath), readJson(adapterPath));
    fs.mkdirSync(outputDir, { recursive: true });
    const outputs = [
      ["ui-policy.compiled.json", result.policy],
      ["ui-token-resolution.json", result.tokenResolution],
      ["expected-render-model.json", result.expectedRenderModel],
      ["ui-findings.json", artifact("ui-findings", {
        subject: result.policy.subject,
        policyDigest: result.policy.semanticDigest,
        coverage: { expected: 0, observed: 0, missing: [] },
        findings: result.findings
      })]
    ].map(([name, value]) => { const target = path.join(outputDir, name); atomicWrite(target, value); return target; });
    const themePath = path.join(outputDir, "ui-theme.css");
    atomicWriteText(themePath, result.tailwindCss);
    outputs.push(themePath);
    writeCommandReceipt({ args, capabilityId: "frontend-ui-policy-control", inputPaths: [inputPath, profilePath, adapterPath], outputPaths: outputs, subject: result.policy.subject, policyDigest: result.policy.semanticDigest, adapterDigest: readJson(adapterPath).semanticDigest, exitCode: result.findings.length > 0 ? 1 : 0 });
    process.stdout.write(`${JSON.stringify({ outputs, findings: result.findings })}\n`);
    if (result.findings.length > 0) process.exitCode = 1;
    return;
  }

  if (command === "lint") {
    const inputPath = path.resolve(requireFlag(args, "input"));
    const policyPath = path.resolve(requireFlag(args, "policy"));
    const outputDir = path.resolve(requireFlag(args, "output-dir"));
    const request = readJson(inputPath);
    const policy = readJson(policyPath);
    const files = Array.isArray(request.files) ? request.files.map((file) => path.resolve(file)) : [];
    if (files.length === 0) throw new Error("lint input requires at least one source file.");
    const findings = uniqueFindings(files.flatMap((file) => lintReactTailwindSource(fs.readFileSync(file, "utf8"), policy).findings.map((item) => ({ ...item, location: path.basename(file) }))));
    const sourceFacts = artifact("source-ui-facts", {
      subject: subjectFrom(request),
      policyDigest: policy.semanticDigest,
      provenance: { adapterId: "react-tailwind-v4", parser: { name: "typescript", version: runtimeRequire("typescript/package.json").version } },
      files: files.map((file) => path.basename(file)),
      findings
    });
    const outputPath = path.join(outputDir, "source-ui-facts.json");
    atomicWrite(outputPath, sourceFacts);
    writeCommandReceipt({ args, capabilityId: "frontend-ui-source-control", inputPaths: [inputPath, policyPath, ...files], outputPaths: [outputPath], subject: sourceFacts.subject, policyDigest: policy.semanticDigest, exitCode: findings.some((item) => ["P0", "P1"].includes(item.severity)) ? 1 : 0 });
    process.stdout.write(`${JSON.stringify(sourceFacts)}\n`);
    if (findings.some((item) => ["P0", "P1"].includes(item.severity))) process.exitCode = 1;
    return;
  }

  if (command === "collect") {
    const inputPath = path.resolve(requireFlag(args, "input"));
    const request = readJson(inputPath);
    const outputDir = path.resolve(requireFlag(args, "output-dir"));
    const collected = request.url
      ? await collectFromUrl(request)
      : { observations: request.observations, interactions: request.interactions ?? [], screenshot: null, browser: request.browser ?? null };
    const observations = collected.observations;
    if (!Array.isArray(observations)) throw new Error("collect requires observations or a URL.");
    const evidence = artifact("rendered-ui-evidence", {
      subject: subjectFrom(request),
      provenance: {
        adapterId: request.adapterId ?? "normalized-facts",
        browser: collected.browser,
        locale: request.locale ?? "pt-BR",
        timezoneId: request.timezoneId ?? "America/Sao_Paulo",
        fixtureDigest: request.fixtureDigest ?? canonicalDigest(observations)
      },
      elements: observations,
      interactions: collected.interactions,
      relations: request.relations ?? {},
      accessibility: request.accessibility ?? []
    });
    const privacy = scanPrivateContent(evidence);
    if (privacy.length > 0) throw new Error(`Rendered evidence failed privacy scan: ${JSON.stringify(privacy)}`);
    const outputPath = path.join(outputDir, "rendered-ui-evidence.json");
    atomicWrite(outputPath, evidence);
    const outputPaths = [outputPath, ...(collected.screenshot ? [collected.screenshot] : [])];
    writeCommandReceipt({ args, capabilityId: "frontend-ui-render-control", inputPaths: [inputPath], outputPaths, subject: evidence.subject, adapterDigest: canonicalDigest(evidence.provenance.adapterId), browserDigest: evidence.provenance.browser ? canonicalDigest(evidence.provenance.browser) : null, fixtureDigest: evidence.provenance.fixtureDigest });
    process.stdout.write(`${JSON.stringify(evidence)}\n`);
    return;
  }

  if (command === "analyze") {
    const expectedPath = path.resolve(requireFlag(args, "expected"));
    const renderedPath = path.resolve(requireFlag(args, "rendered"));
    const sourcePath = args.source && args.source !== true ? path.resolve(args.source) : null;
    const outputDir = path.resolve(requireFlag(args, "output-dir"));
    const result = analyzeUiFacts(readJson(expectedPath), readJson(renderedPath), sourcePath ? readJson(sourcePath) : null);
    const outputPath = path.join(outputDir, "ui-findings.json");
    atomicWrite(outputPath, result);
    const blocking = result.findings.some((item) => ["P0", "P1"].includes(item.severity));
    writeCommandReceipt({ args, capabilityId: "frontend-ui-render-control", inputPaths: [expectedPath, renderedPath, ...(sourcePath ? [sourcePath] : [])], outputPaths: [outputPath], subject: result.subject, exitCode: blocking ? 1 : 0 });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (blocking) process.exitCode = 1;
    return;
  }

  if (command === "gate") {
    const outputDir = path.resolve(requireFlag(args, "output-dir"));
    const executionPath = path.resolve(requireFlag(args, "execution"));
    const fresh = await executeUiPipeline(readJson(executionPath), path.join(outputDir, "execution"), { feature: args.feature });
    const findingsPath = fresh.findingsPath;
    const receiptPaths = fresh.receiptPaths;
    const receipts = receiptPaths.map(readJson);
    const receiptErrors = receipts.flatMap((receipt, index) => verifyCapabilityReceipt(receipt, { baseDirectory: path.dirname(receiptPaths[index] ?? findingsPath) }).errors);
    if (receiptErrors.length > 0) throw new Error(`Capability receipt integrity failed: ${receiptErrors.join(", ")}`);
    const findings = readJson(findingsPath);
    const productDesignPath = args["product-design-readiness"] && args["product-design-readiness"] !== true
      ? path.resolve(args["product-design-readiness"])
      : null;
    if (productDesignPath && !fs.existsSync(productDesignPath)) throw new Error(`Product Design Readiness receipt does not exist: ${productDesignPath}`);
    const productDesignReadiness = productDesignPath ? readJson(productDesignPath) : null;
    const gateInput = args["require-product-design"] === true ? { ...findings, productDesignRequired: true } : findings;
    const gate = deriveUiQualityGate(gateInput, {}, receipts, productDesignReadiness);
    gate.sourceSnapshot = fresh.snapshot;
    gate.semanticDigest = canonicalDigest(gate);
    const gatePath = path.join(outputDir, "ui-quality-gate.json");
    atomicWrite(gatePath, gate);
    const outputs = [gatePath];
    if (gate.eligible && args.decision && args.principal) {
      const humanScopePath = args["human-scope"] && args["human-scope"] !== true ? path.resolve(args["human-scope"]) : null;
      const draft = createHumanDecisionDraft(gate, {
        principal: args.principal,
        decision: args.decision,
        authorityScope: humanScopePath ? readJson(humanScopePath) : null,
        risk: args.risk ? readJson(args.risk) : null
      });
      const decisionPath = path.join(outputDir, "human-decision-receipt.json");
      atomicWrite(decisionPath, draft);
      outputs.push(decisionPath);
    }
    if (gate.eligible) writeCommandReceipt({ args, capabilityId: "frontend-ui-evidence-integrity", inputPaths: [findingsPath, ...receiptPaths, ...(productDesignPath ? [productDesignPath] : [])], outputPaths: outputs, subject: gate.subject, policyDigest: gate.policyDigest });
    process.stdout.write(`${JSON.stringify(gate)}\n`);
    if (!gate.eligible) process.exitCode = 1;
    return;
  }

  if (command === "attest") {
    const gatePath = path.resolve(requireFlag(args, "gate"));
    const decisionPath = path.resolve(requireFlag(args, "decision"));
    const authority = trustedHumanAuthority(process.cwd());
    const currentGate = readJson(gatePath);
    if (currentGate.subject?.project !== authority.project || currentGate.sourceSnapshot !== sourceSnapshot(process.cwd()) || currentGate.subject?.commit !== gitOutput(process.cwd(), ["rev-parse", "HEAD"]).trim()) throw new Error("Attestation gate differs from current trusted project snapshot");
    const verified = verifyHumanDecision({ decisionPath, signaturePath: path.resolve(requireFlag(args, "signature")), ...authority, gate: currentGate });
    if (!verified.valid) { const error = new Error(verified.errors.join("; ")); error.exitCode = 3; throw error; }
    const result = createClientDeliveryAttestation(readJson(gatePath), verified.decision);
    const outputPath = path.resolve(requireFlag(args, "output"));
    atomicWrite(outputPath, result);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }

  if (["verify", "verify-receipt", "verify-authorization"].includes(command)) {
    const humanFlags = ["decision", "signature", "allowed-signers", "principal", "gate"];
    if (args.receipt && humanFlags.some(key => args[key] !== undefined)) throw new Error("Receipt and authorization verification flags are mutually exclusive.");
    if (command === "verify-authorization" && args.receipt) throw new Error("Authorization cannot select receipt verification.");
    if (command === "verify-receipt" && !args.receipt) throw new Error("verify-receipt requires --receipt.");
    if (args.receipt) {
      const receiptPath = path.resolve(args.receipt);
      const result = verifyCapabilityReceipt(readJson(receiptPath), { baseDirectory: args["base-directory"] ? path.resolve(args["base-directory"]) : path.dirname(receiptPath) });
      process.stdout.write(`${JSON.stringify(result)}\n`);
      if (!result.valid) process.exitCode = 3;
      return;
    }
    const authority = trustedHumanAuthority(process.cwd());
    if ((args.principal !== undefined && args.principal !== authority.principal) || (args["allowed-signers"] !== undefined && path.resolve(String(args["allowed-signers"])) !== authority.allowedSignersPath)) throw new Error("Caller authority differs from trusted executor configuration.");
    const currentGate = readJson(path.resolve(requireFlag(args, "gate")));
    if (currentGate.subject?.project !== authority.project) throw new Error("Authorization project differs from trusted executor identity");
    if (currentGate.sourceSnapshot !== sourceSnapshot(process.cwd()) || currentGate.subject?.commit !== gitOutput(process.cwd(), ["rev-parse", "HEAD"]).trim()) throw new Error("Authorization gate is stale for current checkout");
    const result = verifyHumanDecision({ decisionPath: path.resolve(requireFlag(args, "decision")), signaturePath: path.resolve(requireFlag(args, "signature")), ...authority, gate: readJson(path.resolve(requireFlag(args, "gate"))) });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (!result.valid) process.exitCode = 3;
    return;
  }

  throw new Error(`Unknown subcommand '${command}'.`);
}

function isMainModule(realPath) {
  if (!process.argv[1]) return false;
  try {
    return fs.realpathSync(path.resolve(process.argv[1])) === realPath;
  } catch {
    return false;
  }
}

if (isMainModule(path.resolve(SCRIPT_PATH))) {
  runCli().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = error.exitCode ?? 2;
  });
}
