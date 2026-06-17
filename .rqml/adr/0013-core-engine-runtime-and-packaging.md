# ADR-0013: `@rqml/core` runtime and packaging — Node-only engine, WASM-free default entry, lazy `./validate`

- Status: Accepted
- Date: 2026-06-17
- Classification: discretionary_design_choice
- Consolidates: historical rqml-core ADR-0002 (lazy validation entry), ADR-0009 (Node-only runtime)
- Related requirements: REQ-CORE-DEPS, REQ-CORE-VALIDATE, REQ-CORE-NO-LLM, REQ-TS-ENGINE, CON-OFFLINE
- Related ADRs: ADR-0002 (TypeScript monorepo — inter-package boundaries); ADR-0004 (reconcile core requirements after the rqml-core merge — §3 Node-only); ADR-0014 / ADR-0015 (the WASM-free `.`-entry APIs this packaging exposes)
- Affected components: packages/core/package.json (`exports`), packages/core/src/index.ts (the `.` entry), packages/core/src/validate/index.ts (the `./validate` entry), tsconfig

## Context

This record consolidates two historical rqml-core decisions that jointly define
how the engine is packaged and what it runs on. Both remain the live contract in
`packages/core`, and neither is captured by an existing root ADR — root ADR-0002
governs only the inter-package dependency direction (`@rqml/core` not depending
on the CLI/MCP), not the intra-package entry split.

XSD validation uses a WebAssembly build of libxml2: one engine that runs under
any JS runtime, but a large module with a non-trivial initialization cost. Many
consumers never validate — a renderer that only displays requirements, a trace
analyzer, a linter — and parse/lint run on every debounced keystroke in the
editor, so they must not drag in a WASM runtime.

Separately, the standalone `rqml-core` once made isomorphism (browser + Node
parity) a load-bearing goal and chose the WASM engine partly so one validation
path would also run in the browser. After the merge, the umbrella requirements
carry no browser requirement: every consumer — the `rqml` CLI, the `@rqml/mcp`
server, and the VS Code extension host — runs on Node, and the requirements ask
only for offline, deterministic operation (CON-OFFLINE, REQ-CORE-VALIDATE).

## Decision drivers

- Parse/lint/trace — keystroke-frequency in the editor — must load no WASM.
- The WASM/runtime boundary should be visible and enforced by module structure,
  not by convention.
- All known and planned consumers run on Node; a browser-parity test matrix and
  a bundle-size budget buy nothing.
- Determinism and offline operation — the properties the enforcement gate depends
  on — are runtime-agnostic and must be retained.

## Options considered

### Option 1: Single entry exporting everything
Simplest import story.

**Pros**
- One module to import; nothing to learn.

**Cons**
- Any import risks pulling the WASM engine into the bundle; reliable
  tree-shaking of a stateful WASM init is fragile. Rejected.

### Option 2: One entry with an internal lazy `import()` / feature flag
Keep a single public module and hide a dynamic import.

**Pros**
- Single import path preserved.

**Cons**
- Consumers cannot statically see the boundary; bundlers split it
  inconsistently. Rejected.

### Option 3: Two explicit entry points + Node-only target (chosen)
A WASM-free default `.` entry and a separate `./validate` entry, on a Node-only
runtime.

**Pros**
- The WASM boundary is explicit in the import graph and excluded from builds that
  never validate.
- Dropping the browser target removes the parity test matrix and bundle budget
  while keeping the runtime-agnostic determinism/offline guarantees.

**Cons**
- Two entry points to document and keep stable; a wrong import path is real
  friction.

## Decision

`@rqml/core` exposes two entry points via its `exports` map and targets **Node
18+ only**:

- `.` — the WASM-free core: `parse`, `serialize`, the typed model, lint, trace
  resolution, `checkIntegrity`, and the outline/markdown projection (ADR-0015).
- `./validate` — `validate()`, which owns and initializes the libxml2 WASM
  runtime.

Importing `./validate` is what initializes WASM; importing `.` never does, so
bundlers exclude the blob from builds that never reach the validate entry. The
browser is **not** a supported target (the `DOM` lib is dropped from the
TypeScript config and the bundle-size goal is abandoned). The validation engine
stays WASM-based — no behavioral change — and the lazy `./validate` entry is
retained for **tree-shaking, not browser bundle size**; the door is left open to
a Node-native `xmllint` later since browser parity is no longer required.

## Consequences

### Positive
- Parse/lint/trace consumers — including editor keystroke paths — load no WASM.
- The WASM boundary is enforced by the import graph, not by convention.
- A smaller test/support surface and freedom to adopt Node-native XML tooling.

### Negative
- Two entry points to document and keep stable (REQ-CORE-API); a wrong import
  path is a discoverable but real friction point.
- Referential integrity had to be made WASM-free to live in the `.` entry (the
  integrity-in-code decision, now reconciled in root ADR-0004 §1).
- A future in-browser rqml.org playground would have to re-establish browser
  support or call the engine through a service.

## Supersession

Consolidates and replaces historical rqml-core ADR-0002 (lazy validation entry)
and ADR-0009 (Node-only runtime), preserved in git history. ADR-0009 superseded
ADR-0002's original browser/bundle-size rationale while retaining the entry
split; this record carries the entry-split contract as the primary live decision
with the Node-only ruling as its runtime context (also restated by root ADR-0004
§3).
