# ADR-0005: Model the full RQML schema (all eleven sections)

- **Status**: Accepted
- **Date**: 2026-05-29
- **Classification**: `discretionary_design_choice`
- **Related requirements**: `REQ-MODEL-TYPES`, `REQ-ROUNDTRIP`, `REQ-PARSE`, `REQ-SERIALIZE`
- **Related ADRs**: Supersedes `ADR-0003` (vertical-slice model); `ADR-0006` (version-aware trace), `ADR-0007` (outline serializer)
- **Affected components**: `src/model/types.ts`, `src/parse/parse.ts`, `src/parse/serialize.ts`

## Context

`ADR-0003` typed only the sections the early tooling manipulated — `meta`,
`requirements`, `trace` — and carried the other eight sections through verbatim
as opaque raw data. That was the right call while consumers only needed
diagnostics and trace coverage. It stopped being the right call once the
extension's "Export Spec" feature became a priority: an exporter can only render
what the model exposes, so statements, rationale, acceptance criteria, goals,
scenarios, state machines, APIs, and tests — all living in unmodeled sections —
could never reach a report. The export quality ceiling was set by the model's
coverage, not by the exporter.

## Decision drivers

- Export quality and flexibility: downstream tooling (markdown/outline, reports)
  must be able to read every section's real content, not just six flat fields.
- `REQ-ROUNDTRIP` still holds: parse → serialize → parse must preserve model
  equality, and a fully-modeled document should leave **no** raw passthrough.
- Keep `noUncheckedIndexedAccess` honest: optional fields are `?`-typed and
  omitted (never set to `undefined`) so round-trip equality is exact.

## Options considered

1. **Keep the vertical slice; let exporters read raw data.** No model growth,
   but pushes XML/schema knowledge into every exporter and forfeits typed access.
   Rejected — it just relocates the problem `ADR-0003` accepted.
2. **Model only the sections the first report needs.** Smaller change, but every
   new report type would reopen the model; the slice boundary becomes a
   recurring tax. Rejected.
3. **Model the entire schema now.** Type all eleven sections, populate them on
   parse, emit them on serialize, and shrink raw passthrough to a forward-compat
   safety net. Chosen.

## Decision

`src/model/types.ts` types all eleven sections (`meta`, `catalogs`, `domain`,
`goals`, `scenarios`, `requirements`, `behavior`, `interfaces`, `verification`,
`trace`, `governance`), with optional sections `?`-typed on `RqmlDocument` so an
absent section serializes as absent. `parse.ts` populates each section
(`boolAttr` parses `attr/@required` to a real boolean; `state/@type` is omitted
when absent so the XSD default `normal` is never materialized). `serialize.ts`
emits every present/non-empty section in canonical order. With the full set
modeled, raw passthrough keeps only **unknown root attributes and unknown
top-level elements** — a forward-compat net for schema additions, not a parking
lot for known sections. `declaredElements(doc)` enumerates every id-bearing
element across all sections, which drives the generalized trace index
(`ADR-0006` covers trace; `ADR-0007` covers the outline built on top).

## Consequences

**Positive**
- Exporters and any consumer get typed access to the whole document; export
  fidelity is now bounded by the renderer, not the model.
- Fully-modeled documents round-trip with an **empty** raw stash, a stronger and
  easier-to-test form of `REQ-ROUNDTRIP`.
- The "sharp edge" from `ADR-0003` — a `2.1.0`-only typed `trace` — is removed;
  trace is now version-aware (`ADR-0006`).

**Negative**
- A larger typed surface coupled to the `2.1.0` element vocabulary; schema
  changes touch types, parse, and serialize together.
- Mixed-content prose (`TextBlockType`) is still modeled as a plain `string`;
  inline markup fidelity remains a documented follow-up.
- Per-element unknown attribute/child preservation inside *known* sections is not
  implemented; forward-compat is whole-section/whole-attr granular at the root.

## Supersession

None. This ADR is current and supersedes `ADR-0003`.
