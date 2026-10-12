import fs from "node:fs";
import path from "node:path";
import { validateJsonSchema, validateSchemaSupport } from "../../skills/spec-driven-engineering/scripts/lib/json-schema.mjs";

export const PRESENTATION_SIGNATURE_DIMENSIONS = [
  "variantRole",
  "semanticColorRole",
  "shapeRole",
  "textRole"
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function stable(value) {
  return value == null ? null : String(value);
}

function signatureKey(signature) {
  return JSON.stringify(signature || null);
}

export function signatureForRole(role) {
  const signature = role?.presentationSignature;
  if (!signature || typeof signature !== "object" || Array.isArray(signature)) return null;
  const result = {};
  for (const dimension of PRESENTATION_SIGNATURE_DIMENSIONS) result[dimension] = signature[dimension];
  return result;
}

export function distinctDimensions(left, right, dimensions = PRESENTATION_SIGNATURE_DIMENSIONS) {
  return dimensions.filter((dimension) => left?.[dimension] !== right?.[dimension]);
}

export function validateSemanticDifferentiation(designSystem) {
  const errors = [];
  const policy = designSystem?.visualGrammar?.perceptualPolicy;
  const registry = policy?.presentationRoles;
  const contract = policy?.semanticDifferentiation;
  const hasPhase = Boolean(registry?.phase);
  const hasStatus = Boolean(registry?.status);

  if (!contract) {
    if (hasPhase && hasStatus) {
      errors.push("semanticDifferentiation is required when both 'phase' and 'status' presentation roles are declared");
    }
    return errors;
  }

  if (!Array.isArray(contract.roles) || contract.roles.length < 2 || new Set(contract.roles).size !== contract.roles.length) {
    errors.push("semanticDifferentiation.roles must contain at least two unique semantic roles");
    return errors;
  }
  if (!Array.isArray(contract.dimensions) || contract.dimensions.length < 1 || new Set(contract.dimensions).size !== contract.dimensions.length) {
    errors.push("semanticDifferentiation.dimensions must contain unique presentation signature dimensions");
    return errors;
  }
  for (const dimension of contract.dimensions) {
    if (!PRESENTATION_SIGNATURE_DIMENSIONS.includes(dimension)) {
      errors.push(`semanticDifferentiation dimension '${dimension}' is unsupported`);
    }
  }
  if (!Number.isInteger(contract.minimumDistinctDimensions) || contract.minimumDistinctDimensions < 1) {
    errors.push("semanticDifferentiation.minimumDistinctDimensions must be an integer >= 1");
  } else if (contract.minimumDistinctDimensions > contract.dimensions.length) {
    errors.push("semanticDifferentiation.minimumDistinctDimensions cannot exceed dimensions.length");
  }
  if (contract.colorOnlyAllowed !== false) {
    errors.push("semanticDifferentiation.colorOnlyAllowed must remain false");
  }
  if (contract.dimensions.length === 1 && contract.dimensions[0] === "semanticColorRole") {
    errors.push("semanticDifferentiation cannot rely only on semanticColorRole when colorOnlyAllowed=false");
  }

  const signatures = new Map();
  for (const roleId of contract.roles) {
    const role = registry?.[roleId];
    if (!role) {
      errors.push(`semanticDifferentiation role '${roleId}' is not declared in presentationRoles`);
      continue;
    }
    const signature = signatureForRole(role);
    if (!signature) {
      errors.push(`presentation role '${roleId}' requires presentationSignature because it participates in semanticDifferentiation`);
      continue;
    }
    for (const dimension of PRESENTATION_SIGNATURE_DIMENSIONS) {
      if (!nonEmpty(signature[dimension])) errors.push(`presentation role '${roleId}' has invalid presentationSignature.${dimension}`);
    }
    signatures.set(roleId, signature);
  }

  for (let leftIndex = 0; leftIndex < contract.roles.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < contract.roles.length; rightIndex += 1) {
      const leftRole = contract.roles[leftIndex];
      const rightRole = contract.roles[rightIndex];
      const left = signatures.get(leftRole);
      const right = signatures.get(rightRole);
      if (!left || !right) continue;
      const distinct = distinctDimensions(left, right, contract.dimensions);
      if (distinct.length < contract.minimumDistinctDimensions) {
        errors.push(`semantic roles '${leftRole}' and '${rightRole}' differ in ${distinct.length} configured dimensions; minimum is ${contract.minimumDistinctDimensions}`);
      }
      if (contract.colorOnlyAllowed === false && distinct.length === 1 && distinct[0] === "semanticColorRole") {
        errors.push(`semantic roles '${leftRole}' and '${rightRole}' differ only by semanticColorRole; color-only differentiation is forbidden`);
      }
    }
  }

  return errors;
}

export function enrichCraftSemanticSignatures({ root, craft }) {
  const designSource = (craft?.sources || []).find((source) => source.role === "design-system");
  if (!designSource) return { craft, errors: [] };
  const designPath = path.isAbsolute(designSource.path) ? designSource.path : path.resolve(root, designSource.path);
  if (!fs.existsSync(designPath)) return { craft, errors: [`design-system source cannot be resolved: ${designSource.path}`] };
  const designSystem = readJson(designPath);
  const errors = validateSemanticDifferentiation(designSystem);
  if (errors.length) return { craft, errors };

  const registry = designSystem?.visualGrammar?.perceptualPolicy?.presentationRoles || {};
  const assignments = craft?.dimensions?.semanticPresentation?.assignments || [];
  for (const assignment of assignments) {
    const signature = signatureForRole(registry[assignment.semanticRole]);
    if (signature) assignment.presentationSignature = signature;
  }
  craft.$schema = "craft-contract.schema.json";
  craft.schemaVersion = "1.3.0";
  return { craft, errors: [] };
}

export function validateExtendedCraft({ root, craft, schemaPath }) {
  const errors = [];
  const schema = readJson(schemaPath);
  const supportErrors = validateSchemaSupport(schema);
  if (supportErrors.length) errors.push(...supportErrors.map((error) => `craft schema unsupported: ${error}`));
  else errors.push(...validateJsonSchema(craft, schema));

  const designSource = (craft?.sources || []).find((source) => source.role === "design-system");
  if (!designSource) return errors;
  const designPath = path.isAbsolute(designSource.path) ? designSource.path : path.resolve(root, designSource.path);
  if (!fs.existsSync(designPath)) {
    errors.push(`design-system source cannot be resolved: ${designSource.path}`);
    return errors;
  }
  const designSystem = readJson(designPath);
  errors.push(...validateSemanticDifferentiation(designSystem));
  const registry = designSystem?.visualGrammar?.perceptualPolicy?.presentationRoles || {};
  const differentiated = new Set(designSystem?.visualGrammar?.perceptualPolicy?.semanticDifferentiation?.roles || []);

  for (const assignment of craft?.dimensions?.semanticPresentation?.assignments || []) {
    const expected = signatureForRole(registry[assignment.semanticRole]);
    if (differentiated.has(assignment.semanticRole) && !expected) {
      errors.push(`semantic role '${assignment.semanticRole}' participates in differentiation but has no canonical presentationSignature`);
      continue;
    }
    if (expected && !assignment.presentationSignature) {
      errors.push(`semantic role '${assignment.semanticRole}' is missing derived presentationSignature in craft contract`);
      continue;
    }
    if (expected && !sameJson(expected, assignment.presentationSignature)) {
      errors.push(`semantic role '${assignment.semanticRole}' presentationSignature drifted from the canonical Design System`);
    }
  }
  return errors;
}

export function validateOperationalSemanticEvidence(designSystem, craft, evidence) {
  const errors = [];
  const registry = designSystem?.visualGrammar?.perceptualPolicy?.presentationRoles || {};
  const differentiation = designSystem?.visualGrammar?.perceptualPolicy?.semanticDifferentiation || null;
  const elementsByUsage = new Map();
  for (const element of asArray(evidence?.elements)) {
    if (!element?.componentUsageId || element.rendered === false) continue;
    if (!elementsByUsage.has(element.componentUsageId)) elementsByUsage.set(element.componentUsageId, []);
    elementsByUsage.get(element.componentUsageId).push(element);
  }

  const observedByRole = new Map();
  for (const assignment of asArray(craft?.dimensions?.semanticPresentation?.assignments)) {
    const signature = assignment?.presentationSignature;
    if (!signature) continue;
    const rendered = elementsByUsage.get(assignment.targetId) || [];
    for (const element of rendered) {
      if (stable(element.textRole) !== stable(signature.textRole)) {
        errors.push({
          code: "CRAFT_EVIDENCE_SEMANTIC_SIGNATURE_DRIFT",
          message: `Component usage '${assignment.targetId}' renders textRole '${element.textRole}' but semantic role '${assignment.semanticRole}' requires '${signature.textRole}'.`
        });
      }
      if (stable(element.semanticColorRole) !== stable(signature.semanticColorRole)) {
        errors.push({
          code: "CRAFT_EVIDENCE_SEMANTIC_SIGNATURE_DRIFT",
          message: `Component usage '${assignment.targetId}' renders semanticColorRole '${element.semanticColorRole}' but semantic role '${assignment.semanticRole}' requires '${signature.semanticColorRole}'.`
        });
      }
      const observed = {
        textRole: stable(element.textRole),
        semanticColorRole: stable(element.semanticColorRole)
      };
      if (!observedByRole.has(assignment.semanticRole)) observedByRole.set(assignment.semanticRole, []);
      observedByRole.get(assignment.semanticRole).push(observed);
    }
  }

  for (const [role, observations] of observedByRole) {
    const first = observations[0];
    if (observations.some((item) => item.textRole !== first.textRole || item.semanticColorRole !== first.semanticColorRole)) {
      errors.push({
        code: "CRAFT_EVIDENCE_SAME_ROLE_SIGNATURE_DRIFT",
        message: `Semantic role '${role}' renders inconsistent text/color signature across equivalent usages.`
      });
    }
  }

  if (differentiation && differentiation.colorOnlyAllowed === false) {
    const observable = asArray(differentiation.dimensions).filter((item) => ["textRole", "semanticColorRole"].includes(item));
    for (let leftIndex = 0; leftIndex < differentiation.roles.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < differentiation.roles.length; rightIndex += 1) {
        const leftRole = differentiation.roles[leftIndex];
        const rightRole = differentiation.roles[rightIndex];
        const left = observedByRole.get(leftRole)?.[0];
        const right = observedByRole.get(rightRole)?.[0];
        if (!left || !right || !observable.length) continue;
        const distinct = observable.filter((dimension) => left[dimension] !== right[dimension]);
        const expectedLeft = registry?.[leftRole]?.presentationSignature;
        const expectedRight = registry?.[rightRole]?.presentationSignature;
        const expectedNonColor = observable
          .filter((dimension) => dimension !== "semanticColorRole")
          .some((dimension) => expectedLeft?.[dimension] !== expectedRight?.[dimension]);
        if (expectedNonColor && !distinct.some((dimension) => dimension !== "semanticColorRole")) {
          errors.push({
            code: "CRAFT_EVIDENCE_CROSS_ROLE_COLLAPSE",
            message: `Semantic roles '${leftRole}' and '${rightRole}' collapse to the same observable non-color presentation despite the Design System differentiation contract.`
          });
        }
        if (distinct.length === 1 && distinct[0] === "semanticColorRole" && expectedNonColor) {
          errors.push({
            code: "CRAFT_EVIDENCE_COLOR_ONLY_DIFFERENTIATION",
            message: `Semantic roles '${leftRole}' and '${rightRole}' are differentiated only by color in rendered evidence.`
          });
        }
      }
    }
  }

  return errors;
}

export function validateFamilySemanticSignatures(designSystem, crafts) {
  const errors = [];
  const differentiation = designSystem?.visualGrammar?.perceptualPolicy?.semanticDifferentiation;
  const designErrors = validateSemanticDifferentiation(designSystem);
  if (designErrors.length) {
    return designErrors.map((message) => ({
      code: "SEMANTIC_DIFFERENTIATION_CONTRACT_INVALID",
      message,
      subjects: []
    }));
  }
  if (!differentiation) return errors;

  const roleSignatures = new Map();
  for (const craft of crafts) {
    for (const assignment of asArray(craft?.dimensions?.semanticPresentation?.assignments)) {
      if (!assignment.presentationSignature) continue;
      if (!roleSignatures.has(assignment.semanticRole)) roleSignatures.set(assignment.semanticRole, new Map());
      const variants = roleSignatures.get(assignment.semanticRole);
      const key = signatureKey(assignment.presentationSignature);
      if (!variants.has(key)) variants.set(key, new Set());
      variants.get(key).add(craft.screenId || "unknown-screen");
    }
  }

  for (const [role, variants] of roleSignatures) {
    if (variants.size <= 1) continue;
    errors.push({
      code: "SAME_ROLE_PRESENTATION_SIGNATURE_DRIFT",
      message: `Semantic role '${role}' maps to multiple presentation signatures across screens in one visual family.`,
      subjects: [...new Set([...variants.values()].flatMap((set) => [...set]))]
    });
  }

  for (let leftIndex = 0; leftIndex < differentiation.roles.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < differentiation.roles.length; rightIndex += 1) {
      const leftRole = differentiation.roles[leftIndex];
      const rightRole = differentiation.roles[rightIndex];
      const leftMap = roleSignatures.get(leftRole);
      const rightMap = roleSignatures.get(rightRole);
      if (!leftMap?.size || !rightMap?.size) continue;
      const left = JSON.parse([...leftMap.keys()][0]);
      const right = JSON.parse([...rightMap.keys()][0]);
      const distinct = distinctDimensions(left, right, differentiation.dimensions);
      const subjects = [...new Set([
        ...[...leftMap.values()].flatMap((set) => [...set]),
        ...[...rightMap.values()].flatMap((set) => [...set])
      ])];
      if (distinct.length < differentiation.minimumDistinctDimensions) {
        errors.push({
          code: "CROSS_ROLE_PRESENTATION_COLLAPSE",
          message: `Semantic roles '${leftRole}' and '${rightRole}' do not preserve the minimum cross-role signature differentiation across screens.`,
          subjects
        });
      } else if (differentiation.colorOnlyAllowed === false && distinct.length === 1 && distinct[0] === "semanticColorRole") {
        errors.push({
          code: "CROSS_ROLE_COLOR_ONLY_DIFFERENTIATION",
          message: `Semantic roles '${leftRole}' and '${rightRole}' collapse to color-only differentiation across screens.`,
          subjects
        });
      }
    }
  }
  return errors;
}

export function sanitizeCraftForPhase9Core(craft) {
  const sanitized = structuredClone(craft);
  sanitized.$schema = "craft-contract-core.schema.json";
  sanitized.schemaVersion = "1.2.0";
  for (const assignment of sanitized?.dimensions?.semanticPresentation?.assignments || []) {
    delete assignment.presentationSignature;
  }
  return sanitized;
}
