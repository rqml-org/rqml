# ADR-0002: Validation lives behind a separate, lazily loaded entry point

- **Status**: Accepted
- **Date**: 2026-05-29
- **Classification**: `derived_from_requirements`
- **Decision ID** (in `rqml-core.rqml`): `DEC-LAZY-WASM`
- **Related requirements**: `REQ-LAZY-WASM`, `REQ-WASM-LIBXML`, `REQ-ESM`, `REQ-ISOMORPHIC`
- **Related ADRs**: `ADR-0001` (version dispatch)
- **Affected components**: `src/index.ts` (the `.` entry), `src/validate/index.ts` (the `./validate` entry), `package.json` `exports`

## Context

XSD validation uses a WebAssembly build of libxml2 (`DEC-WASM-LIBXML`) so a
single validation engine works identically in browsers and Node. That WASM
runtime is large and has a non-trivial initialization cost. But many consumers
never validate: a renderer that only parses and displays requirements, a trace
analyzer, or a linter pays nothing for XSD support it does not use.
`REQ-LAZY-WASM` requires that parse/lint/trace consumers not load the WASM
module, and `REQ-ESM` requires tree-shakeable entry points.

## Decision drivers

- Parsing and lint run on every debounced keystroke in the editor; they must not
  drag in a WASM runtime.
- Web tooling is size-sensitive — the WASM blob should be excluded from bundles
  that never validate.
- The library must stay isomorphic; the split must not introduce a Node-only
  dependency into the browser-reachable path.

## Options considered

1. **Single entry exporting everything.** Simplest import story, but any import
   of the package risks pulling the WASM engine into the bundle, and reliable
   tree-shaking of a stateful WASM init is fragile. Rejected.
2. **Runtime feature flag / lazy `import()` inside one entry.** Keeps one public
   module but hides a dynamic import; consumers cannot statically see the
   boundary and bundlers split it inconsistently. Rejected.
3. **Two explicit entry points.** A WASM-free default entry `.`
   (parse, serialize, model, lint, trace, `checkIntegrity`) and a separate
   `./validate` entry that owns the libxml2 WASM engine. Importing `./validate`
   is what initializes WASM; importing `.` never does. Chosen.

## Decision

The package exposes two entry points via its `exports` map:

- `rqml-core` — the WASM-free core: `parse`, `serialize`, the typed model, lint,
  trace resolution, and `checkIntegrity`.
- `rqml-core/validate` — `validate()`, which owns and initializes the libxml2
  WASM runtime.

A consumer that only needs structural and referential checks imports the core
entry plus `checkIntegrity`; it pays the WASM cost only when it additionally
imports `./validate`. The boundary is explicit in the import graph, so bundlers
exclude the WASM blob from builds that never reach the validate entry.

## Consequences

**Positive**
- Parse/lint/trace consumers — including keystroke-frequency editor paths — load
  no WASM.
- Size-sensitive web bundles exclude the libxml2 blob unless they validate.
- The WASM/isomorphic boundary is visible and enforced by module structure, not
  by convention.

**Negative**
- Two entry points to document and keep stable (`REQ-API-STABILITY`).
- Consumers must know to import `validate` from `rqml-core/validate`; a wrong
  import path is a discoverable but real friction point.
- Referential integrity had to be made WASM-free to live in the core entry — see
  `ADR-0004`.

## Supersession

None. This ADR is current.
