import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

export const digest = value => crypto.createHash("sha256").update(value).digest("hex");
export function gitOutput(root, args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  if (result.error || result.status !== 0) throw new Error(`Git comparison unavailable: ${result.stderr || result.error?.message || args.join(" ")}`);
  return result.stdout;
}
export function projectFile(root, ref) {
  if (typeof ref !== "string" || !ref || path.isAbsolute(ref)) throw new Error("Expected repository-relative path");
  const resolved = path.resolve(root, ref);
  if (!resolved.startsWith(`${path.resolve(root)}${path.sep}`)) throw new Error(`Path escapes project: ${ref}`);
  if (fs.existsSync(resolved) && !fs.realpathSync(resolved).startsWith(`${fs.realpathSync(root)}${path.sep}`)) throw new Error(`Symlink escapes project: ${ref}`);
  return resolved;
}
export function materializeInvocation(capability, values) {
  const invocation = capability.invocation;
  if (!Array.isArray(invocation.argv) || invocation.argv.length < 2) throw new Error("Capability requires tokenized argv");
  const used = new Set();
  const unresolved = new Set();
  const expand = token => {
    const choice = invocation.choices?.[token];
    if (choice) {
      const key = token.slice(1, -1); used.add(key);
      const selected = values[key];
      if (selected === undefined) { unresolved.add(key); return [token]; }
      if (!Object.hasOwn(choice, selected)) throw new Error(`Invalid enumerated argument ${key}: ${selected}`);
      return choice[selected].flatMap(expand);
    }
    return [token.replace(/<([a-z0-9._-]+)>/gi, (_, key) => {
      used.add(key);
      if (values[key] === undefined) { unresolved.add(key); return `<${key}>`; }
      const value = values[key];
      if (typeof value !== "string" || !value.trim() || /[\0\r\n]/.test(value) || /(^|\s)--?[a-z]/i.test(value)) throw new Error(`Unsafe argument value for ${key}`);
      return value;
    })];
  };
  const argv = invocation.argv.flatMap(expand);
  for (const key of Object.keys(values)) if (!used.has(key) && !["project-root", "feature-directory", "feature-slug", "baseline-git-ref"].includes(key)) throw new Error(`Unknown argument placeholder: ${key}`);
  if (unresolved.size) { const error = new Error(`Unresolved inputs: ${[...unresolved].join(", ")}`); error.placeholders = [...unresolved]; throw error; }
  return argv;
}
export function loadExecutionContext(root, feature, { required = true } = {}) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(feature)) throw new Error("Invalid feature slug");
  const ref = `.specs/features/${feature}/execution-context.json`;
  const file = projectFile(root, ref);
  if (!fs.existsSync(file)) {
    if (!required) return null;
    throw new Error(`Frozen execution context missing: ${ref}; freeze the feature baseline before enforcement`);
  }
  const bytes = fs.readFileSync(file);
  const context = JSON.parse(bytes);
  if (context.feature !== feature || !/^[a-f0-9]{40}$/.test(context.baseCommit ?? "")) throw new Error("Execution context requires feature and immutable baseCommit SHA");
  if (process.env.SDE_BASE_COMMIT && process.env.SDE_BASE_COMMIT !== context.baseCommit) throw new Error("Execution context base differs from trusted executor baseline");
  if (process.env.SDE_CONTEXT_SHA256 && process.env.SDE_CONTEXT_SHA256 !== digest(bytes)) throw new Error("Execution context changed since trusted baseline freeze");
  const applicability = projectFile(root, `.specs/features/${feature}/applicability.md`);
  if (context.applicabilitySha256 !== digest(fs.readFileSync(applicability))) throw new Error("Applicability differs from frozen execution context");
  const actual = gitOutput(root, ["rev-parse", "--verify", `${context.baseCommit}^{commit}`]).trim();
  if (actual !== context.baseCommit) throw new Error("Baseline must resolve to its immutable commit");
  gitOutput(root, ["merge-base", "--is-ancestor", actual, "HEAD"]);
  for (const key of ["frontendPaths", "backendPaths", "testPaths"]) {
    if (!Array.isArray(context[key])) throw new Error(`Execution context requires ${key}`);
    for (const ref of context[key]) projectFile(root, ref);
  }
  return { ...context, ref, sha256: digest(bytes) };
}
export function sourceSnapshot(root) {
  const files = gitOutput(root, ["ls-files", "-z", "--cached", "--others", "--exclude-standard"]).split("\0").filter(Boolean);
  const hashes = [...new Set(files)].sort().filter(ref => !ref.startsWith(".specs/")).flatMap(ref => {
    const file = projectFile(root, ref);
    if (!fs.existsSync(file)) return [[ref, "deleted"]];
    if (!fs.statSync(file).isFile()) return [];
    return [[ref, digest(fs.readFileSync(file))]];
  });
  return digest(JSON.stringify(hashes));
}
export function validateStageReport(report, snapshot) {
  if (!report || report.artifactKind !== "stage-enforcement-report" || report.dryRun !== false || report.snapshot !== snapshot) throw new Error("Missing, stale or diagnostic enforcement report");
  if (!Array.isArray(report.requiredEnforcements) || !report.requiredEnforcements.length || !Array.isArray(report.executions)) throw new Error("Empty enforcement report cannot authorize transition");
  if (report.summary?.blockingFailures !== 0) throw new Error("Enforcement failed");
  for (const id of report.requiredEnforcements) {
    const entries = report.executions.filter(row => row.capabilityId === id);
    const entry = entries[0];
    const schemaCovered = id === "backend-change-manifest-contract" && entry?.status === "not-executable" && entry.coveredBy === "backend-technology-selection-validation" && report.executions.some(row => row.capabilityId === entry.coveredBy && row.status === "passed" && row.exitCode === 0);
    if (entries.length !== 1 || (!schemaCovered && (entry.status !== "passed" || entry.exitCode !== 0))) throw new Error(`Enforcement did not run and pass: ${id}`);
  }
  return true;
}
