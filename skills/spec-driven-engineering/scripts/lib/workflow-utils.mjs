import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export function parseArgs(argv) {
  const result = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) {
      result._.push(value);
      continue;
    }
    const key = value.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      result[key] = true;
      continue;
    }
    result[key] = next;
    index += 1;
  }
  return result;
}

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function ensureDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

export function listFiles(directory, predicate = () => true) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(fullPath, predicate));
    else if (predicate(fullPath)) files.push(fullPath);
  }
  return files.sort();
}

export function hashFile(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

export function hashTree(directory, ignored = []) {
  const normalizedIgnored = ignored.map((item) => item.split(path.sep).join("/"));
  const hash = crypto.createHash("sha256");
  const files = listFiles(directory, (filePath) => {
    const relative = path.relative(directory, filePath).split(path.sep).join("/");
    return !normalizedIgnored.some((item) => relative === item || relative.startsWith(`${item}/`));
  });
  for (const filePath of files) {
    const relative = path.relative(directory, filePath).split(path.sep).join("/");
    hash.update(relative);
    hash.update("\0");
    hash.update(fs.readFileSync(filePath));
    hash.update("\0");
  }
  return { digest: hash.digest("hex"), files: files.length };
}

export function timestamp() {
  return new Date().toISOString().replace(/[-:.]/g, "").replace("T", "-").replace("Z", "Z");
}

export function relativePortable(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

export function printReport(title, errors, warnings, information = []) {
  console.log(title);
  console.log("=".repeat(title.length));
  for (const error of errors) console.log(`[ERROR] ${error}`);
  for (const warning of warnings) console.log(`[WARNING] ${warning}`);
  for (const item of information) console.log(`[INFO] ${item}`);
  console.log(`Errors: ${errors.length}`);
  console.log(`Warnings: ${warnings.length}`);
  return errors.length === 0;
}
