# ADR-0004: Reconcile core requirements after the rqml-core merge

- Status: Proposed
- Date: 2026-06-07
- Classification: derived_from_requirements
- Related requirements: REQ-CORE-VALIDATE, REQ-CORE-SCHEMA-DETECT, REQ-VALIDATABLE, REQ-CORE-DEPS, REQ-SCHEMA-CANONICAL
- Related ADRs: ADR-0002 (TypeScript monorepo — owns the rqml-core merge, formerly historical core ADR-0008); ADR-0013 (Node-only runtime + entry split — consolidates historical core ADR-0009); ADR-0014 (typed model + serialize/round-trip); ADR-0015 (outline/markdown). The historical rqml-core integrity-in-code decision (core ADR-0004) is restated in §1 below.
- Affected components: core, schema

## Context

The umbrella `requirements.rqml` specified the reference toolchain top-down before
the `rqml-core` library was merged in. The merge (now owned by ADR-0002) brings a
mature implementation whose behavior and prior spec (the former `core.rqml`, since
removed) do not line up cleanly
with the umbrella requirements in three places. This ADR records how the gap is
reconciled so neither document silently contradicts the shipped engine.

## Decision drivers

- The shipped engine is the ground truth; the requirements must describe it
  honestly rather than aspirationally.
- The project's process forbids editing accepted ADRs and prefers superseding
  records; the same discipline is applied to reconciling the requirements.
- Capabilities that already exist and have value must not become unspecified
  "ghost features" under strict enforcement.

## Options considered

1. Rewrite the umbrella self-spec in place to match the engine. Rejected:
   high-churn edits to a large, schema-valid document, and it discards the
   intent history.
2. Leave both specs untouched and let them drift. Rejected: the contradictions
   below would mislead agents generating from the spec.
3. Record the reconciliation as this ADR plus targeted spec follow-ups (chosen).

## Decision

Reconcile the three gaps as follows.

1. **Referential integrity is enforced in code, not purely by the XSD.**
   `REQ-VALIDATABLE` / `QGOAL-VALIDATABLE` / `BR-UNIQUE-ID` / `BR-TRACE-INTEGRITY`
   state that id-uniqueness and trace resolution are enforced "purely by XSD
   validation." Given the known XSD namespace/keyref limitation (the rqml-core
   integrity-in-code decision, now consolidated into this ADR), `@rqml/core`
   enforces these in code via `checkIntegrity`.
   `REQ-CORE-VALIDATE`'s phrase "equivalently to the schema's own constraints" is
   the authoritative reading: the engine reproduces those guarantees in code, and
   the XSD-only claims should be amended to "enforced by validation (XSD plus the
   engine's integrity pass)."

2. **Serialize, round-trip, lint, and outline/markdown export are retained
   capabilities of `@rqml/core`** beyond the requirements `PKG-CORE` enumerates.
   They came from the former `core.rqml` (`REQ-SERIALIZE`, `REQ-ROUNDTRIP`,
   `REQ-LINT`, `REQ-STRICTNESS`) and the rqml-core ADRs, and are preserved as
   architecture decisions: serialize/round-trip in ADR-0014, the outline/markdown
   serializer in ADR-0015. With `core.rqml` now removed, all four must be
   re-traced into the umbrella spec **as requirements** rather than left implicit
   — lint and strictness especially, which have no architecture-record successor.
   Tracked as a governance follow-up.

3. **The toolchain runtime is Node-only and the schema is a canonical package.**
   ADR-0013 records the Node-18+-only runtime (consolidating historical core
   ADR-0009), superseding the former `core.rqml`'s isomorphism items.
   `REQ-SCHEMA-CANONICAL` is realized by `@rqml/schema` as the single source; the
   former `core.rqml`'s "bundle schemas inside the library" decision is
   satisfied by inlining `@rqml/schema` into the core build, not by a private copy.

## Consequences

The umbrella requirements and the now-removed `core.rqml` capabilities now have a
single, written reconciliation.
Follow-up spec edits (amending the XSD-only validatability wording and adding
satisfies/verifiedBy edges for the retained capabilities) are tracked as governance
items rather than blocking the merge. The schema-provenance requirement
(`REQ-PROVENANCE`) is superseded by single-source plus a byte-equality test in
`@rqml/schema`.

## Supersession

None.
