# ADR-0006: Version-aware trace — normalize 2.0.1 flat and 2.1.0 nested edges into one model

- **Status**: Accepted
- **Date**: 2026-05-29
- **Classification**: `discretionary_design_choice`
- **Related requirements**: `REQ-MODEL-TYPES`, `REQ-ROUNDTRIP`, `REQ-PARSE`, `REQ-SERIALIZE`
- **Related ADRs**: `ADR-0005` (full model), `ADR-0001` (version dispatch)
- **Affected components**: `src/parse/parse.ts`, `src/parse/serialize.ts`, `src/model/types.ts`

## Context

RQML has expressed trace links two ways. In `2.0.1` they are flat
`<traceEdge from="…" to="…" fromUri="…" toUri="…"/>` elements; in `2.1.0` they
are nested `<edge><from><locator><local|doc|external/></locator></from>…</edge>`
with typed endpoints. `ADR-0003` modeled only the nested `2.1.0` form, so a
`2.0.1` document exposed an empty typed `trace` (its content survived only via
raw passthrough). Now that the full model is the goal (`ADR-0005`), trace must be
first-class for both versions, and `REQ-ROUNDTRIP` must hold per version — a
document declared `2.0.1` must serialize back to the flat form.

## Decision drivers

- One typed `trace` model that consumers read without branching on version.
- `REQ-ROUNDTRIP` per version: `2.0.1` in → `2.0.1` out (flat); `2.1.0` in →
  `2.1.0` out (nested).
- The generalized trace index and outline (`ADR-0007`) should not care which
  on-the-wire form produced an edge.

## Options considered

1. **Model only `2.1.0`; passthrough `2.0.1`.** The `ADR-0003` status quo —
   leaves the typed trace empty for legacy docs. Rejected.
2. **Two parallel trace models, one per version.** Faithful but forces every
   consumer to branch and doubles the surface. Rejected.
3. **Normalize both forms into one `TraceEdge[]` on parse; pick the emit form by
   `doc.version` on serialize.** Chosen.

## Decision

`parseTrace(root, version)` reads whichever of `trace.edge` (nested) or
`trace.traceEdge` (flat) is present and normalizes both into `TraceEdge[]` with
typed `Locator`s: flat `from`/`to` → `local`, `fromUri`/`toUri` → `external`.
New edge attributes (`status`, `createdBy`, `createdAt`, `tags` split on
whitespace) are read into the model, and the `2.0.1` actor `<goals><ref ref/>`
is captured as `Actor.goalRefs`. `serialize.ts` selects the emit form by
`doc.version`: `2.0.1` writes flat `<traceEdge>` under the `2.0.1` namespace;
otherwise it writes nested `<edge>`. The namespace/schemaLocation is chosen from
a version-keyed table rather than a single default.

## Consequences

**Positive**
- One typed `trace` for all versions; `resolveTrace`, `declaredElements`, and the
  outline are version-agnostic.
- `REQ-ROUNDTRIP` holds per version, including the legacy flat form and the
  `2.0.1` actor goal refs.

**Negative**
- The flat `2.0.1` form cannot fully represent a `doc` locator's `git`/`version`,
  so down-converting a rich `doc` endpoint to `2.0.1` is lossy — accepted within
  `2.0.1`, with a serialize-time warning left as a documented follow-up.
- Serialize now branches on version; the version-keyed namespace table must be
  kept in step with new schema releases.

## Supersession

None. This ADR is current.
