import { isDeepStrictEqual } from "node:util";

function pointer(root, reference) {
  if (!reference.startsWith("#/")) throw new Error(`Only local JSON Schema references are supported: ${reference}`);
  return reference
    .slice(2)
    .split("/")
    .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"))
    .reduce((value, part) => value?.[part], root);
}

function valueType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (Number.isInteger(value)) return "integer";
  return typeof value === "number" ? "number" : typeof value;
}

function pathLabel(parts) {
  return parts.length ? `/${parts.join("/")}` : "/";
}

function validateNode(value, schema, root, pathParts) {
  const errors = [];
  const evaluated = new Set();
  if (schema === true || schema === undefined) return { errors, evaluated };
  if (schema === false) return { errors: [`${pathLabel(pathParts)} is forbidden by schema`], evaluated };
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return { errors: [`${pathLabel(pathParts)} has an invalid schema definition`], evaluated };
  }

  if (schema.$ref) {
    const target = pointer(root, schema.$ref);
    if (!target) return { errors: [`${pathLabel(pathParts)} references missing schema ${schema.$ref}`], evaluated };
    const result = validateNode(value, target, root, pathParts);
    errors.push(...result.errors);
    for (const key of result.evaluated) evaluated.add(key);
  }

  if (schema.allOf) {
    for (const branch of schema.allOf) {
      const result = validateNode(value, branch, root, pathParts);
      errors.push(...result.errors);
      for (const key of result.evaluated) evaluated.add(key);
    }
  }

  if (schema.oneOf) {
    const results = schema.oneOf.map((branch) => validateNode(value, branch, root, pathParts));
    const passing = results.filter((result) => result.errors.length === 0);
    if (passing.length !== 1) errors.push(`${pathLabel(pathParts)} must match exactly one oneOf branch (matched ${passing.length})`);
    if (passing.length === 1) for (const key of passing[0].evaluated) evaluated.add(key);
  }

  if (schema.const !== undefined && !isDeepStrictEqual(value, schema.const)) {
    errors.push(`${pathLabel(pathParts)} must equal ${JSON.stringify(schema.const)}`);
  }
  if (schema.enum && !schema.enum.some((candidate) => isDeepStrictEqual(value, candidate))) {
    errors.push(`${pathLabel(pathParts)} must be one of ${schema.enum.map((item) => JSON.stringify(item)).join(", ")}`);
  }

  if (schema.type) {
    const allowed = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actual = valueType(value);
    const matches = allowed.some((expected) => expected === actual || (expected === "number" && actual === "integer"));
    if (!matches) {
      errors.push(`${pathLabel(pathParts)} must be ${allowed.join("|")}; received ${actual}`);
      return { errors, evaluated };
    }
  }

  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${pathLabel(pathParts)} must contain at least ${schema.minLength} characters`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push(`${pathLabel(pathParts)} must contain at most ${schema.maxLength} characters`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${pathLabel(pathParts)} must match ${schema.pattern}`);
    if (schema.format === "date-time" && Number.isNaN(Date.parse(value))) errors.push(`${pathLabel(pathParts)} must be an ISO-8601 date-time`);
  }

  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${pathLabel(pathParts)} must be >= ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${pathLabel(pathParts)} must be <= ${schema.maximum}`);
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${pathLabel(pathParts)} must contain at least ${schema.minItems} items`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${pathLabel(pathParts)} must contain at most ${schema.maxItems} items`);
    if (schema.uniqueItems) {
      for (let left = 0; left < value.length; left += 1) {
        for (let right = left + 1; right < value.length; right += 1) {
          if (isDeepStrictEqual(value[left], value[right])) errors.push(`${pathLabel(pathParts)} must contain unique items`);
        }
      }
    }
    const prefixCount = schema.prefixItems?.length || 0;
    for (let index = 0; index < prefixCount && index < value.length; index += 1) {
      errors.push(...validateNode(value[index], schema.prefixItems[index], root, [...pathParts, index]).errors);
    }
    if (schema.items && typeof schema.items === "object") {
      for (let index = prefixCount; index < value.length; index += 1) {
        errors.push(...validateNode(value[index], schema.items, root, [...pathParts, index]).errors);
      }
    } else if (schema.items === false && value.length > prefixCount) {
      errors.push(`${pathLabel(pathParts)} contains items not allowed by schema`);
    }
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const key of schema.required || []) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) errors.push(`${pathLabel([...pathParts, key])} is required`);
    }
    for (const [key, childSchema] of Object.entries(schema.properties || {})) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
      evaluated.add(key);
      errors.push(...validateNode(value[key], childSchema, root, [...pathParts, key]).errors);
    }
    const patternEntries = Object.entries(schema.patternProperties || {});
    for (const key of Object.keys(value)) {
      for (const [pattern, childSchema] of patternEntries) {
        if (!new RegExp(pattern).test(key)) continue;
        evaluated.add(key);
        errors.push(...validateNode(value[key], childSchema, root, [...pathParts, key]).errors);
      }
    }
    const rejectUnevaluated = schema.additionalProperties === false || schema.unevaluatedProperties === false;
    if (rejectUnevaluated) {
      for (const key of Object.keys(value)) {
        if (!evaluated.has(key)) errors.push(`${pathLabel([...pathParts, key])} is not allowed`);
      }
    } else if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
      for (const key of Object.keys(value)) {
        if (!evaluated.has(key)) errors.push(...validateNode(value[key], schema.additionalProperties, root, [...pathParts, key]).errors);
      }
    }
  }

  return { errors, evaluated };
}

export function validateJsonSchema(value, schema) {
  return validateNode(value, schema, schema, []).errors;
}

const supportedKeywords = new Set([
  "$schema",
  "$id",
  "$ref",
  "$defs",
  "title",
  "description",
  "type",
  "const",
  "enum",
  "oneOf",
  "allOf",
  "properties",
  "patternProperties",
  "required",
  "additionalProperties",
  "unevaluatedProperties",
  "items",
  "prefixItems",
  "minItems",
  "maxItems",
  "uniqueItems",
  "minLength",
  "maxLength",
  "pattern",
  "format",
  "minimum",
  "maximum"
]);

export function validateSchemaSupport(schema) {
  const errors = [];
  function walk(node, parts) {
    if (node === true || node === false) return;
    if (!node || typeof node !== "object" || Array.isArray(node)) {
      errors.push(`${pathLabel(parts)} must contain a schema object or boolean`);
      return;
    }
    for (const key of Object.keys(node)) {
      if (!supportedKeywords.has(key)) errors.push(`${pathLabel([...parts, key])} uses unsupported JSON Schema keyword`);
    }
    for (const group of ["properties", "patternProperties", "$defs"]) {
      for (const [key, child] of Object.entries(node[group] || {})) walk(child, [...parts, group, key]);
    }
    for (const group of ["oneOf", "allOf", "prefixItems"]) {
      for (const [index, child] of (node[group] || []).entries()) walk(child, [...parts, group, index]);
    }
    if (node.items && typeof node.items === "object") walk(node.items, [...parts, "items"]);
    if (node.additionalProperties && typeof node.additionalProperties === "object") {
      walk(node.additionalProperties, [...parts, "additionalProperties"]);
    }
    if (node.unevaluatedProperties && typeof node.unevaluatedProperties === "object") {
      walk(node.unevaluatedProperties, [...parts, "unevaluatedProperties"]);
    }
  }
  walk(schema, []);
  return errors;
}

