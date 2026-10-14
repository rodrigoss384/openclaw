#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDirectory, "../../..");
const intent = fs.readFileSync(path.join(root, "prompts/spec-driven/01-intent.prompt.md"), "utf8");
const specification = fs.readFileSync(path.join(root, "prompts/spec-driven/02-spec-assumptions.prompt.md"), "utf8");
const behavior = fs.readFileSync(path.join(root, "prompts/spec-driven/04-behavior-tests.prompt.md"), "utf8");
const design = fs.readFileSync(path.join(root, "prompts/spec-driven/05-design-readiness.prompt.md"), "utf8");
const execution = fs.readFileSync(path.join(root, "prompts/spec-driven/07-execute.prompt.md"), "utf8");
const evidence = fs.readFileSync(path.join(root, "prompts/spec-driven/09-validate-evidence.prompt.md"), "utf8");

assert.match(
  behavior,
  /02-assumptions\.md` somente para registrar[\s\S]*mesmo `Q-\.\.\.`/,
  "behavior-tests must allow a bounded synchronized update of the assumptions authority"
);
assert.match(
  behavior,
  /nunca declare a pergunta resolvida somente em 04–06/,
  "behavior-tests must prohibit resolving a question only in downstream artifacts"
);
assert.match(
  behavior,
  /nenhuma `Q-\.\.\.` usada por 04–06 ainda marcada como aberta em `02-assumptions\.md`/,
  "the acceptance gate must reject stale assumption authority"
);
assert.match(
  design,
  /04–06 tratam uma `Q-\.\.\.` como resolvida mas `02-assumptions\.md` ainda a mantém aberta/,
  "design-readiness must block cross-artifact assumption drift"
);
assert.match(intent, /request-constraint-ledger:[\s\S]*Tower[\s\S]*tracing/, "intent must preserve each named technical constraint instead of collapsing the stack");
assert.match(specification, /request-constraint-traceability:[\s\S]*restrição explícita -> REQ\/D\/Q -> destino esperado/, "specification must trace every explicit request constraint");
assert.match(design, /technology-constraint-preservation:[\s\S]*dependência transitiva/, "design readiness must disposition every named technology constraint directly");
assert.match(execution, /request-constraint-execution:[\s\S]*dependência transitiva/, "execution must not treat a transitive dependency as direct fulfillment");
assert.match(evidence, /request-constraint-evidence:[\s\S]*satisfeito apenas transitivamente/, "evidence review must reject missing or merely transitive fulfillment");

console.log("Assumption and request-constraint enforcement tests passed (9 assertions).");
