# ADR-0009: Narrow `@rqml/core` to a Node-only runtime

- **Status**: Accepted
- **Date**: 2026-06-07
- **Classification**: `discretionary_design_choice`
- **Related requirements**: `REQ-CORE-VALIDATE`, `REQ-CORE-DEPS`, `REQ-CLI-OFFLINE`; supersedes the intent of `REQ-ISOMORPHIC`, `REQ-WASM-LIBXML` (browser parity), `QGOAL-BUNDLE-SIZE`
- **Related ADRs**: `ADR-0002` (lazy validation entry), `ADR-0008` (monorepo merge)
- **Affected components**: `tsconfig.json` (drops `DOM` lib), `package.json`, `src/validate/`

## Context

The standalone `rqml-core` made isomorphism — running identically in browsers and
Node — a load-bearing goal (`CON-ISOMORPHIC`, `GOAL-ISOMORPHIC`, `REQ-ISOMORPHIC`,
`SCN-WEB`), and chose a WebAssembly libxml2 build partly so a single validation
path would also run in the browser (`REQ-WASM-LIBXML`). The umbrella RQML
requirements that now govern the toolchain do **not** carry a browser requirement:
every consumer of the engine — the `rqml` CLI, the `@rqml/mcp` server, and the VS
Code extension host — runs on Node, and the requirements ask only for offline,
deterministic operation (`CON-OFFLINE`, `REQ-CORE-VALIDATE`).

## Decision drivers

- All known and planned consumers run on Node; no browser consumer remains in
  scope after the merge.
- A narrower supported surface removes the browser-parity test matrix and the
  bundle-size budget, lowering maintenance cost.
- Determinism and offline operation — the properties the gate actually depends
  on — are runtime-agnostic and are retained.

## Options considered

1. **Keep full isomorphism (browser a first-class, tested target).** Most faithful
   to the original spec; highest ongoing cost (WASM-parity tests, bundle budget)
   for a capability no current consumer uses. Rejected.
2. **Isomorphic-capable but Node-tested.** Keep the code browser-safe without
   testing or supporting the browser. Ambiguous contract; invites silent breakage.
   Rejected.
3. **Node-only (chosen).** Declare Node 18+ the supported runtime. Drop the
   browser guarantee, the `DOM` lib from the TypeScript config, and the
   bundle-size goal. The libxml2 **WASM** engine is retained — it already works
   under Node and avoids a native build — but the door is open to a Node-native
   `xmllint` later since browser parity is no longer required.

## Decision

`@rqml/core` targets **Node 18+ only**. The browser is not a supported target.
The validation engine stays WASM-based (no behavioral change); the
`@rqml/core/validate` lazy entry point is retained for tree-shaking, not for
browser bundle size.

## Consequences

Positive: smaller test and support surface; freedom to adopt Node-native tooling.
Negative: a future rqml.org web playground that wants in-browser validation would
have to re-establish browser support or call the engine through a service. The
isomorphism requirements in `core.rqml` (`REQ-ISOMORPHIC`, `REQ-WASM-LIBXML`'s
browser clause, `SCN-WEB`, `QGOAL-BUNDLE-SIZE`) are superseded by this ADR and
should be read as historical.

## Supersession

None. (Supersedes the browser-facing intent of the listed `core.rqml` items.)
