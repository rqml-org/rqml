# ADR-0008: Merge rqml-core into the RQML monorepo as `@rqml/core`

- **Status**: Accepted
- **Date**: 2026-06-07
- **Classification**: `discretionary_design_choice`
- **Related requirements**: `REQ-WORKSPACE`, `REQ-PACKAGE-LAYOUT`, `REQ-CORE-DEPS`, `REQ-SCHEMA-CANONICAL`, `REQ-CORE-SCHEMA-DETECT`
- **Related ADRs**: `ADR-0001` (version dispatch), `ADR-0009` (Node-only runtime); umbrella `ADR-0002` (TypeScript monorepo)
- **Affected components**: `package.json`, `src/validate/version.ts`, `src/validate/schemas/` (removed), `test/fixtures/`

## Context

`rqml-core` began as a standalone repository and npm package. The RQML project
has since adopted a single TypeScript pnpm workspace (umbrella `ADR-0002`,
`DEC-MONOREPO`) housing the canonical schema, the engine, the CLI, the MCP
server, and the documentation site. The standalone library must move into that
workspace as `packages/core` and be consumed by the other packages and by the VS
Code extension, while the bundled XSDs it carried must collapse into the single
canonical `@rqml/schema` source (`REQ-SCHEMA-CANONICAL`).

## Decision drivers

- One workspace lets the schema, engine, CLI, and MCP server change atomically.
- The engine must stay dependency-clean so editors and agents can embed it
  (`REQ-CORE-DEPS`).
- There must be exactly one copy of each XSD; the library previously kept its own
  duplicate under `src/validate/schemas/` (`RISK-SCHEMA-COPY`).
- The VS Code extension consumes the library by its package name and entry-point
  shape; the move must not silently change that contract.

## Options considered

1. **Keep `rqml-core` as a separate repo, depend on it from the monorepo.**
   Preserves independence but reintroduces cross-repo coordination for every
   schema change and keeps the duplicate XSD problem. Rejected.
2. **Copy the sources in and keep the bundled XSD copies.** Simplest move, but
   leaves two schema sources that can drift. Rejected.
3. **Move the sources into `packages/core`, rename to `@rqml/core`, and source
   the schema from `@rqml/schema` (chosen).** The engine keeps its `.` and
   `./validate` entry points unchanged; `validate/version.ts` delegates schema
   resolution to `@rqml/schema`, whose text is bundled into the build so
   validation stays offline. The full-model fixture (`rqml-core.rqml`) and the
   shared example documents are re-homed under `test/fixtures/` and
   `packages/schema/examples/` respectively.

## Decision

Merge the library into the monorepo at `packages/core`, publish it as
`@rqml/core`, and remove its bundled XSD copies in favor of `@rqml/schema`.
Preserve the existing public surface: ESM output, named exports, and the two
entry points `.` (WASM-free) and `./validate` (lazy XSD engine). Version
detection now prefers the document's default namespace
(`xmlns="https://rqml.org/schema/<v>"`) and falls back to the `version`
attribute (`REQ-CORE-SCHEMA-DETECT`).

## Consequences

Positive: one schema source of truth; atomic cross-package changes; the engine
stays embeddable. The package rename (`rqml-core` → `@rqml/core`) is a breaking
change for consumers — handled for the VS Code extension by repointing its single
`services/core.ts` import chokepoint and its manifest dependency. Negative: the
standalone repository is retired, and its release history lives on only as a
provenance note (a clean copy was taken rather than a history graft).

## Supersession

None.
