#!/usr/bin/env node
import assert from "node:assert/strict";

if (process.env.PDA_OPENVERSE_LIVE_SMOKE !== "1") {
  console.log("Openverse live smoke skipped (set PDA_OPENVERSE_LIVE_SMOKE=1 to enable).");
  process.exit(0);
}

const endpoint = new URL("https://api.openverse.org/v1/images/");
endpoint.searchParams.set("q", "organized documents");
endpoint.searchParams.set("page_size", "1");
const response = await fetch(endpoint, {
  headers: { Accept: "application/json", "User-Agent": "spec-driven-development-product-design-smoke/1.0" },
  signal: AbortSignal.timeout(15000)
});
assert.equal(response.ok, true, `Openverse live smoke returned HTTP ${response.status}.`);
const body = await response.json();
assert.ok(Array.isArray(body.results) && body.results.length > 0, "Openverse live smoke returned no image result.");
const result = body.results[0];
assert.ok(result.id && result.foreign_landing_url && result.license, "Openverse result is missing required provenance fields.");
console.log("Openverse live smoke passed (1 unauthenticated image search result inspected)." );
