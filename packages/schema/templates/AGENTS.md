# RQML Agent Guidelines

## Strictness: `standard`

| Level | Description |
|-------|-------------|
| `relaxed` | Prototyping. Spec is advisory. Quick iteration allowed. |
| `standard` | Production default. Spec-first for features. Core traces. |
| `strict` | Full traceability. All behavior specified. No ghost features. |
| `certified` | Regulated/safety-critical. Audit-grade traces with metadata. |

---

This project uses **RQML** as the single source of truth for system intent. Familiarize yourself with the documentation at https://rqml.org/docs/user-guide/

**Specification file:** Specification lives in a single .rqml file in the root of the project - convention is `requirements.rqml`. Multiple .rqml files may be employed in multirepo projects, in such cases a .rqml spec applies to everything that is higher in the project tree, unless overridden by another .rqml file.

**Schema file:**
The RQML XSD schema is at https://rqml.org/schema/rqml-2.1.0.xsd (insert correct version number). Make sure to adhere to the schema at all times and follow guidelines in schema comments. Use as much of the RQML tagset as is necessary to capture and describe high quality requirements.

---

## Toolchain

The spec-first loop is enforced by the `rqml` CLI (npm: `@rqml/cli`; the `@rqml/mcp` server exposes the same engine as agent tools):

```bash
rqml check                 # deterministic gate: validation + coverage + drift (exit 0 = pass)
rqml status                # re-anchor: spec, coverage, and drift state
rqml show <REQ-ID>         # one requirement: statement, acceptance criteria, trace neighborhood
rqml impact <ID>           # what is affected, transitively, if this artifact changes
rqml link <REQ-ID> <path>  # record an implements edge + drift baseline (--type verifiedBy for tests)
rqml skeleton <kind>       # schema-valid snippet: req | edge | testCase | stateMachine
```

Run `rqml status` when you start a session to re-anchor on the spec. Run `rqml check` before finishing any task — it must exit 0.

---

## Core Principle: Spec-First Development

```
[Elicit] → [Specify] → [Implement] → [Verify] → [Trace]
    ↑____________________←______________________|
```

Code follows specification, not the reverse. If code and spec diverge, the spec is authoritative—update the code or negotiate a spec change with the developer.

---

## Workflow

### 1. Elicit
Ask clarifying questions until you understand the goal, scope, acceptance criteria, and constraints. Don't assume—capture assumptions as `<notes>` or `<issue>` elements.

### 2. Specify
**Never implement unspecified behavior.** Update the `.rqml` file before coding:
- Add a `<req>` with statement and acceptance criteria
- Set appropriate `type`, `priority`, and `status="draft"`
- Get developer confirmation before proceeding

### 3. Implement
Read the requirement first: `rqml show REQ-XXX`. Check blast radius before changing existing artifacts: `rqml impact REQ-XXX`. If you discover missing requirements, stop and add them to the spec first. After implementing, record the trace link:

```bash
rqml link REQ-XXX src/path/to/implementation.ts
```

### 4. Verify
Add tests that reference requirement IDs, then record verification:

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
| Elicitation | Major features | Testable reqs | Edge cases | Formal |
| Spec-first | Recommended | Required | Required | Approved first |
| Code traces | Optional | New features | All changes | With metadata |
| Test traces | Optional | New reqs | All reqs | Full matrix |
| Ghost features | Allowed | Blocked | Blocked | Blocked |

---

## Change Summary Template

For PRs and commits:

```
## RQML Trace Summary

**Requirements:** REQ-xxx (added/modified/implemented)
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

If the `rqml` CLI is not installed, `npx @rqml/cli validate` works without installation. As a last resort, xmllint (pre-installed on macOS/Linux) checks XSD validity only:
```bash
xmllint --schema https://rqml.org/schema/rqml-2.1.0.xsd <rqml-file-name> --noout
```

**IDE validation:** If the `.rqml` file includes `xsi:schemaLocation`, XML-aware editors (VS Code with XML extension, IntelliJ) validate automatically.

The schema comments contain detailed guidance on document structure, ID conventions, and requirement quality criteria.

**If unsure:** Ask the developer before making structural changes to the spec.
