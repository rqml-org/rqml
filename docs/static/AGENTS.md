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

**Specification file:** Specification lives in a single .rqml file in the root of the project - convention is `requirements.rqml`

**Schema file:**
The RQML XSD schema is at https://rqml.org/schema/rqml-2.0.1.xsd. Make sure to adhere to the schema at all times and follow guidelines in schema comments. Use as much of the RQML tagset as is necessary to capture and describe high quality requirements.

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
Reference requirement IDs in code comments. If you discover missing requirements, stop and add them to the spec first.

### 4. Verify
Add tests that reference requirement IDs. Update `<trace>` section with verification links.

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

**To validate:** Try xmllint first (pre-installed on macOS/Linux):
```bash
xmllint --schema https://rqml.org/schema/rqml-2.0.1.xsd requirements.rqml --noout
```

If xmllint is unavailable, use Python with lxml:
```bash
pip install lxml
python -c "from lxml import etree; s=etree.XMLSchema(etree.parse('https://rqml.org/schema/rqml-2.0.1.xsd')); print('Valid' if s.validate(etree.parse('requirements.rqml')) else s.error_log)"
```

**IDE validation:** If the `.rqml` file includes `xsi:schemaLocation`, XML-aware editors (VS Code with XML extension, IntelliJ) validate automatically.

The schema comments contain detailed guidance on document structure, ID conventions, and requirement quality criteria.

**If unsure:** Ask the developer before making structural changes to the spec.
