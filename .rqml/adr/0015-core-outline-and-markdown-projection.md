# ADR-0015: Document outline and markdown serializer as a first-class core API

- Status: Accepted
- Date: 2026-06-17
- Classification: discretionary_design_choice
- Consolidates: historical rqml-core ADR-0007 (outline + markdown serializer)
- Related requirements: REQ-CORE-PROJECTION, REQ-LOOP-OVERVIEW, REQ-HUMAN, REQ-CORE-API
- Related ADRs: ADR-0014 (the full typed model this projects); ADR-0013 (lives in the WASM-free `.` entry); ADR-0010 (scoped projection — additive options layered on this serializer); ADR-0006 (traceability matrix — a sibling read-surface)
- Affected components: packages/core/src/export/outline.ts, src/export/markdown.ts, src/export/project.ts, src/trace/index.ts, src/index.ts

## Context

With the full typed model in place (ADR-0014), any consumer that wants a human-
or LLM-readable rendering of a document — the VS Code export pipeline first among
them — would otherwise have to walk all eleven sections, resolve trace edges, and
decide an ordering. Done per consumer, that logic drifts: two exporters would
disagree on which fields to show, how to title a cross-section reference, or how
to order sections. The traversal and resolution belong in the engine, once.

This decision is kept as its own record (rather than folded into ADR-0014)
because root ADR-0010 (scoped projection) builds on it by name and reuses
`buildOutline`/`outlineToMarkdown`/`toMarkdown`; preserving it as a distinct,
clearly-titled number keeps that load-bearing reference cleanly traceable.

## Decision drivers

- A single, reusable, deterministic projection every renderer can share, so
  output is consistent across consumers.
- Pure and dependency-light: no XML and no WASM, so it stays in the WASM-free `.`
  entry (ADR-0013) and runs anywhere.
- Resolved traceability: references carry the target's human title and a
  resolved/dangling flag, not just an id.

## Options considered

### Option 1: Let each consumer traverse the typed model
**Pros**
- No new core surface.

**Cons**
- Guarantees divergent renderings and re-implemented trace resolution. Rejected.

### Option 2: Ship a markdown string only
**Pros**
- Convenient for the one renderer that exists.

**Cons**
- Opaque — consumers wanting another format (slides, tables, a webview tree) get
  nothing reusable. Rejected.

### Option 3: Two layers — a normalized outline plus a renderer over it (chosen)
**Pros**
- The outline is a reusable, format-agnostic intermediate; markdown is one
  renderer; scoping (ADR-0010) layers on additively.

**Cons**
- A new public API to keep stable as the model evolves.

## Decision

`buildOutline(doc): DocumentOutline` produces a normalized, fully-typed,
stable-ordered traversal of every present section as `OutlineNode`s (`kind`,
`id?`, `title`, `fields[]`, `refs?`, `children?`). It resolves trace edges via
`resolveTrace`/`declaredIdIndex` so each element carries its outgoing references
with target titles and a `resolved` flag (a `collectTitles` pass supplies
cross-section reference titles). It is pure and deterministic — no XML, no WASM —
so it lives in the WASM-free `.` entry. `outlineToMarkdown(outline, opts?)` and
the `toMarkdown(doc, opts?)` convenience render deterministic markdown (section
headings, requirement blocks with statement + acceptance, a resolved trace
table), all exported from `.` alongside `declaredIdIndex` and `ElementRef`. Root
ADR-0010 later added `src/export/project.ts` (scoped projection) as additive
options over this same outline.

## Consequences

### Positive
- One shared, deterministic rendering path; consumers (e.g. the vscode export
  pipeline) consume the outline instead of re-deriving it.
- The outline is format-agnostic — markdown is the first renderer; others build
  on the same intermediate.
- Trace references render with titles and resolution state, raising output
  quality without per-consumer work.

### Negative
- A new public API to keep stable as the model evolves.
- Markdown output is currently flat-string prose (mirrors the model's
  string-typed `TextBlockType`); rich inline markup awaits the model follow-up.
- No `./export` subpath yet, so the outline ships in the main `.` entry rather
  than a separately tree-shakeable module — a documented follow-up.

## Supersession

Consolidates historical rqml-core ADR-0007 (preserved in git history). Root
ADR-0010 builds scoped projection on this decision.
