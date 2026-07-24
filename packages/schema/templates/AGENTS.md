# RQML Agent Guidelines

## Strictness: `standard`

| Level | Description |
|-------|-------------|
| `relaxed` | Prototyping. Spec is advisory. Quick iteration allowed. |
| `standard` | Production default. Spec-first for features. Core traces. |
| `strict` | Full traceability. All behavior specified. No ghost features. |
| `certified` | Regulated/safety-critical. Audit-grade traces with metadata. |

---

This project uses **RQML** as the single source of truth for system intent. Familiarize yourself with the documentation at https://rqml.org/docs/user-guide/ and the development process at https://rqml.org/docs/development-process/

**Specification file:** A spec lives in one `.rqml` file — by convention `requirements.rqml` — alongside its own `.rqml/` directory (which holds `adr/`, `plan.md`, and the drift baseline) in the directory it governs. That spec governs its directory and every subdirectory beneath it, **down to any nested spec that takes over its own subtree**; it never governs a parent directory. In a monorepo, give a project unit (package, app, service) its own spec where it needs distinct requirements; a file is then governed by the spec in its nearest enclosing directory (no inheritance or merging across that boundary). A directory holding several `*.rqml` files and no `requirements.rqml` is ambiguous — name one `requirements.rqml`. The toolchain resolves the governing spec automatically by walking up from the working directory, and `rqml check --workspace` runs the gate across every spec in the repository.

**Schema file:**
The current RQML XSD schema is at https://rqml.org/schema/rqml-2.2.0.xsd. Every version is published at `https://rqml.org/schema/rqml-<version>.xsd`, so use the one your spec's root `version` attribute declares — that URL is also its `xsi:schemaLocation`. Make sure to adhere to the schema at all times and follow guidelines in schema comments.

Use as much of the RQML tagset as the problem needs, and reach for an element when the writing shows the sign:

| The sign | Reach for |
|---|---|
| A number in an acceptance criterion that decides a boundary | `<rule>` + `<examples>` under `domain/businessRules` |
| A term you had to infer, used by more than one requirement | `<term>` under `catalogs/glossary` |
| A noun with states in its life — pending, active, expired | `<stateMachine>` under `behavior` |
| Two goals you can only serve at each other's expense | `<goalLink type="conflictsWith">` |
| A way the system could be misused, not just used | `<misuseCase>` under `scenarios` |
| **A SHALL, MUST, or threshold sitting in `<notes>`** | a `<req>`, `<rule>`, or `<qgoal>` metric — where `check`, `matrix`, and `impact` can see it |

These are triggers, not a checklist: never invent content to fill a section the problem does not raise.

---

## Toolchain

The spec-first loop is enforced by the `rqml` CLI (npm: `@rqml/cli`; the `@rqml/mcp` server exposes the same engine as agent tools):

```bash
rqml check                 # deterministic gate: validation + coverage + drift (exit 0 = pass)
rqml status                # re-anchor: spec, coverage, and drift state
rqml show <REQ-ID>         # one requirement: statement, acceptance criteria, trace neighborhood
rqml impact <ID>           # what is affected, transitively, if this artifact changes
rqml overview              # readable projection of the spec (--section/--id to scope)
rqml matrix                # traceability matrix: status, goals, code, tests, coverage gaps
rqml link <from> <to>      # record any trace edge + drift baseline (--type, default implements)
rqml approve <REQ-ID>      # transition a requirement's status (default approved)
rqml gate                  # block implementation of non-approved requirements
rqml skeleton <kind>       # schema-valid snippet: req | edge | testCase | stateMachine
rqml migrate               # rewrite a spec to the current schema version (--dry-run to preview)
```

`rqml link` records **every** trace type — `implements` and `verifiedBy` for code and
tests, but equally `satisfies`, `refines`, `mitigates`, `dependsOn`, and the rest. Never
hand-write trace edges: the CLI emits the correct serialization for your spec's schema
version and records the drift baseline in the same step. Add provenance with
`--notes`, `--confidence`, `--tags`, `--by`, and `--status`.

Run `rqml status` when you start a session to re-anchor on the spec. Run `rqml check` before finishing any task — it must exit 0.

Report what the findings name, not the state of the gate: the goal no requirement satisfies, the requirement with no verification edge, the linked file that changed after its edge was recorded. That last one is a **suspect link** — a prompt to re-read the file and either update the requirement it no longer matches or re-pin the baseline with `rqml link --refresh <edge-id>` — not a defect in itself.

---

## Core Principle: Spec-First Development

Code follows specification, not the reverse. If code and spec diverge, the spec is authoritative—update the code or negotiate a spec change with the developer.

RQML organizes work into a **five-stage process** (https://rqml.org/docs/development-process/). Each stage produces a durable artifact in version control; verification feeds back to the spec, so it is a loop:

| Stage | Task | Output |
|-------|------|--------|
| **Spec** | Capture intent as requirements | `requirements.rqml` |
| **Design** | Decide architecture, record decisions | ADRs in `.rqml/adr/` |
| **Plan** | Break work into agent-sized stages | `.rqml/plan.md` |
| **Code** | Implement specified behavior, keep traces current | code + tests |
| **Verify** | Prove coverage and catch drift | trace graph + `rqml check` |

Never skip ahead: do not implement behavior that is not specified, and do not make a significant architectural choice without recording it as an ADR.

---

## Workflow

The five stages carry the six requirements-engineering activities of ISO/IEC/IEEE 29148 — elicitation, analysis, specification, validation, verification, management. Name the one you are in: it tells you which part of the document is yours to write, and which finding appears if you skip it.

### 1. Spec — elicitation, analysis, specification
Ask clarifying questions until you understand the goal, scope, acceptance criteria, and constraints. Don't assume—capture assumptions as `<notes>` or `<issue>` elements. **Never implement unspecified behavior.** Update the `.rqml` file before coding:
- Capture the goal or scenario the work serves; a requirement that `satisfies` neither is an orphan, and coverage will say so
- Add a `<req>` with statement and acceptance criteria
- Set appropriate `type`, `priority`, and `status="draft"`
- Record what is in tension while you still know it — a `conflictsWith` goalLink, an `<obstacle>` and the requirement that `mitigates` it. No check will ever prompt you for this; analysis is the one activity the toolchain cannot chase you on.
- Get developer confirmation; only `status="approved"` requirements drive implementation. That approval is the validation step — a person agreeing these are the right requirements — and it is theirs to give.

### 2. Design — analysis, recorded
Before building, decide *how*. Record each significant architectural decision as an **Architecture Decision Record (ADR)** in `.rqml/adr/`, following the canonical format (https://rqml.org/docs/development-process/design): `NNNN-kebab-case-slug.md`, with Status, Classification, Context, Options considered, Decision, and Consequences. A decision is ADR-worthy when there are real alternatives or the choice constrains future work; skip ADRs for low-level implementation details. ADRs are immutable once accepted—supersede, don't edit.

### 3. Plan
Break approved requirements into a staged implementation plan at `.rqml/plan.md`, framed for coding agents: each stage names its goal, the requirement IDs it addresses, the files it touches, and how to verify it.

### 4. Code (Implement) — implementation and traceability
Read the requirement first: `rqml show REQ-XXX`. Run impact analysis before changing anything that already exists: `rqml impact REQ-XXX`. Honor the ADRs. If you discover missing requirements, stop and add them to the spec first. After implementing, record the trace link:

```bash
rqml link REQ-XXX src/path/to/implementation.ts
```

### 5. Verify — verification and drift
Add tests that reference requirement IDs, then record verification and re-run the check:

```bash
rqml link REQ-XXX test/path/to/test.ts --type verifiedBy
rqml check   # must exit 0 before you are done
```

---

## When Code and Spec Diverge

1. **Spec gap** (code has behavior not in spec): Propose adding the requirement, mark as `status="review"`
2. **Code bug** (code doesn't match spec): Fix the code
3. **Spec bug** (spec is wrong): Propose correction, wait for developer confirmation

**Never silently change the spec to match code.**

---

## Strictness Reference

| Aspect | relaxed | standard | strict | certified |
|--------|---------|----------|--------|-----------|
| Spec (elicitation) | Major features | Testable reqs | Edge cases | Formal |
| Spec-first | Recommended | Required | Required | Approved first |
| Design (ADRs) | Optional | Significant choices | All architectural choices | With approval |
| Plan | Optional | For multi-stage work | Required | Required |
| Code traces | Optional | New features | All changes | With metadata |
| Verify (test traces) | Optional | New reqs | All reqs | Full matrix |
| Ghost features | Allowed | Blocked | Blocked | Blocked |

---

## Change Summary Template

For PRs and commits:

```
## RQML Trace Summary

**Requirements:** REQ-xxx (added/modified/implemented)
**Design:** ADR-xxxx — decision recorded (if any)
**Implementation:** `path/to/file` — what changed
**Verification:** `path/to/test` — what it verifies
**Open items:** gaps, assumptions, follow-ups
```

---

## Schema Validation

The `.rqml` file must remain valid XML conforming to the version of RQML referenced in the version attribute in the spec document.

**To validate:** Use the toolchain — it validates offline against the bundled schema and also checks referential integrity the XSD alone cannot enforce:
```bash
rqml validate
```

This is **document** validation: schema conformance and referential integrity. It is not requirements *validation* in the ISO/IEC/IEEE 29148 sense — whether these are the right requirements at all — which is recorded when a person approves them. Report that the document is valid, that requirements are approved, that requirements are verified by tests; never report "requirements validated" on the strength of a passing check.

If the `rqml` CLI is not installed, `npx @rqml/cli validate` works without installation. As a last resort, xmllint (pre-installed on macOS/Linux) checks XSD validity only:
```bash
xmllint --schema https://rqml.org/schema/rqml-2.2.0.xsd <rqml-file-name> --noout
```

Substitute the version your spec declares. If it declares an older one, `rqml migrate`
rewrites it to the current schema version (`--dry-run` previews the change first).

**IDE validation:** If the `.rqml` file includes `xsi:schemaLocation`, XML-aware editors (VS Code with XML extension, IntelliJ) validate automatically.

The schema comments contain detailed guidance on document structure, ID conventions, and requirement quality criteria.

**If unsure:** Ask the developer before making structural changes to the spec.
