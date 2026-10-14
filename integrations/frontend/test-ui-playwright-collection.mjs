#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const CONTROLLER = path.join(SCRIPT_DIRECTORY, "ui-engineering-control.mjs");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "ui-playwright-collection-"));
let assertions = 0;

function run(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CONTROLLER, ...args], { cwd: ROOT });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}

const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; background: rgb(248, 250, 252); font-family: Arial, sans-serif; }
      main { display: grid; gap: 16px; padding: 24px; }
      button { width: 120px; height: 44px; background: rgb(255, 255, 255); border: 1px solid rgb(203, 213, 225); }
      button:focus-visible { outline: 2px solid rgb(37, 99, 235); }
    </style>
  </head>
  <body>
    <main data-ui-evidence-id="main" data-ui-role="surface">
      <h1 data-ui-evidence-id="title" data-ui-role="page-title">Painel</h1>
      <button id="open" data-ui-evidence-id="open" data-ui-action="open" aria-label="Abrir painel">Abrir</button>
    </main>
  </body>
</html>`;

const server = http.createServer((_request, response) => {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(html);
});

try {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}/fixture`;
  const input = path.join(temp, "collection.json");
  const screenshot = path.join(temp, "private-evidence", "fixture.png");
  fs.writeFileSync(input, `${JSON.stringify({
    subject: { project: "playwright-fixture", commit: "a".repeat(40) },
    url,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    viewport: { width: 1280, height: 720 },
    fixtureDigest: "f".repeat(64),
    screenshotPath: screenshot
  }, null, 2)}\n`);

  const collect = async (name) => {
    const output = path.join(temp, name);
    const result = await run(["collect", "--input", input, "--output-dir", output]);
    assert.equal(result.status, 0, `Playwright collection failed:\n${result.stderr}\n${result.stdout}`);
    assertions += 1;
    return JSON.parse(fs.readFileSync(path.join(output, "rendered-ui-evidence.json"), "utf8"));
  };
  const first = await collect("first");
  const second = await collect("second");

  assert.equal(first.semanticDigest, second.semanticDigest, "Two controlled browser collections must have the same semantic digest.");
  assert.equal(first.provenance.browser.name, "chromium");
  assert.equal(first.provenance.locale, "pt-BR");
  assert.equal(first.provenance.timezoneId, "America/Sao_Paulo");
  assert.equal(first.elements.length, 3);
  assert.equal(first.interactions[0].accessibleName, "Abrir painel");
  assert.ok(first.interactions[0].focusVisible, "The runtime collector must observe focus-visible state.");
  assert.ok(fs.existsSync(screenshot), "Screenshot must stay in the private evidence path.");
  assertions += 8;
} finally {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(temp, { recursive: true, force: true });
}

console.log(`UI Playwright collection tests passed (${assertions} assertions).`);
