#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDirectory, "../../..");
const design = fs.readFileSync(path.join(root, "prompts/spec-driven/05-design-readiness.prompt.md"), "utf8");

assert.match(
  design,
  /contrato machine-readable design-first novo[\s\S]*interface greenfield/,
  "design-readiness must authorize a bounded greenfield interface contract"
);
assert.match(
  design,
  /greenfield-interface-bootstrap:[\s\S]*não bloqueie por sua ausência[\s\S]*não autoriza runtime, handler, teste ou outro código de produção/,
  "greenfield backend readiness must avoid the no-contract/no-build deadlock without authorizing implementation"
);
assert.match(
  design,
  /greenfield-styling-bootstrap:[\s\S]*explicitamente congelado[\s\S]*não exija arquivos de implementação ainda inexistentes/,
  "greenfield styling authority must derive from an explicit decision rather than nonexistent implementation files"
);
assert.match(
  design,
  /Sem decisão explícita, continue bloqueando/,
  "greenfield styling bootstrap must not infer a stack from preference"
);

console.log("Greenfield design-readiness enforcement tests passed (4 assertions).");
