#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { deriveAssetFailureDisposition, ingestProductAsset, verifyAssetInventory } from "./product-design-control.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CLI = path.join(ROOT, "integrations/frontend/product-design-control.mjs");
const PNG_1X1 = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
const digest = "a".repeat(64);
const subject = { project: "fixture", commit: "b".repeat(40) };
let assertions = 0;

function equal(actual, expected, message) {
  assertions += 1;
  assert.deepEqual(actual, expected, message);
}

function ok(actual, message) {
  assertions += 1;
  assert.ok(actual, message);
}

function findingIds(result) {
  return [...new Set(result.findings.map((finding) => finding.id))].sort();
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const name = Buffer.from(type, "ascii");
  const result = Buffer.alloc(data.length + 12);
  result.writeUInt32BE(data.length, 0);
  name.copy(result, 4);
  data.copy(result, 8);
  result.writeUInt32BE(crc32(Buffer.concat([name, data])), data.length + 8);
  return result;
}

function rgbaPng(width, height) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    const row = Buffer.alloc(1 + width * 4);
    for (let x = 0; x < width; x += 1) {
      row[1 + x * 4] = x * 50;
      row[2 + x * 4] = y * 80;
      row[3 + x * 4] = 120;
      row[4 + x * 4] = 255;
    }
    rows.push(row);
  }
  return Buffer.concat([signature, pngChunk("IHDR", header), pngChunk("IDAT", zlib.deflateSync(Buffer.concat(rows))), pngChunk("IEND", Buffer.alloc(0))]);
}

function validInput(filePath) {
  return {
    subject,
    filePath,
    request: {
      artifactKind: "asset-acquisition-request",
      schemaVersion: "1.0.0",
      semanticDigest: digest,
      assetId: "hero",
      attempt: 1,
      type: "illustration",
      composition: { aspectRatio: "1:1", focalPoint: "center" },
      delivery: { minimumWidth: 1, minimumHeight: 1, formats: ["png"], transparency: true, maximumBytes: 100000 },
      altTextIntent: "Documentos organizados"
    },
    rightsAttestation: {
      origin: "generated-by-user",
      rightToUse: true,
      attestedAt: "2026-08-26",
      attestedBy: "fixture-owner"
    },
    license: {
      id: "CC0-1.0",
      sourceUrl: "https://example.com/generated-asset-attestation",
      verifiedAt: "2026-08-26"
    },
    inspection: {
      provenance: "browser-derived",
      contentMatches: true,
      compositionMatches: true,
      visibleText: [],
      logos: [],
      persons: [],
      sensitiveMetadataDetected: [],
      altText: "Documentos organizados convergem para uma decisão"
    },
    variants: []
  };
}

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "product-asset-ingest-"));
try {
  const pngPath = path.join(temp, "hero.png");
  fs.writeFileSync(pngPath, PNG_1X1);
  const accepted = ingestProductAsset(validInput(pngPath));
  equal(accepted.findings, [], "A matching rights-attested PNG must pass.");
  equal(accepted.sidecar.mime, "image/png", "MIME must come from magic bytes.");
  equal([accepted.sidecar.width, accepted.sidecar.height], [1, 1], "Dimensions must come from the image binary.");
  equal(accepted.sidecar.fileDigest, crypto.createHash("sha256").update(PNG_1X1).digest("hex"), "File digest must be SHA-256.");
  equal(accepted.sidecar.sensitiveMetadataRemoved, true, "Approved sidecar must attest sanitized metadata.");
  ok(!JSON.stringify(accepted.sidecar).includes(pngPath), "The original absolute path must never be persisted.");

  fs.mkdirSync(path.join(temp, "src"));
  fs.writeFileSync(path.join(temp, "src/page.tsx"), '<img src="../hero.png" />');
  fs.writeFileSync(path.join(temp, "hero.asset.json"), JSON.stringify(accepted.sidecar));
  const inventory = { root: temp, sourceDirectories: ["src"], assets: [{ ref: "hero.png", file: "hero.png", sidecar: "hero.asset.json" }] };
  equal(verifyAssetInventory(inventory).status, "passed", "Referenced PNG with approved ingestion provenance must pass without re-ingestion");
  equal(verifyAssetInventory({ ...inventory, assets: [] }).status, "failed", "Omitted product image must fail");
  fs.copyFileSync(pngPath, path.join(temp, "unrelated.png"));
  equal(verifyAssetInventory({ ...inventory, assets: [{ ...inventory.assets[0], file: "unrelated.png" }] }).status, "failed", "Unrelated file cannot stand in for referenced asset");

  const mismatchPath = path.join(temp, "hero.jpg");
  fs.writeFileSync(mismatchPath, PNG_1X1);
  equal(findingIds(ingestProductAsset(validInput(mismatchPath))), ["PDA-10"], "Extension/MIME mismatch must fail with PDA-10.");

  const tooSmall = validInput(pngPath);
  tooSmall.request.delivery.minimumWidth = 2;
  equal(findingIds(ingestProductAsset(tooSmall)), ["PDA-10"], "Insufficient dimensions must fail with PDA-10.");

  const corruptPath = path.join(temp, "corrupt.png");
  fs.writeFileSync(corruptPath, PNG_1X1.subarray(0, 24));
  equal(findingIds(ingestProductAsset(validInput(corruptPath))), ["PDA-10"], "Corrupt image must fail with PDA-10.");

  const crcCorruptPath = path.join(temp, "crc-corrupt.png");
  const crcCorrupt = Buffer.from(PNG_1X1);
  crcCorrupt[crcCorrupt.length - 1] ^= 0xff;
  fs.writeFileSync(crcCorruptPath, crcCorrupt);
  equal(findingIds(ingestProductAsset(validInput(crcCorruptPath))), ["PDA-10"], "PNG chunk corruption must fail closed with PDA-10.");

  const noRights = validInput(pngPath);
  noRights.rightsAttestation.rightToUse = false;
  equal(findingIds(ingestProductAsset(noRights)), ["PDA-08"], "Missing right to use must fail with PDA-08.");
  equal(ingestProductAsset(noRights).findings[0].decisionClass, "legal-consequential", "Unverified rights must route to legal-consequential authority.");

  const sensitive = validInput(pngPath);
  sensitive.inspection.sensitiveMetadataDetected = ["GPS"];
  equal(findingIds(ingestProductAsset(sensitive)), ["PDA-10"], "Sensitive metadata must be rejected until sanitized.");

  const uninspected = validInput(pngPath);
  delete uninspected.inspection.provenance;
  equal(findingIds(ingestProductAsset(uninspected)), ["PDA-10"], "Missing content inspection provenance must fail closed.");

  equal(deriveAssetFailureDisposition({ attempt: 1, essentiality: "expressive" }), "corrected-request", "First invalid delivery permits one correction.");
  equal(deriveAssetFailureDisposition({ attempt: 0, essentiality: "expressive" }), "request", "Before any delivery, the controller remains in the initial request state.");
  equal(deriveAssetFailureDisposition({ attempt: 2, essentiality: "expressive" }), "recompose-without-asset", "Second expressive failure triggers recomposition.");
  equal(deriveAssetFailureDisposition({ attempt: 2, essentiality: "essential" }), "blocked", "Second essential failure remains blocked.");

  const inputPath = path.join(temp, "ingest.json");
  const outputDir = path.join(temp, "out");
  fs.writeFileSync(inputPath, `${JSON.stringify(validInput(pngPath), null, 2)}\n`);
  const cli = spawnSync(process.execPath, [CLI, "ingest-asset", "--input", inputPath, "--output-dir", outputDir], { cwd: ROOT, encoding: "utf8" });
  equal(cli.status, 0, `ingest-asset CLI failed:\n${cli.stderr}`);
  ok(fs.existsSync(path.join(outputDir, "hero.asset.json")), "CLI must emit the canonical asset sidecar.");

  const widePath = path.join(temp, "wide.png");
  fs.writeFileSync(widePath, rgbaPng(4, 2));
  const cropInput = validInput(widePath);
  cropInput.request.composition.aspectRatio = "2:1";
  cropInput.request.delivery.minimumWidth = 4;
  cropInput.request.delivery.minimumHeight = 2;
  cropInput.request.crops = [{ target: "mobile", aspectRatio: "1:1", focalPoint: "center" }];
  cropInput.request.expectedFileName = "wide.png";
  const cropInputPath = path.join(temp, "crop-ingest.json");
  const cropOutputDir = path.join(temp, "crop-out");
  fs.writeFileSync(cropInputPath, `${JSON.stringify(cropInput, null, 2)}\n`);
  const cropCli = spawnSync(process.execPath, [CLI, "ingest-asset", "--input", cropInputPath, "--output-dir", cropOutputDir], { cwd: ROOT, encoding: "utf8" });
  equal(cropCli.status, 0, `ingest-asset crop CLI failed:\n${cropCli.stderr}`);
  const cropSidecar = JSON.parse(fs.readFileSync(path.join(cropOutputDir, "hero.asset.json"), "utf8"));
  equal(cropSidecar.variants.length, 1, "Every requested crop must produce a canonical variant.");
  equal([cropSidecar.variants[0].width, cropSidecar.variants[0].height], [2, 2], "The generated mobile crop must honor the requested ratio.");
  ok(fs.existsSync(path.join(cropOutputDir, cropSidecar.variants[0].fileName)), "The generated crop file must exist beside the sidecar.");
  const cropBytes = fs.readFileSync(path.join(cropOutputDir, cropSidecar.variants[0].fileName));
  equal(cropSidecar.variants[0].fileDigest, crypto.createHash("sha256").update(cropBytes).digest("hex"), "Variant digest must match the generated crop bytes.");
  equal(cropSidecar.variants[0].meaningPreserved, true, "Generated variants require explicit meaning-preservation evidence.");
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

console.log(`Product design asset ingest tests passed (${assertions} assertions).`);
