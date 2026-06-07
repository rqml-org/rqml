# ADR-0003: The typed model is a vertical slice with verbatim raw-section passthrough

- **Status**: Superseded by ADR-0005
- **Date**: 2026-05-29
- **Classification**: `discretionary_design_choice`
- **Related requirements**: `REQ-MODEL-TYPES`, `REQ-ROUNDTRIP`, `REQ-PARSE`, `REQ-SERIALIZE`
- **Related ADRs**: `ADR-0001` (version dispatch)
- **Affected components**: `src/model/types.ts`, `src/parse/parse.ts`, `src/parse/serialize.ts`

## Context

The RQML schema is broad: meta, goals, requirements, catalogs, behavior,
verification, trace, and more. Fully typing every section would be a large,
schema-version-coupled surface to build and maintain, and most of the tooling
driving this library today (the editor's diagnostics, trace coverage) needs rich
types only for a few sections. At the same time, `REQ-ROUNDTRIP` requires that
parsing then serializing an unmodified document preserves content so a single
edit yields a minimal diff — the library must not silently drop the sections it
does not model.

## Decision drivers

- Deliver useful typed access for the sections tooling actually manipulates
  without waiting on a full schema model.
- Never lose document content on a parse → serialize round trip, even for
  sections the model does not understand.
- Keep the typed surface from hard-coupling the whole library to one schema
  version's element names.

## Options considered

1. **Model the entire schema up front.** Maximally typed, but a large build
   tightly coupled to a specific schema version, most of which is unused by
   current consumers. Rejected for now (revisited as the export work grows the
   model).
2. **Parse to a generic untyped tree (e.g. the raw XML object).** Trivially
   complete and version-agnostic, but gives consumers no typed model and pushes
   schema knowledge into every consumer. Rejected.
3. **Model a vertical slice, preserve the rest verbatim.** Type the sections in
   active use — `meta`, `requirements`, `trace` — and carry every other section
   through unmodified as raw data, re-emitted on serialize. Chosen.

## Decision

`parse()` builds typed nodes for `meta`, `requirements`, and `trace`
(`MODELED_SECTIONS`) and stashes all other sections verbatim, keyed off the
document via a `WeakMap` (`setRawSections`), so `serialize()` re-emits them
untouched. `parse()` itself is structurally version-agnostic, but the typed
model is coupled to `2.1.0` element names: notably `trace` is read from nested
`<edge>` elements, so a `2.0.1` document's flat `<traceEdge>` form does not
populate the typed `trace` model (its content still round-trips via raw
passthrough, and referential integrity for both forms is handled separately —
see `ADR-0004`).

## Consequences

**Positive**
- Tooling gets rich, typed access to the sections it manipulates today.
- Unmodeled sections survive a round trip, satisfying `REQ-ROUNDTRIP` and
  enabling safe in-place edits.
- The model can grow section by section without a big-bang rewrite.

**Negative**
- The typed model is incomplete; consumers needing goals/catalogs/behavior must
  reach into raw data until those sections are modeled.
- The typed `trace` model is `2.1.0`-shaped, so `2.0.1` documents expose an
  empty typed `trace` even though their data is preserved — a sharp edge for
  consumers that read the typed model without checking the document version.
- Raw passthrough via a `WeakMap` is invisible in the types; a consumer that
  rebuilds a document from scratch rather than mutating a parsed one will not
  carry the raw sections.

## Supersession

Superseded by `ADR-0005`, which models all eleven sections so fully-modeled
documents round-trip with an empty raw stash and exporters get typed access to
every section. Raw passthrough survives only as a narrowed forward-compat net
(unknown root attributes and unknown top-level elements).
