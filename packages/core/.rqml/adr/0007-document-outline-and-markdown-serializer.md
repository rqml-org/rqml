# ADR-0007: A document-outline and markdown serializer as a first-class core API

- **Status**: Accepted
- **Date**: 2026-05-29
- **Classification**: `discretionary_design_choice`
- **Related requirements**: `REQ-MODEL-TYPES`, `REQ-TYPED-API`
- **Related ADRs**: `ADR-0005` (full model), `ADR-0002` (validation behind a lazy entry)
- **Affected components**: `src/export/outline.ts`, `src/export/markdown.ts`, `src/trace/index.ts`, `src/index.ts`

## Context

With the full model in place (`ADR-0005`), consumers that want a human- or
LLM-readable rendering of a document — the extension's export pipeline first
among them — would each have to walk all eleven sections, resolve trace edges,
and decide an ordering. Done per-consumer that logic drifts: two exporters would
disagree on which fields to show, how to title a cross-section reference, or how
to order sections. The traversal and resolution belong in the engine, once.

## Decision drivers

- A single, reusable, deterministic projection of a document that every renderer
  can share, so output is consistent across consumers.
- Pure and dependency-light: no XML and no WASM, so it stays in the WASM-free
  `.` entry and can run anywhere (`ADR-0002` keeps validation separate).
- Resolved traceability: references should carry the target's human title and a
  resolved/dangling flag, not just an id.

## Options considered

1. **Let each consumer traverse the typed model.** No new core surface, but
   guarantees divergent renderings and re-implemented trace resolution. Rejected.
2. **Ship a markdown string only.** Convenient but opaque — consumers wanting a
   different format (slides, tables, a webview tree) get nothing reusable.
   Rejected.
3. **Two layers: a normalized `DocumentOutline` plus a markdown renderer over
   it.** The outline is the reusable intermediate; markdown is one renderer.
   Chosen.

## Decision

`buildOutline(doc): DocumentOutline` produces a normalized, fully-typed,
stable-ordered traversal of every present section as `OutlineNode`s
(`kind`, `id?`, `title`, `fields[]`, `refs?`, `children?`). It resolves trace
edges via `resolveTrace`/`declaredIdIndex` so each element carries its outgoing
references with target titles and a `resolved` flag, and a `collectTitles` pass
gives cross-section references human-readable titles. It is pure and
deterministic — no XML, no WASM. `outlineToMarkdown(outline, opts?)` and the
`toMarkdown(doc, opts?)` convenience render deterministic markdown (section
headings, requirement blocks with statement + acceptance, a resolved trace
table). All of this is exported from the `.` entry alongside `declaredIdIndex`
and `ElementRef`.

## Consequences

**Positive**
- One shared, deterministic rendering path; consumers (e.g. the vscode export
  pipeline, see rqml-vscode `ADR-0004`) consume the outline instead of
  re-deriving it.
- The outline is format-agnostic: markdown is the first renderer, others can be
  built on the same intermediate.
- Trace references render with titles and resolution state, raising output
  quality without per-consumer work.

**Negative**
- A new public API to keep stable as the model evolves.
- Markdown output is currently flat-string prose (mirrors the model's
  string-typed `TextBlockType`); rich inline markup awaits the model follow-up.
- No `./export` subpath yet, so the outline ships in the main `.` entry rather
  than a separately tree-shakeable module — a documented follow-up.

## Supersession

None. This ADR is current.
