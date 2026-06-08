# ADR-0004: Reconcile core requirements after the rqml-core merge

- Status: Proposed
- Date: 2026-06-07
- Classification: derived_from_requirements
- Related requirements: REQ-CORE-VALIDATE, REQ-CORE-SCHEMA-DETECT, REQ-VALIDATABLE, REQ-CORE-DEPS, REQ-SCHEMA-CANONICAL
- Related ADRs: ADR-0002 (TypeScript monorepo); core ADR-0004 (integrity in code), core ADR-0008 (merge), core ADR-0009 (Node-only)
- Affected components: core, schema

## Context

The umbrella `requirements.rqml` specified the reference toolchain top-down before
the `rqml-core` library was merged in. The merge (core ADR-0008) brings a mature
implementation whose behavior and prior spec (`core.rqml`) do not line up cleanly
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
   validation." Per core ADR-0004 (and the known XSD namespace/keyref
   limitation), `@rqml/core` enforces these in code via `checkIntegrity`.
   `REQ-CORE-VALIDATE`'s phrase "equivalently to the schema's own constraints" is
   the authoritative reading: the engine reproduces those guarantees in code, and
   the XSD-only claims should be amended to "enforced by validation (XSD plus the
   engine's integrity pass)."

2. **Serialize, round-trip, lint, and outline/markdown export are retained
   capabilities of `@rqml/core`** beyond the requirements `PKG-CORE` enumerates.
   They came from `core.rqml` (`REQ-SERIALIZE`, `REQ-ROUNDTRIP`, `REQ-LINT`,
   `REQ-STRICTNESS`, core ADR-0007) and are preserved. They are to be re-traced
   into the umbrella spec rather than dropped; until then they are specified by
   `core.rqml`, not ghost features.

3. **The toolchain runtime is Node-only and the schema is a canonical package.**
   Core ADR-0009 narrows the engine to Node 18+, superseding `core.rqml`'s
   isomorphism items. `REQ-SCHEMA-CANONICAL` is realized by `@rqml/schema` as the
   single source; `core.rqml`'s "bundle schemas inside the library" decision is
   satisfied by inlining `@rqml/schema` into the core build, not by a private copy.

## Consequences

The umbrella requirements and `core.rqml` now have a single, written reconciliation.
Follow-up spec edits (amending the XSD-only validatability wording and adding
satisfies/verifiedBy edges for the retained capabilities) are tracked as governance
items rather than blocking the merge. The schema-provenance requirement
(`REQ-PROVENANCE`) is superseded by single-source plus a byte-equality test in
`@rqml/schema`.

## Supersession

None.
