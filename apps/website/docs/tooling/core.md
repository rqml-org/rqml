---
title: "@rqml/core — the engine"
sidebar_label: "@rqml/core"
sidebar_position: 1
description: The RQML engine — parse, serialize, validate, lint, trace, coverage, and drift, as a typed TS/JS library.
---

# @rqml/core

The engine that every other RQML surface reuses. It turns a `.rqml` document into
a typed model and answers structural, semantic, and traceability questions about
it — deterministically and offline.

```bash
npm install @rqml/core
```

ESM, TypeScript types included, Node 18+.

## What it does

- **Parse / serialize** — `parse()` turns a document string into a typed
  `RqmlDocument`; `serialize()` writes a model back to XML. Round-tripping
  preserves structure.
- **Validate** — XSD validation (via a bundled libxml2 WebAssembly build) plus an
  in-code referential-integrity pass: id uniqueness, trace keyref rules, and
  state-machine references (the `initial` state resolves, transition endpoints
  resolve within their machine, `final` states have no outgoing transitions).
- **Lint** — strictness-aware semantic checks beyond what the schema can express.
- **Trace** — resolve trace edges, index declared ids, and flag dangling local
  references.
- **Impact** — `impactOf()` traverses the trace graph transitively in both
  directions: what is affected if this artifact changes, with paths, grouped by
  edge type and direction.
- **Coverage** — which goals lack a satisfying requirement, which requirements are
  unverified, unimplemented, or orphaned — plus lifecycle-aware views: the
  **approved-only** implementation gap, and *premature implementations*
  (an `implements` edge pointing at a requirement that is not approved).
- **Approval gate** — `approvalGate()` reports implementation linked to a
  requirement that is not approved (optionally scoped to a set of changed
  paths), so an editor/agent hook or CI can block before non-approved code lands.
- **Drift** — resolve the external locators of `implements` edges and report links
  whose target is **missing** or — against a recorded content-hash baseline —
  **changed**.
- **Extract** — `extractArtifact()` returns one artifact's statement, acceptance
  criteria, and trace neighborhood; `sliceToMarkdown()` renders it for agent
  context, so a consumer reads a slice instead of the whole document.
- **Edit** — `appendTraceEdge()` records an `implements`/`verifiedBy` edge as a
  *textual* insertion, preserving XML comments and hand formatting, with
  deterministic edge-id derivation and integrity checking of the result;
  `updateTraceEdge()` repoints an existing edge's external locator in place
  under the same guarantees; `setStatus()` transitions an artifact's lifecycle
  status (e.g. draft → approved) as the same kind of safe textual edit.
- **Skeletons** — `skeleton()` emits schema-valid snippets for `req`, `edge`,
  `testCase`, and `stateMachine`.
- **Project / export** — a document outline and a Markdown serializer
  (`buildOutline`/`outlineToMarkdown`); `projectOutline()` scopes the outline to
  chosen sections or ids; `buildMatrix()` derives the traceability matrix — one
  row per requirement (status, goals, implementing code, verifying tests,
  coverage), the single source every surface renders.

## Two entry points

Validation pulls in the libxml2 WASM runtime, so it lives behind a **separate,
lazily loaded** entry. Consumers that only parse, lint, or trace never pay for it.

```ts
import {
  parse, serialize, lint, resolveTrace, computeCoverage, detectDrift,
  impactOf, extractArtifact, appendTraceEdge, updateTraceEdge, setStatus,
  skeleton, computeBaseline, buildMatrix, projectOutline, approvalGate,
} from "@rqml/core";
import { validate } from "@rqml/core/validate"; // loads the XSD engine
```

:::info Stable contract
The `.` and `@rqml/core/validate` entry points and the ESM output are a stable
contract — the VS Code extension consumes them directly.
:::

## Examples

### Parse and inspect

```ts
import { parse } from "@rqml/core";

const result = parse(xmlString);
if (!result.ok) {
  console.error(result.error.message); // structured parse error with line/column
} else {
  const doc = result.document;
  console.log(doc.docId, doc.version, doc.status);
}
```

### Validate (XSD + referential integrity)

```ts
import { checkIntegrity } from "@rqml/core";
import { validate } from "@rqml/core/validate";

const v = validate(xmlString);                 // { valid, schemaVersion, diagnostics }
const integrity = v.valid ? checkIntegrity(xmlString) : [];
const ok = v.valid && integrity.length === 0;
```

The schema version is detected from the document's namespace
(`xmlns="https://rqml.org/schema/2.1.0"`); pass `{ schemaVersion }` to force one.
The XSD text is bundled from `@rqml/schema`, so this works with no network access.

### Coverage and drift

```ts
import { parse, computeCoverage, detectDrift, loadBaseline } from "@rqml/core";

const { document } = parse(xmlString) as { document: import("@rqml/core").RqmlDocument };

const coverage = computeCoverage(document);
// → { uncoveredGoals, unverifiedRequirements, unimplementedRequirements,
//     unimplementedApprovedRequirements, prematureImplementations,
//     orphanRequirements, ... }

const drift = detectDrift(document, {
  baseDir: process.cwd(),
  baseline: loadBaseline(process.cwd()),   // .rqml/baseline.json, written by `rqml link`
});
// → { links, drifted, diagnostics }
//   drifted = implements links whose code is missing — or changed vs. its baseline hash
```

`detectDrift` accepts an injectable `resolve` function, so it stays deterministic
and testable without touching the filesystem. `computeBaseline()` /
`saveBaseline()` produce and persist the content hashes the `changed` state is
judged against.

### Impact, extraction, and link recording

```ts
import { impactOf, extractArtifact, sliceToMarkdown, appendTraceEdge } from "@rqml/core";

const impact = impactOf(document, "REQ-PAY-001");
// → { affected: [{ id, kind, distance, path }], groups: [{ direction, type, ids }] }

const slice = extractArtifact(document, "REQ-PAY-001");
if (slice) console.log(sliceToMarkdown(slice));
// one requirement — statement, acceptance criteria, trace neighborhood — and nothing else

const linked = appendTraceEdge(xmlString, {
  artifactId: "REQ-PAY-001",
  uri: "src/payments/capture.ts#capture",
  type: "implements",
});
if (linked.ok) {
  // linked.xml is the full document with the new edge; comments and formatting intact
  // linked.edgeId is deterministic: "E-IMPL-PAY-001"
}

const repointed = updateTraceEdge(linked.ok ? linked.xml : xmlString, {
  artifactId: "REQ-PAY-001",
  uri: "src/payments/charge.ts#charge",   // the implementation moved
  type: "implements",                      // matches E-IMPL-PAY-001; pass edgeId for a custom id
});
if (repointed.ok) {
  // only the <external> locator changed — same edge id, same orientation;
  // existing kind/title are preserved, and repointed.previousUri holds the old URI
}
```

## Guarantees

- **Dependency-clean.** `@rqml/core` declares no CLI argument-parser or MCP SDK as
  a runtime dependency, so editors and agents can embed it without dragging in the
  toolchain edges.
- **No model in the engine.** Validation, coverage, and drift are pure functions of
  their inputs — identical inputs yield identical results.
- **Offline.** The schema is inlined at build time; nothing is fetched at runtime.
