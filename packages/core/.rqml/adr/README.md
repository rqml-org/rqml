# Architecture Decision Records

This directory captures the major architecture and design decisions for the
`@rqml/core` engine. It originated in the standalone `rqml-core` repository
(ADR-0001 through ADR-0007) and was re-homed here, verbatim, when the library was
merged into the RQML monorepo as `packages/core` (see ADR-0008). Each ADR is
short, immutable once accepted, and follows the
RQML development-process design format
(https://rqml.org/docs/development-process/design): a metadata block
(Status, Date, Classification, Related requirements, Related ADRs, Affected
components) followed by Context, Decision drivers, Options considered, Decision,
Consequences, and Supersession.

When a decision is revisited, do not edit the existing ADR — write a new one
that supersedes it, and mark the older one `Superseded by ADR-NNNN`.

## Index

| # | Title | Classification | Status |
|---|-------|----------------|--------|
| [0001](0001-validate-by-dispatching-on-document-version.md) | Validate by dispatching on the document's declared version | derived_from_requirements | Accepted |
| [0002](0002-validation-behind-a-lazy-separate-entry.md) | Validation lives behind a separate, lazily loaded entry point | derived_from_requirements | Accepted |
| [0003](0003-typed-model-is-a-vertical-slice-with-raw-passthrough.md) | The typed model is a vertical slice with verbatim raw-section passthrough | discretionary_design_choice | Superseded by ADR-0005 |
| [0004](0004-referential-integrity-in-code-not-xsd.md) | Enforce referential integrity in code, not via XSD identity constraints | discretionary_design_choice | Accepted |
| [0005](0005-model-the-full-rqml-schema.md) | Model the full RQML schema (all eleven sections) | discretionary_design_choice | Accepted |
| [0006](0006-version-aware-trace-parse-serialize.md) | Version-aware trace — normalize 2.0.1 flat and 2.1.0 nested edges into one model | discretionary_design_choice | Accepted |
| [0007](0007-document-outline-and-markdown-serializer.md) | A document-outline and markdown serializer as a first-class core API | discretionary_design_choice | Accepted |
| [0008](0008-merge-into-rqml-monorepo-as-rqml-core.md) | Merge rqml-core into the RQML monorepo as `@rqml/core` | discretionary_design_choice | Accepted |
| [0009](0009-narrow-core-to-node-only-runtime.md) | Narrow `@rqml/core` to a Node-only runtime | discretionary_design_choice | Accepted |

## Cross-reference

Some decisions are also captured as `<decision>` elements in `../core.rqml`
(the re-homed package spec, formerly `rqml-core.rqml`) under
`<catalogs><decisions>` (e.g. `DEC-LAZY-WASM` ↔ ADR-0002). The `core.rqml` form is
the agent-readable summary; this directory holds the long-form context. ADR-0001,
ADR-0003, and ADR-0004 record decisions made while building out validation, the
model, and referential integrity that do not yet have a matching `<decision>`
element. ADR-0009 supersedes the browser-facing intent of `core.rqml`'s
isomorphism items (`REQ-ISOMORPHIC`, `SCN-WEB`, `QGOAL-BUNDLE-SIZE`); read those
as historical.
