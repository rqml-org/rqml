# RQML Governance

This repository hosts the official RQML (Requirements Markup Language) schema and its official documentation.

## Scope

**In scope**
- The RQML schema (e.g., XSD and related normative artifacts) under `/rqml-schema`
- Official examples and conformance materials under `/rqml-schema`
- Official documentation site content under `/rqml-org`
- Versioning, releases, and compatibility policies for RQML

**Out of scope**
- Commercial or third-party tooling built on RQML (even if referenced in docs)
- Integrations, plugins, SaaS offerings, or proprietary extensions maintained outside this repo

## Principles

- **Open by default:** design discussions and decisions happen in public issues/PRs.
- **Compatibility first:** avoid breaking changes unless the benefits are overwhelming and clearly justified.
- **Interoperability:** the schema must support independent implementations and tools.
- **Clarity:** decisions are documented and discoverable.

## Roles

### Maintainers
Maintainers have write access to the repository and are responsible for:
- Reviewing and merging pull requests
- Managing releases and versioning
- Moderating community discussions (with support from the Code of Conduct)

Maintainers are listed in `MAINTAINERS.md` (or GitHub teams if preferred).

### Contributors
Anyone who participates via issues, discussions, documentation edits, or pull requests.

## Decision-making

We use **lazy consensus**:
- If there are no substantive objections after a reasonable review period, a change may proceed.
- When there is disagreement, maintainers seek a resolution via discussion and revision.

If consensus cannot be reached:
- Maintainers may call a **maintainer vote**.
- Simple majority decides.
- The outcome and rationale must be documented in the relevant issue/PR.

## Change process

### Documentation-only changes
Documentation improvements that do not change normative meaning can be merged via normal PR review.

### Normative changes (schema/spec behavior)
Changes that affect interoperability or meaning of RQML (including XSD structure, constraints, identifiers, semantics, or conformance expectations) MUST go through the RFC process:

1. Open an issue describing the problem and the proposed direction.
2. Submit an RFC PR under `/rfc/` using the template.
3. Discussion period:
   - Minor changes: ~7 days is usually sufficient.
   - Significant changes: ~14–21 days is recommended.
4. Maintainer decision recorded on the RFC PR (Accepted / Rejected / Deferred).
5. Implementation PR(s) follow, referencing the accepted RFC.

Maintainers may waive the RFC requirement for trivial fixes that clearly do not affect semantics (e.g., typos, comment improvements), but should err on the side of using an RFC.

## Versioning and compatibility

RQML uses semantic versioning principles:

- **PATCH**: clarifications, bug fixes, tightening constraints that do not break valid documents in practice (be conservative here).
- **MINOR**: backward-compatible additions (new optional elements/attributes, new catalogs, etc.).
- **MAJOR**: breaking changes (documents valid in the previous major may become invalid).

**Goal:** A document valid in RQML 2.x should remain valid in later 2.y releases.

Breaking changes require:
- Clear justification
- Migration guidance
- A major version bump

## Releases

- Releases are tagged in Git.
- Release notes summarize normative schema changes and notable documentation updates.
- Where practical, schema-only release assets are published (zip/tar containing `/rqml-schema` artifacts) to simplify consumption.

## Contribution policy

Contributions are welcome. By contributing, you agree that your contributions are licensed under the repository license (Apache-2.0).

We use the **Developer Certificate of Origin (DCO)**. See `CONTRIBUTING.md`.

## Code of Conduct

All participation is governed by `CODE_OF_CONDUCT.md`.

