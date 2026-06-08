# ADR-0001: Validate by dispatching on the document's declared version

- **Status**: Accepted
- **Date**: 2026-05-29
- **Classification**: `derived_from_requirements`
- **Related requirements**: `REQ-XSD-VALIDATE`, `REQ-VERSION-DISPATCH`, `REQ-BUNDLE-SCHEMAS`, `REQ-OFFLINE`
- **Related ADRs**: `ADR-0002` (lazy validation entry), `ADR-0004` (integrity in code)
- **Affected components**: `src/validate/version.ts`, `src/validate/index.ts`, `src/validate/schemas/`

## Context

RQML documents in the wild declare different schema versions. Today two are
supported — `2.0.1` and `2.1.0` — and the canonical schema is expected to keep
evolving (a structurally different `3.0.0` is plausible). A `.rqml` file carries
its own version in the root `rqml@version` attribute, and validating a `2.0.1`
document against the `2.1.0` schema produces false results in both directions.

`REQ-VERSION-DISPATCH` requires the library to read `rqml@version` and validate
against the matching schema, with an explicit override accepted to force a
specific version. `REQ-OFFLINE` and `REQ-BUNDLE-SCHEMAS` require validation to
work with no network access for any version covered by a bundled schema.

## Decision drivers

- A document must be judged against the schema it actually targets, not a
  single "current" schema.
- Old documents must keep validating correctly indefinitely as new versions are
  added — adding `3.0.0` must not change how a `2.0.1` document is judged.
- An unknown or future version must degrade gracefully, never crash a caller
  (the editor runs `validate()` on every debounced keystroke).
- Validation must be offline-safe.

## Options considered

1. **Single "latest" schema for all documents.** Simplest, but wrong: it
   misvalidates older documents and forces every document to track the newest
   schema. Rejected.
2. **Fetch the matching schema from rqml.org at validation time.** Always
   correct against the canonical source, but violates `REQ-OFFLINE`, adds
   latency to a keystroke-frequency code path, and makes validation fail when
   offline. Rejected.
3. **Bundle every supported schema and dispatch on the document's declared
   version.** Each version maps to a self-contained, bundled XSD; `validate()`
   reads `rqml@version` (or an explicit override), looks up the matching schema,
   and validates against it. Versions share no logic, so a new version is purely
   additive. Chosen.

## Decision

`validate()` resolves the schema version in this order: an explicit caller
override, then the document's own `rqml@version` (via `extractDocumentVersion`),
then `DEFAULT_SCHEMA_VERSION`. `schemaFor(version)` returns the bundled,
self-contained XSD for that version; the `.xsd` files are inlined as text at
build time so they ship in the package and load with no I/O. An unsupported
version yields a normalized diagnostic naming the supported versions rather than
throwing. Each bundled XSD pins its own `version` with `fixed=`, so a document
cannot claim a version whose schema it does not actually match.

Because each version is a separate, frozen schema, documents validate against
their pinned schema indefinitely; adding a future version (e.g. `3.0.0`) is an
additive change that leaves `2.0.1` and `2.1.0` handling untouched.

## Consequences

**Positive**
- Every document is judged against the schema it targets; mixed-version
  workspaces validate correctly.
- New schema versions are additive — no migration of existing handling.
- Offline-safe and fast enough for keystroke-frequency validation.
- Unknown versions surface as actionable diagnostics, not exceptions.

**Negative**
- Bundled schemas can drift from the canonical schemas at rqml.org; mitigated by
  a release check that each bundled XSD is byte-equal to its canonical source
  (`REQ-PROVENANCE`).
- Every supported version's schema ships in the package, growing bundle size as
  versions accumulate.
- `parse()` and the typed model are not version-dispatched the way validation
  is (see `ADR-0003`); only structural validation is fully version-aware today.

## Supersession

None. This ADR is current.
