#!/usr/bin/env node

// RULE-BE-LANG-001 enforcement contract: the domain layer must be pt-BR ASCII
// snake_case, the technical/protocol layer must stay English, and the auditor
// must not flag the second layer. A checker that produced false positives on
// `page`/`limit`/`tenant` would train people to ignore it, so the negative
// cases matter as much as the positive ones.

import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const AUDITOR = path.join(SCRIPT_DIRECTORY, "audit-naming-language.mjs");

let assertions = 0;

function run(root, manifestRelativePath) {
  const result = spawnSync(
    process.execPath,
    [AUDITOR, path.join(root, manifestRelativePath), "--root", root, "--json"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  );

  let report = null;
  try {
    report = JSON.parse(result.stdout || "{}");
  } catch {
    report = null;
  }

  return { status: result.status, stderr: result.stderr, report };
}

function write(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    typeof content === "string" ? content : `${JSON.stringify(content, null, 2)}\n`
  );
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), "backend-naming-language-"));

// A fully compliant contract: pt-BR domain terms, English protocol vocabulary.
write(path.join(root, "openapi/pedidos.yaml"), `openapi: 3.1.0
paths:
  /api/v1/pedidos:
    get:
      parameters:
        - name: page
        - name: limit
        - name: cursor
  /api/v1/pedidos/{id}/itens:
    get: {}
components:
  schemas:
    Pedido:
      properties:
        cliente_id: {}
        valor_total: {}
        situacao: {}
        criado_em: {}
        tenant: {}
        status_code: {}
`);

write(path.join(root, "compliant.json"), {
  interfaces: [
    { id: "criar-pedido", contractPath: "openapi/pedidos.yaml" },
    { id: "listar-itens-do-pedido", contractPath: "openapi/pedidos.yaml" }
  ]
});

const compliant = run(root, "compliant.json");
assert.equal(compliant.status, 0, `Compliant contract must pass.\n${compliant.stderr}`);
assert.equal(compliant.report.summary.errors, 0);
assert.deepEqual(compliant.report.issues, []);
// Two interfaces share one contract file; it must be scanned once.
assert.deepEqual(compliant.report.scannedContracts, ["openapi/pedidos.yaml"]);
assertions += 4;

// English domain terms in each of the three reported positions.
write(path.join(root, "openapi/legacy.yaml"), `openapi: 3.1.0
paths:
  /api/v1/users:
    get: {}
  /api/v1/orders/{id}:
    get: {}
components:
  schemas:
    Order:
      properties:
        createdAt: {}
        updated_at: {}
        customer_id: {}
`);

write(path.join(root, "violating.json"), {
  interfaces: [{ id: "list-users", contractPath: "openapi/legacy.yaml" }]
});

const violating = run(root, "violating.json");
assert.equal(violating.status, 1, "English domain identifiers must fail the audit.");
assertions += 1;

const codes = new Set(violating.report.issues.map((issue) => issue.code));
assert.ok(codes.has("BACKEND_NAMING_LANGUAGE_ROUTE"), "route segments must be audited");
assert.ok(codes.has("BACKEND_NAMING_LANGUAGE_FIELD"), "contract properties must be audited");
assert.ok(codes.has("BACKEND_NAMING_LANGUAGE_INTERFACE_ID"), "interface ids must be audited");
assertions += 3;

const flagged = violating.report.issues.map((issue) => issue.message).join("\n");
for (const term of ["users", "orders", "created_at", "updated_at", "customer"]) {
  assert.ok(flagged.includes(term), `audit must report the English term '${term}'`);
  assertions += 1;
}

// Every finding must be locatable.
for (const issue of violating.report.issues) {
  assert.ok(issue.location && issue.location.length > 0, "each finding needs a location");
  assertions += 1;
}

// The technical layer must never be reported, in any position.
write(path.join(root, "openapi/technical.yaml"), `openapi: 3.1.0
paths:
  /api/v1/health:
    get: {}
  /metrics:
    get: {}
components:
  schemas:
    Pagina:
      properties:
        page: {}
        limit: {}
        offset: {}
        cursor: {}
        tenant: {}
        tenant_id: {}
        etag: {}
        status_code: {}
`);

write(path.join(root, "technical.json"), {
  interfaces: [{ id: "consultar-saude", contractPath: "openapi/technical.yaml" }]
});

const technical = run(root, "technical.json");
assert.equal(technical.status, 0, `Technical vocabulary must not be flagged.\n${JSON.stringify(technical.report?.issues, null, 2)}`);
assert.equal(technical.report.summary.errors, 0);
assertions += 2;

// A domain error code in English fails; the pt-BR spelling passes.
write(path.join(root, "openapi/erros.yaml"), `openapi: 3.1.0
components:
  schemas:
    Erro:
      properties:
        codigo:
          enum:
            - PEDIDO_NAO_ENCONTRADO
`);
write(path.join(root, "erros.json"), {
  interfaces: [{ id: "ORDER_NOT_FOUND", contractPath: "openapi/erros.yaml" }]
});
const errorCodes = run(root, "erros.json");
assert.equal(errorCodes.status, 1, "an English domain error code must fail");
assert.ok(
  errorCodes.report.issues.some((issue) => issue.code === "BACKEND_NAMING_LANGUAGE_INTERFACE_ID"),
  "the English error code must be reported"
);
assertions += 2;

// A manifest without interfaces is not this auditor's problem.
write(path.join(root, "empty.json"), { interfaces: [] });
const empty = run(root, "empty.json");
assert.equal(empty.status, 0, "an empty interface list must pass");
assertions += 1;

// An unresolved contractPath belongs to backend-change-manifest-contract.
write(path.join(root, "missing.json"), {
  interfaces: [{ id: "criar-pedido", contractPath: "openapi/does-not-exist.yaml" }]
});
const missing = run(root, "missing.json");
assert.equal(missing.status, 0, "a missing contract file must not be double-reported here");
assertions += 1;

fs.rmSync(root, { recursive: true, force: true });

console.log(`Backend naming language audit contract passed (${assertions} assertions).`);
