import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

export async function createUiExecutionFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sde-ui-execution-"));
  const write = (ref, value) => {
    const file = path.join(root, ref); fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`);
    return file;
  };
  write("src/App.tsx", 'export function App() { return <h1 className="text-section-title">Painel</h1>; }\n');
  write("index.html", '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>h1{font:700 24px Arial;color:#111;background:white}</style></head><body><h1 data-ui-evidence-id="page-title">Painel</h1></body></html>');
  const git = args => {
    const r = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    if (r.status !== 0) throw new Error(r.stderr); return r.stdout.trim();
  };
  git(["init", "-q", "-b", "main"]); git(["add", "."]);
  git(["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "fixture baseline"]);
  const subject = { project: "browser-fixture", commit: git(["rev-parse", "HEAD"]) };
  const server = spawn(process.execPath, ["--input-type=module", "-e", 'import http from "node:http"; import fs from "node:fs"; const server=http.createServer((req,res)=>{res.setHeader("content-type","text/html");res.end(fs.readFileSync("index.html"));});server.listen(0,"127.0.0.1",()=>console.log(server.address().port));'], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
  const port = await new Promise((resolve, reject) => { server.once("error", reject); server.stdout.once("data", b => resolve(Number(String(b).trim()))); server.once("exit", code => reject(new Error(`Fixture server exited ${code}`))); });
  const input = ".specs/inputs";
  write(`${input}/profile.json`, { subject, uiSurfaces: [{ id: "web", framework: "react", styling: "tailwind-v4", runtime: "web-dom" }] });
  write(`${input}/bundle.json`, { subject, tokens: { "text.section-title": { type: "typography", value: { fontSize: "1.5rem", fontWeight: 700 } } }, recipes: [{ id: "dashboard", owner: "design-system", requiredPrimitives: ["PageHeader"], tokenRefs: ["text.section-title"], expected: [{ id: "page-title", screenId: "dashboard", role: "page-title" }] }], components: [{ id: "PageHeader", owner: "design-system" }], statuses: {}, locale: { id: "pt-BR", catalog: ["Painel"] } });
  write(`${input}/source.json`, { subject, files: [path.join(root, "src/App.tsx")] });
  write(`${input}/collect.json`, { subject, url: `http://127.0.0.1:${port}`, viewport: { width: 1280, height: 720 } });
  const request = { profileInput: `${input}/profile.json`, bundle: `${input}/bundle.json`, sourceRequest: `${input}/source.json`, collectRequest: `${input}/collect.json` };
  const executionPath = write(`${input}/execution.json`, request);
  return { root, subject, executionPath, request, write, async close() { server.kill(); await new Promise(resolve => server.exitCode !== null ? resolve() : server.once("exit", resolve)); fs.rmSync(root, { recursive: true, force: true }); } };
}
