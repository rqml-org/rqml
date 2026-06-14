# ADR-0010: Scoped spec projection via additive options on the outline/markdown serializer

- Status: Accepted
- Date: 2026-06-14
- Classification: discretionary_design_choice
- Related requirements: REQ-CORE-PROJECTION, REQ-LOOP-OVERVIEW, REQ-HUMAN, REQ-MCP-PARITY
- Related ADRs: ADR-0006 (matrix surface companion); historical rqml-core ADR-0007 (document outline + markdown serializer)
- Affected components: core (markdown/outline options), cli (overview), mcp (overview tool)

## Context

`@rqml/core` already projects a document into a normalized outline
(`buildOutline`) and renders deterministic markdown (`outlineToMarkdown`,
`toMarkdown`) — but only for the whole document. The interactive read-surface we
want is "show me the spec, or the part of it I care about": the auth
requirements, the MCP package, a named set of ids. The whole-document render is
too coarse for an orienting view in an agent turn.

Single-artifact projection already exists (`extractArtifact` /`sliceToMarkdown`,
realizing REQ-LOOP-SHOW). What is missing is the middle scope: a filtered subset
of the outline.

## Decision drivers

- Readability of a *relevant slice* for humans and LLMs (QGOAL-HUMAN, REQ-HUMAN,
  GOAL-LLM-CONTEXT).
- Reuse the existing deterministic outline pipeline; do not add a second
  renderer.
- Do not break existing whole-document callers.
- Keep the renderer a renderer, not a query engine.
- Determinism: stable selection by id order.

## Options considered

### Option 1: A new, separate projection module
Build a parallel "projection" renderer for scoped views.

**Pros**
- Clean slate.

**Cons**
- Duplicates `buildOutline`/`outlineToMarkdown`; two renderers will drift.

### Option 2: Additive scoping options on the existing serializer (chosen)
Extend the outline/markdown projection with additive, defaulted options to
filter by section, package, or id-set, leaving the whole-document output exactly
as it is.

**Pros**
- One renderer; reuses the proven deterministic pipeline.
- Existing callers are untouched (options default to whole-document).

**Cons**
- Risk of options scope-creep toward a query engine (bounded below).

### Option 3: Filter after rendering, in each caller
Let the CLI/MCP/editor slice the rendered output.

**Pros**
- No core change.

**Cons**
- Every surface re-implements selection; non-deterministic, inconsistent
  boundaries; breaks parity.

## Decision

Adopt **Option 2**. Add additive, defaulted scoping options to the existing
outline/markdown projection — filter by section, package, or id-set — preserving
the current whole-document output (REQ-CORE-PROJECTION). The CLI `rqml overview`
and MCP `rqml_overview` expose it with scoping flags, returning equivalent
results (REQ-LOOP-OVERVIEW, REQ-MCP-PARITY). Filtering is limited to *selection*;
richer querying belongs to `extractArtifact` or a future query API, not to
markdown options.

## Consequences

### Positive
- Readable scoped overviews for agents and humans, with no new renderer.
- Existing whole-document callers and output are unchanged; deterministic.

### Negative
- The "selection only" boundary must be held to keep the renderer from becoming
  a query engine.
- Selection semantics depend on stable id ordering.

## Supersession

None
