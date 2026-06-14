# ADR-0006: Derive the traceability matrix in @rqml/core

- Status: Accepted
- Date: 2026-06-14
- Classification: discretionary_design_choice
- Related requirements: REQ-CORE-MATRIX, REQ-LOOP-MATRIX, REQ-CORE-API, REQ-MCP-PARITY
- Related ADRs: ADR-0003 (deterministic checking); rqml-vscode ADR-0001 and ADR-0004 (delegate engine to @rqml/core)
- Affected components: core (new matrix derivation), cli, mcp, rqml-vscode extension

## Context

A traceability matrix — one row per requirement carrying its status, upstream
goals, implementing artifacts, verifying tests, and derived verification and
implementation coverage — is the canonical "spec health" surface. The RQML VS
Code extension already renders a rich one, but it derives that matrix **in the
extension**, from the extension's own parser (`rqmlToMatrix.ts`,
`matrixDerive.ts`, `matrixSchema.ts`), re-implementing edge classification,
coverage status, and warnings independently of `@rqml/core`.

That is a latent violation of the one-engine principle: the editor can disagree
with `rqml check` about whether a requirement is verified or implemented.
Meanwhile the CLI and MCP — where agents live — have no matrix at all. A matrix
is, however, just a presentation of coverage plus resolved titles, both of which
`@rqml/core` already computes (`computeCoverage`, `resolveTrace`).

## Decision drivers

- One engine, no divergence between surfaces (REQ-CORE-API).
- CLI/MCP parity (REQ-MCP-PARITY): a text matrix for agents must equal what the
  editor shows.
- Determinism: stable, sorted output, no model in the path.
- The hard work already exists in core; re-deriving it downstream is duplicated
  logic that will drift.
- `@rqml/core` must stay dependency-clean (REQ-CORE-DEPS) — no Zod in core.

## Options considered

### Option 1: Keep the matrix in the extension; add separate matrix logic for CLI/MCP
Leave `rqmlToMatrix.ts` where it is and write parallel derivations for the new
surfaces.

**Pros**
- No refactor of the extension.

**Cons**
- Triples the derivation logic across editor, CLI, and MCP.
- Guarantees the surfaces drift apart — exactly what one-engine forbids.

### Option 2: Derive the matrix once in @rqml/core; surfaces render it (chosen)
Add a matrix derivation to `@rqml/core` (e.g. `analyze/matrix.ts` →
`buildMatrix(doc): MatrixReport`) composed from `computeCoverage` and
`resolveTrace`, with plain TypeScript types and deterministic ordering. The CLI
`rqml matrix` and MCP `rqml_matrix` render it; the VS Code extension becomes an
adapter from `MatrixReport` to its webview shape.

**Pros**
- Single source; editor, CLI, MCP, and CI agree by construction.
- Agents get a text/JSON matrix for free.
- Removes duplicated derivation from the extension.

**Cons**
- Breaking refactor of the extension's matrix pipeline (adapter + a
  `@rqml/core` version bump).
- Parity tests to add for the new surfaces.

### Option 3: Put the matrix in a shared non-core library
A separate package both core consumers and the extension depend on.

**Pros**
- Keeps it out of core.

**Cons**
- `@rqml/core` already *is* the shared library by design; a second one
  fragments the engine.

## Decision

Adopt **Option 2**. The traceability matrix is derived in `@rqml/core` from the
trace graph and coverage report, as the single source every surface renders
(REQ-CORE-MATRIX). The CLI and MCP expose it at parity (REQ-LOOP-MATRIX), and
the VS Code extension adapts the core matrix to its view (rqml-vscode
REQ-MAT-DELEGATE), retiring its own derivation. Core uses plain TypeScript types
and stable ordering; no Zod and no model enter the engine.

## Consequences

### Positive
- One definition of spec health, rendered as a webview, a text table, and JSON.
- Closes a silent one-engine violation.
- Less code overall.

### Negative
- The extension's matrix pipeline must be refactored to an adapter and pinned to
  the newer `@rqml/core`; sequence adapter-first so the editor keeps shipping.
- Warning ordering must be derived from sorted coverage, not ported from the
  extension's ad-hoc logic, to stay deterministic.

## Supersession

None
