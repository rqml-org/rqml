# ADR-0014: Full eleven-section typed model with version-aware parse/serialize round-trip

- Status: Accepted
- Date: 2026-06-17
- Classification: discretionary_design_choice
- Consolidates: historical rqml-core ADR-0005 (full schema model), ADR-0006 (version-aware trace); folds the superseded ADR-0003 (vertical-slice model) as its prior step
- Related requirements: REQ-CORE-PARSE, REQ-CORE-TRACE-GRAPH, REQ-BACKWARD-COMPAT
- Related ADRs: ADR-0013 (the WASM-free `.` entry this model lives in); ADR-0015 (the outline/markdown projection built on this model); ADR-0004 §2 (retains serialize/round-trip as core capabilities pending re-trace into the root spec)
- Affected components: packages/core/src/model/types.ts, src/parse/parse.ts, src/parse/serialize.ts, src/parse/raw.ts

## Context

This record consolidates the `@rqml/core` parse / typed-model / serialize layer.
The standalone library first typed only the sections early tooling manipulated —
`meta`, `requirements`, `trace` — and carried the other eight sections through
verbatim as opaque raw data (the superseded vertical-slice model). That was right
while consumers needed only diagnostics and trace coverage; it stopped being
right once an exporter became a priority, since a renderer can only show what the
model exposes — statements, acceptance criteria, goals, scenarios, state
machines, APIs, and tests all lived in unmodeled sections.

Trace itself has had two on-the-wire forms: flat `<traceEdge from to fromUri
toUri/>` in 2.0.1, and nested `<edge><from><locator>…` with typed endpoints in
2.1.0. The vertical-slice model typed only the nested form, so a 2.0.1 document
exposed an empty typed `trace`. With a full model the goal, trace must be
first-class for both versions, and round-trip must hold per version (2.0.1 in →
2.0.1 out). Serialize/round-trip are retained `@rqml/core` capabilities recorded
by root ADR-0004 §2 (carried over from the former `core.rqml` `REQ-SERIALIZE` /
`REQ-ROUNDTRIP`, pending re-trace into the root spec as requirements).

## Decision drivers

- Export quality: downstream tooling (outline/markdown, reports) must read every
  section's real content, not a handful of flat fields.
- Round-trip fidelity per version: parse → serialize → parse preserves model
  equality; a fully-modeled document leaves **no** raw passthrough.
- One typed `trace` model that consumers read without branching on version.
- Honest optionals: absent sections serialize as absent (`?`-typed, never
  materialized as `undefined`) so round-trip equality is exact.

## Options considered

### Option 1: Keep the vertical slice; let exporters read raw data
**Pros**
- No model growth.

**Cons**
- Pushes XML/schema knowledge into every exporter and forfeits typed access; just
  relocates the problem. Rejected.

### Option 2: Model only what the first report needs / two parallel trace models
**Pros**
- Smaller immediate change.

**Cons**
- Every new report or version reopens the model and forces consumers to branch;
  the slice/version boundary becomes a recurring tax. Rejected.

### Option 3: Model the full schema; normalize both trace forms into one (chosen)
**Pros**
- Typed access to the whole document; one version-agnostic trace model;
  round-trip holds per version.

**Cons**
- A larger typed surface coupled to the 2.1.0 vocabulary.

## Decision

`src/model/types.ts` types all eleven sections (`meta`, `catalogs`, `domain`,
`goals`, `scenarios`, `requirements`, `behavior`, `interfaces`, `verification`,
`trace`, `governance`), optional sections `?`-typed on `RqmlDocument` and omitted
when absent. `parse.ts` populates each section; `serialize.ts` emits every
present/non-empty section in canonical order. Raw passthrough is narrowed to a
forward-compat net of **unknown root attributes and unknown top-level elements**
only. `declaredElements(doc)` enumerates every id-bearing element, driving the
generalized trace index.

`parseTrace(root, version)` reads whichever of `trace.edge` (nested) or
`trace.traceEdge` (flat) is present and normalizes both into one `TraceEdge[]`
with typed `Locator`s (flat `from`/`to` → `local`, `fromUri`/`toUri` →
`external`); new edge attributes (`status`, `createdBy`, `createdAt`, `tags`) and
the 2.0.1 actor `<goals><ref>` (`Actor.goalRefs`) are read in. `serialize.ts`
selects the emit form and namespace/`schemaLocation` from a version-keyed table
by `doc.version`: 2.0.1 emits flat under the 2.0.1 namespace, otherwise nested.

## Consequences

### Positive
- Exporters and any consumer get typed access to the whole document; export
  fidelity is bounded by the renderer, not the model.
- Fully-modeled documents round-trip with an **empty** raw stash — a stronger,
  easier-to-test round-trip property.
- One typed `trace` for all versions; `resolveTrace`, `declaredElements`, and the
  outline (ADR-0015) are version-agnostic, and round-trip holds per version.

### Negative
- A larger typed surface coupled to the 2.1.0 element vocabulary: schema changes
  touch types, parse, and serialize together.
- Down-converting a rich `doc` locator to flat 2.0.1 cannot represent
  `git`/`version` — accepted-lossy within 2.0.1, with a serialize-time warning a
  documented follow-up.
- Mixed-content prose (`TextBlockType`) is still a plain `string`; rich inline
  markup is a follow-up. Per-element unknown attr/child preservation inside known
  sections is not implemented (forward-compat is root-granular).

## Supersession

Consolidates historical rqml-core ADR-0005 (full model) and ADR-0006
(version-aware trace), and carries forward the ADR-0005-over-ADR-0003
supersession: the vertical-slice model (ADR-0003) is folded in only as the prior
step, not as a live decision. Originals preserved in git history.
