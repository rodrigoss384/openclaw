#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { listFiles, parseArgs, relativePortable } from "./lib/workflow-utils.mjs";

const args = parseArgs(process.argv.slice(2));
const roots = [];
if (args.root) roots.push(path.resolve(String(args.root)));
if (args.roots) roots.push(...String(args.roots).split(",").map((item) => path.resolve(item.trim())));
if (roots.length === 0) roots.push(path.resolve("skills"));

const skills = [];
for (const root of roots) {
  for (const skillFile of listFiles(root, (filePath) => path.basename(filePath) === "SKILL.md")) {
    const content = fs.readFileSync(skillFile, "utf8");
    const frontmatter = content.match(/^---\s*\n([\s\S]*?)\n---/);
    const name = frontmatter?.[1].match(/^name:\s*["']?([^\n"']+)/m)?.[1]?.trim() || null;
    const description = frontmatter?.[1].match(/^description:\s*["']?([^\n"']+)/m)?.[1]?.trim() || null;
    skills.push({
      name,
      description,
      root,
      path: relativePortable(root, path.dirname(skillFile)),
      skillFile
    });
  }
}

const byName = new Map();
for (const skill of skills) {
  const key = skill.name || "<missing>";
  if (!byName.has(key)) byName.set(key, []);
  byName.get(key).push(skill.skillFile);
}
const duplicates = [...byName.entries()]
  .filter(([, files]) => files.length > 1)
  .map(([name, files]) => ({ name, files }));

const report = {
  generatedAt: new Date().toISOString(),
  roots,
  count: skills.length,
  missingFrontmatterNames: skills.filter((skill) => !skill.name).map((skill) => skill.skillFile),
  duplicates,
  skills: skills.sort((a, b) => String(a.name).localeCompare(String(b.name)))
};
const output = `${JSON.stringify(report, null, 2)}\n`;
if (args.output) {
  const outputPath = path.resolve(String(args.output));
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, output);
  console.log(`Skill inventory written: ${outputPath}`);
} else {
  process.stdout.write(output);
}
