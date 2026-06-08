# ADR-0003: Compute spec-to-code checks deterministically

- Status: Proposed
- Date: 2026-06-07
- Classification: discretionary_design_choice
- Related requirements: REQ-CORE-VALIDATE, REQ-CORE-COVERAGE, REQ-CORE-DRIFT, REQ-CORE-NO-LLM, REQ-ENFORCE-DETERMINISM, REQ-ENFORCE-CODE-TRACE, REQ-ENFORCE-AUTHOR-SPLIT
- Related ADRs: ADR-0001, ADR-0002
- Affected components: core

## Context

The current VS Code tooling compares the spec to the code using a language model. ADR-0001 makes `rqml check` the enforcement gate, and a gate must return the same verdict every time to be trustworthy and auditable. A nondeterministic, network-dependent, per-call-costly model comparison cannot serve as that gate.

## Decision drivers

- A gate must be reproducible (same input yields the same verdict) and auditable.
- It must be fast and offline enough to run on every save, every agent turn, and in CI.
- Most of what a check needs (integrity, coverage, link resolution) is deterministic; only semantic fidelity is irreducibly fuzzy.

## Options considered

### Option 1: Model-based comparison (status quo)
Pros: tolerates implicit links; flexible. Cons: nondeterministic, unauditable, slow, costly per call; unfit as a gate.

### Option 2: Deterministic engine with explicit traceability (chosen)
Validation, coverage, and drift are computed from the document and an explicit trace graph. Implementation links are declared as `implements` edges with external locators (file/symbol/test), so drift becomes a filesystem, AST, and graph computation rather than an inference. Pros: reproducible, offline, fast, auditable. Cons: requires projects to maintain explicit code-to-requirement links.

## Decision

Make validation, coverage, and drift detection fully deterministic in `@rqml/core`, with no language model in the verdict path. Spec-to-code linkage is explicit — `implements` trace edges with external locators — which the engine resolves to detect missing or changed artifacts. Language-model assistance is confined to authoring and proposing RQML content and links: the model proposes, the toolchain disposes. Optional semantic-fidelity checking may run as a separate, pluggable pass over a pre-filtered worklist, but is never part of the gate.

## Consequences

Positive: trustworthy, reproducible gates and audit trails; fast offline checks; the engine carries no model dependency. Negative: projects must maintain explicit implementation links to get drift detection (mitigated by agent-assisted authoring), and a convention is needed to flag new code that lacks a requirement link. This approach replaces the model-comparison method in the prior VS Code tooling, which was never recorded as an ADR.

## Supersession

None
