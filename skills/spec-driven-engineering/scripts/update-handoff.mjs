#!/usr/bin/env node
// Atomic .specs/HANDOFF.md writer — closes the TOCTOU window described in
// references/session-closure.md: two sessions reading the same baseRevision
// concurrently and both passing a non-atomic "re-read, compare, write" check.
// This script makes the re-read/compare/write one exclusive-locked critical
// section instead of three independent steps a second process can interleave with.
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "./lib/workflow-utils.mjs";
import { createHash } from "node:crypto";
import { prepareHandoffGuidance } from "./lib/human-guidance.mjs";

const USAGE = [
  "node update-handoff.mjs --root <project-root> --session-id <id> --agent <name>",
  "  --base-revision <integer|none> --handoff-file <path> --sidecar-file <path>",
  "  [--lock-timeout-ms <ms>] [--lock-retries <n>] [--lock-retry-delay-ms <ms>]"
].join(" ");

function readField(content, field) {
  const match = content.match(new RegExp(`\\*\\*${field}:\\*\\*\\s*\`?([^\`\\n]+)\`?`));
  return match ? match[1].trim() : null;
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function acquireLock(lockPath, timeoutMs, retries, retryDelayMs) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const fd = fs.openSync(lockPath, "wx");
      fs.writeSync(fd, String(process.pid));
      fs.closeSync(fd);
      return;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      const stat = fs.statSync(lockPath, { throwIfNoEntry: false });
      if (stat && Date.now() - stat.mtimeMs > timeoutMs) {
        console.error(`Stale lock (older than ${timeoutMs}ms) found at ${lockPath} — treating as abandoned and reclaiming.`);
        fs.rmSync(lockPath, { force: true });
        continue;
      }
      if (attempt === retries) {
        throw new Error(`Could not acquire ${lockPath} after ${retries} retries — another session is writing HANDOFF.md right now. Retry shortly; do not bypass the lock.`);
      }
      sleepSync(retryDelayMs);
    }
  }
}

function releaseLock(lockPath) {
  fs.rmSync(lockPath, { force: true });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = path.resolve(String(args.root || process.cwd()));
  const sessionId = args["session-id"];
  const agent = args.agent;
  const baseRevision = args["base-revision"];
  const handoffContentPath = args["handoff-file"];
  const sidecarContentPath = args["sidecar-file"];
  const lockTimeoutMs = Number(args["lock-timeout-ms"] || 30000);
  const lockRetries = Number(args["lock-retries"] || 50);
  const lockRetryDelayMs = Number(args["lock-retry-delay-ms"] || 100);

  if (!sessionId || !agent || !baseRevision || !handoffContentPath || !sidecarContentPath) {
    console.error(`Missing required argument.\nUsage: ${USAGE}`);
    process.exitCode = 1;
    return;
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(sessionId)) throw new Error("Invalid session ID");

  const handoffPath = path.join(root, ".specs/HANDOFF.md");
  const lockPath = path.join(root, ".specs/.handoff.lock");
  fs.mkdirSync(path.dirname(handoffPath), { recursive: true });

  acquireLock(lockPath, lockTimeoutMs, lockRetries, lockRetryDelayMs);
  try {
    // Validate the actual submitted body inside the lock, including on conflict.
    // The human-facing section is rendered from the validated request, never copied unchecked.
    const prepared = prepareHandoffGuidance({ root, sessionId, content: fs.readFileSync(path.resolve(handoffContentPath), "utf8") });
    const diskContent = fs.existsSync(handoffPath) ? fs.readFileSync(handoffPath, "utf8") : "";
    const diskRevision = diskContent ? (readField(diskContent, "revision") ?? "none") : "none";

    if (diskRevision === baseRevision) {
      const nextRevision = baseRevision === "none" ? "1" : String(Number(baseRevision) + 1);
      const timestamp = new Date().toISOString();
      let content = prepared.content;
      content = content
        .replaceAll("{{REVISION}}", nextRevision)
        .replaceAll("{{SESSION_ID}}", sessionId)
        .replaceAll("{{AGENT}}", agent)
        .replaceAll("{{TIMESTAMP}}", timestamp);
      let guidancePath;
      if (prepared.markdown) {
        const sha = createHash("sha256").update(prepared.markdown).digest("hex");
        guidancePath = path.join(root, ".specs/sessions", `${sessionId}-guidance-${sha}.md`);
        fs.mkdirSync(path.dirname(guidancePath), { recursive: true });
        if (!fs.existsSync(guidancePath)) fs.writeFileSync(guidancePath, prepared.markdown, { flag: "wx" });
        else if (fs.readFileSync(guidancePath, "utf8") !== prepared.markdown) throw new Error("Published guidance changed");
      }
      const tempPath = `${handoffPath}.tmp-${process.pid}`;
      fs.writeFileSync(tempPath, content);
      fs.renameSync(tempPath, handoffPath);
      console.log(`HANDOFF.md written atomically. revision: ${baseRevision} -> ${nextRevision}`);
      if (guidancePath) console.log(`Validated human guidance for the final response: ${guidancePath}`);
      process.exitCode = 0;
      return;
    }

    const sidecarDirectory = path.join(root, ".specs/sessions");
    fs.mkdirSync(sidecarDirectory, { recursive: true });
    const sidecarPath = path.join(sidecarDirectory, `${sessionId}.json`);
    let sidecarContent = fs.readFileSync(path.resolve(sidecarContentPath), "utf8");
    sidecarContent = sidecarContent
      .replaceAll("{{BASE_REVISION}}", baseRevision)
      .replaceAll("{{CONFLICTING_REVISION}}", diskRevision)
      .replaceAll("{{SESSION_ID}}", sessionId)
      .replaceAll("{{AGENT}}", agent)
      .replaceAll("{{TIMESTAMP}}", new Date().toISOString());
    fs.writeFileSync(sidecarPath, sidecarContent);
    console.error(
      `Concurrent write detected: this session's baseRevision was ${baseRevision}, but HANDOFF.md is now at revision ${diskRevision} — another session closed in between. HANDOFF.md was left untouched. Conflict recorded at ${sidecarPath}.`
    );
    process.exitCode = 2;
  } finally {
    releaseLock(lockPath);
  }
}

main();
