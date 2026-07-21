#!/usr/bin/env node
/**
 * Validate the RQML examples embedded in the documentation site.
 *
 * Every trace example published on rqml.org was silently invalid for the whole
 * 2.2.0 release: the docs still taught the nested endpoint form the schema had
 * dropped, and nothing checked them. This script closes that gap by running the
 * published examples through the same engine users run:
 *
 *   1. XSD validity   — each example is wrapped in a minimal document envelope
 *                       and validated against the current schema.
 *   2. Endpoint shape — every from/to value is parsed with the processor's own
 *                       micro-syntax parser, which the XSD cannot fully express.
 *
 * Snippets are fragments, so the envelope supplies the sections a bare <trace>
 * needs. Dangling local ids are expected in illustrative examples and are not
 * an error here — this checks syntax, not referential integrity.
 *
 * Usage: node scripts/check-docs-examples.mjs [--verbose]
 * Requires `pnpm build` first (it imports the built @rqml/core).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// Imported from the build output by path: this script runs at the workspace
// root, which does not depend on the packages it is checking the docs against.
const { parseEndpointRef, checkIntegrity } = await import(
  "../packages/core/dist/index.js"
);
const { validate } = await import("../packages/core/dist/validate/index.js");
const { DEFAULT_SCHEMA_VERSION, schemaNamespace } = await import(
  "../packages/schema/dist/index.js"
);

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const ROOTS = ["apps/website/docs", "apps/website/src"];
const EXTENSIONS = [".md", ".mdx", ".tsx", ".ts"];

/**
 * Complete example specs. These are published at rqml.org/examples and shipped
 * in @rqml/schema, so they are documentation as much as the prose is — and
 * unlike a fenced snippet they are whole documents, checked for referential
 * integrity too. The two directories are byte-identical mirrors; that is
 * asserted rather than assumed, because a manual copy is exactly the kind of
 * duplication that drifts silently.
 */
const SPEC_MIRRORS = ["packages/schema/examples", "apps/website/static/examples"];
const VERBOSE = process.argv.includes("--verbose");

const FENCE = /```xml\n([\s\S]*?)```/g;
const TRACE = /<trace>[\s\S]*?<\/trace>/g;
const EDGE = /<edge\b[^>]*?(?:\/>|>[\s\S]*?<\/edge>)/g;
const ENDPOINT = /\b(from|to)="([^"]+)"/g;
/**
 * A snippet deliberately showing a superseded serialization — e.g. the FAQ's
 * 2.1.0-vs-2.2.0 comparison — is marked with a version comment and skipped
 * from the marker to the next comment.
 */
const LEGACY = /<!--\s*2\.[01]\.\d+\s*-->[\s\S]*?(?=<!--|$)/g;

const envelope = (body) => `<?xml version="1.0" encoding="UTF-8"?>
<rqml xmlns="${schemaNamespace(DEFAULT_SCHEMA_VERSION)}" version="${DEFAULT_SCHEMA_VERSION}"
      docId="DOC-DOCS-CHECK" status="draft">
  <meta><title>docs example</title><system>docs</system></meta>
  <requirements>
    <req id="REQ-ENVELOPE" type="FR" title="envelope"><statement>placeholder</statement></req>
  </requirements>
${body}
</rqml>
`;

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "build" || entry === ".docusaurus")
      continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (EXTENSIONS.some((e) => entry.endsWith(e))) yield path;
  }
}

/** Trace fragments in one file: fenced xml in markdown, raw text elsewhere. */
function fragmentsIn(path, text) {
  const isMarkdown = path.endsWith(".md") || path.endsWith(".mdx");
  const blocks = isMarkdown ? [...text.matchAll(FENCE)].map((m) => m[1]) : [text];
  const out = [];
  for (const raw of blocks) {
    const block = raw.replace(LEGACY, "");
    const traces = block.match(TRACE) ?? [];
    out.push(...traces);
    // Edges shown without their enclosing <trace> wrapper.
    for (const edge of block.replace(TRACE, "").match(EDGE) ?? []) {
      out.push(`<trace>${edge}</trace>`);
    }
  }
  return out;
}

let examples = 0;
let endpoints = 0;
let elided = 0;
const problems = [];

for (const root of ROOTS) {
  for (const path of walk(join(ROOT, root))) {
    const rel = relative(ROOT, path);
    const text = readFileSync(path, "utf8");
    for (const fragment of fragmentsIn(path, text)) {
      // Structural outlines elide their content (`<trace>...</trace>`); they
      // illustrate shape, not syntax, and cannot be validated as written.
      if (fragment.includes("...")) {
        elided++;
        continue;
      }
      examples++;
      const line = text.slice(0, text.indexOf(fragment)).split("\n").length;

      const result = validate(envelope(fragment));
      for (const d of result.diagnostics) {
        problems.push(`${rel}:~${line} — ${d.message ?? d}`);
      }

      for (const [, side, value] of fragment.matchAll(ENDPOINT)) {
        endpoints++;
        const parsed = parseEndpointRef(value);
        if (!parsed.ok) {
          problems.push(`${rel}:~${line} — ${side}="${value}": ${parsed.error}`);
        } else if (VERBOSE) {
          console.log(`  ${parsed.locator.kind.padEnd(9)} ${value}`);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Published example specs: whole documents, so validated as-is and checked for
// referential integrity — not just XSD shape.
// ---------------------------------------------------------------------------
const [primary, ...mirrors] = SPEC_MIRRORS;
let specs = 0;

for (const name of readdirSync(join(ROOT, primary)).sort()) {
  if (!name.endsWith(".rqml")) continue;
  specs++;
  const rel = join(primary, name);
  const xml = readFileSync(join(ROOT, primary, name), "utf8");

  const result = validate(xml);
  if (result.schemaVersion !== DEFAULT_SCHEMA_VERSION) {
    problems.push(
      `${rel} — declares schema ${result.schemaVersion}, expected ${DEFAULT_SCHEMA_VERSION} (run: rqml migrate --spec ${rel})`,
    );
  }
  for (const d of result.diagnostics) problems.push(`${rel} — ${d.message ?? d}`);
  for (const d of checkIntegrity(xml)) problems.push(`${rel} — ${d.message ?? d}`);

  for (const mirror of mirrors) {
    const copy = join(ROOT, mirror, name);
    let other;
    try {
      other = readFileSync(copy, "utf8");
    } catch {
      problems.push(`${join(mirror, name)} — missing; mirror of ${rel}`);
      continue;
    }
    if (other !== xml) {
      problems.push(
        `${join(mirror, name)} — differs from ${rel}; the two example directories must stay byte-identical`,
      );
    }
  }
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} problem(s) in documentation examples:\n`);
  for (const p of problems) console.error(`  ${p}`);
  console.error(
    "\nDocs examples must be valid against the current schema. " +
      "Endpoints use the compact from/to micro-syntax — see docs/user-guide/trace.md.\n",
  );
  process.exit(1);
}

console.log(
  `✓ ${examples} documentation examples and ${specs} published specs valid against RQML ${DEFAULT_SCHEMA_VERSION} (${endpoints} endpoints parsed)${elided ? `; ${elided} elided outline(s) skipped` : ""}`,
);
