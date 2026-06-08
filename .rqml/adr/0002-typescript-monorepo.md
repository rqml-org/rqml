# ADR-0002: Build the reference toolchain as a TypeScript monorepo

- Status: Proposed
- Date: 2026-06-07
- Classification: discretionary_design_choice
- Related requirements: REQ-TS-ENGINE, REQ-WORKSPACE, REQ-PACKAGE-LAYOUT, REQ-CORE-DEPS, REQ-SCHEMA-CANONICAL, REQ-SCHEMA-URLS, REQ-VERSION-DECOUPLE
- Related ADRs: ADR-0003
- Affected components: core, cli, mcp, schema, docs

## Context

The rqml repository holds the schema and the documentation site. We are adding a reference implementation — a validation/trace engine, a CLI, and an MCP server — that must evolve with the schema while remaining independently consumable (the engine is embedded by the VS Code extension and future agent integrations). We must choose an implementation language and a repository structure.

## Decision drivers

- The VS Code extension is already TypeScript; one language avoids maintaining a second engine.
- The deterministic analysis the engine needs (XML/XSD validation, multi-language ASTs) is well served in the Node ecosystem (TypeScript compiler API, tree-sitter, a WASM build of xmllint).
- Schema, engine, CLI, and MCP change together; cross-repo coordination is costly.
- The engine must stay embeddable without dragging in CLI or MCP dependencies.
- The published schema URLs are an immutable contract for documents already in the wild.

## Options considered

### Option 1: Polyrepo (one repo per component)
Pros: independent release cadence per component. Cons: schema changes ripple across repos; heavy version coordination; the tight engine/extension coupling is awkward across repo boundaries.

### Option 2: Single bundled package
Pros: simplest possible setup. Cons: every consumer of the engine inherits CLI and MCP dependencies; a single version line couples unrelated changes.

### Option 3: TypeScript pnpm monorepo (chosen)
One workspace containing `packages/{core, cli, mcp}` plus a canonical schema package, with the Docusaurus site as an app. Pros: atomic cross-cutting changes; one engine reused everywhere; `core` kept dependency-clean. Cons: workspace tooling overhead. (Python was considered for the engine and rejected: it would split the language from the TypeScript extension and force every consumer through the CLI boundary, with no offsetting benefit given the available TS analysis tooling.)

## Decision

Build the toolchain in TypeScript on Node as a single pnpm workspace. Publishable packages are `@rqml/core` (the dependency-clean engine), the `rqml` CLI, and `@rqml/mcp`. The canonical XSDs live in a schema package that is the single source consumed by the engine, bundled for offline validation, and published by the docs site to the stable `rqml.org/schema/<version>/` URLs; the RQML spec version is versioned independently of the npm package versions. `@rqml/core` must not depend on CLI argument-parsing or the MCP SDK so editors and agent integrations can embed it cleanly, and the CLI's stable JSON-and-exit-code contract acts as the language firewall for any non-TypeScript consumer.

## Consequences

Positive: one source of truth and atomic changes; one engine behind every surface; the schema cannot drift across copies and the published-URL contract is generated rather than hand-maintained; engine patches do not perturb the language version. Negative: workspace tooling (pnpm, TypeScript project references, Changesets) to set up and maintain; ongoing discipline required to keep `core` dependency-clean.

## Supersession

None
