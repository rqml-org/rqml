---
id: quick-start
title: Quick-start
sidebar_label: Quick start
sidebar_position: 2
---

# Quick start

- Create a file "requirements.rqml" in the root of your project
- Copy the following scaffold into your requirements.rqml:
```xml
<rqml xmlns="https://rqml.org/schema/2.0.1" version="2.0.1" docId="DOC-HELLO-001" status="draft">
  <meta>
    <title>...</title>
    <system>...</system>
  </meta>
  <requirements>
    <req id="..." type="FR" title="Print greeting" status="draft" priority="must">
      <statement>...</statement>
    </req>
  </requirements>
</rqml>
```
- Tell your LLM of choice that the requirements specification for your project is in requirements.rqml - you can do this through your prompt and/or in AGENTS.md (see below for example AGENTS.md entry)
- Write your requirements in the RQML file, with help of an LLM if you want.
- Ask your LLM to implement the requirements
- Test and repeat.

# Example AGENTS.md

Copy this template to `AGENTS.md` in your project root. Adjust the **Strictness** level to match your project needs.

`````markdown
# RQML Agent Guidelines

**Strictness: `standard`**

<!--
Strictness levels:
- relaxed:   Prototyping mode. Spec is advisory. Ask before major features, but quick iteration allowed.
- standard:  Production default. Spec-first for features. Update spec before implementing. Maintain core traces.
- strict:    Full traceability. All behavior must be specified. No ghost features. Complete trace graph.
- certified: Regulated/safety-critical. Audit-grade traces with metadata. Formal verification alignment.
-->

This project uses **RQML** as the single source of truth for system intent. The specification lives in `requirements.rqml`.

---

## Core Principle: Spec-First Development

```
[Elicit] → [Specify] → [Implement] → [Verify] → [Trace]
    ↑____________________←______________________|
```

Code follows specification, not the reverse. If code and spec diverge, the spec is authoritative—update the code or negotiate a spec change with the developer.

---

## Phase 1: Elicit Before You Specify

When the developer requests a feature or change:

1. **Ask clarifying questions** until you understand:
   - The *goal* (why does this matter?)
   - The *scope* (what's in, what's out?)
   - The *acceptance criteria* (how do we know it's done?)
   - The *constraints* (performance, security, compatibility)

2. **Stop eliciting when** the requirement is:
   - **Necessary** — traces to a goal or stakeholder need
   - **Unambiguous** — one reasonable interpretation
   - **Testable** — clear pass/fail criteria exist
   - **Feasible** — can be implemented within constraints

3. **Don't assume.** If something is unclear, ask. Capture assumptions as `<notes>` or `<issue>` elements if you must proceed.

### Strictness behavior:
| Level | Elicitation depth |
|-------|-------------------|
| relaxed | Ask about major features only |
| standard | Ask until requirements are testable |
| strict | Ask until all edge cases are covered |
| certified | Formal elicitation with documented rationale |

---

## Phase 2: Specify Before You Code

**Never implement unspecified behavior.**

Before writing code for any feature or significant change:

1. **Update `requirements.rqml`** with:
   - A requirement (`<req>`) with clear statement and acceptance criteria
   - Appropriate `type` (FR, NFR, SR, etc.), `priority`, and `status="draft"`
   - Link to parent goal if applicable (via `refs` or trace edge)

2. **Get developer confirmation** on the spec change before proceeding to implementation.

3. **For bug fixes:** Check if the bug reveals a missing or unclear requirement. If so, add or clarify the requirement first.

### Requirement quality checklist:
- [ ] Statement uses "shall" for mandatory behavior
- [ ] Acceptance criteria are specific and measurable
- [ ] No implementation details in the requirement (what, not how)
- [ ] Traceable to a goal or stakeholder need

### Strictness behavior:
| Level | Spec requirements |
|-------|-------------------|
| relaxed | Recommend spec updates; proceed if developer agrees |
| standard | Require spec update before feature implementation |
| strict | Require spec update before any behavioral change |
| certified | Require spec approval (status=approved) before implementation |

---

## Phase 3: Implement with Traceability

When implementing:

1. **Reference requirement IDs** in code comments at key locations:
   ```typescript
   // Implements REQ-AUTH-001: User authentication via OAuth
   ```

2. **Keep the mapping minimal but complete:**
   - Every requirement should have at least one implementation reference
   - Every significant code module should trace to at least one requirement

3. **If you discover missing requirements** during implementation:
   - Stop and add the requirement to the spec
   - Get confirmation before continuing

### Strictness behavior:
| Level | Implementation traces |
|-------|----------------------|
| relaxed | Encouraged but not required |
| standard | Required for new features |
| strict | Required for all changes; update `<trace>` section |
| certified | Full trace edges with metadata (createdBy, createdAt, status) |

---

## Phase 4: Verify and Update Traces

After implementation:

1. **Add or update tests** that verify the requirement:
   - Reference the requirement ID in test names/descriptions
   - Ensure acceptance criteria are covered

2. **Update `<trace>` section** with verification links:
   ```xml
   <traceEdge id="TR-xxx" from="TC-AUTH-001" to="REQ-AUTH-001" type="verifiedBy"/>
   ```

3. **For strict/certified:** Add implementation traces:
   ```xml
   <traceEdge id="TR-xxx" fromUri="file:src/auth/oauth.ts#L42-L87" to="REQ-AUTH-001" type="implements"/>
   ```

### Strictness behavior:
| Level | Verification requirements |
|-------|--------------------------|
| relaxed | Tests recommended |
| standard | Tests required for new requirements |
| strict | Tests required; trace edges mandatory |
| certified | Full verification matrix; all traces approved |

---

## Keeping the Spec Minimal

The spec should be **as small as possible, but no smaller**.

**Include:**
- Behavior that matters to stakeholders
- Constraints that affect implementation choices
- Quality attributes with measurable targets
- Risks and their mitigations

**Exclude:**
- Implementation details (unless they're constraints)
- Obvious behavior (e.g., "system shall not crash")
- Redundant requirements that follow from others
- Temporary workarounds (use `<issue>` instead)

**Consolidate aggressively:**
- One well-written requirement beats five vague ones
- Use refinement (`refines` traces) rather than duplication
- Archive deprecated requirements; don't delete history

---

## Sync Protocol: When Code and Spec Diverge

If you discover code that doesn't match the spec:

1. **Identify the discrepancy** — is it a spec gap or a code bug?

2. **For spec gaps** (code has behavior not in spec):
   - Propose adding the requirement to the spec
   - Mark as `status="review"` until developer confirms
   - Add trace to existing code

3. **For code bugs** (code doesn't match spec):
   - Fix the code to match the spec
   - Add/update tests to prevent regression

4. **For spec bugs** (spec is wrong):
   - Propose spec correction to developer
   - Wait for confirmation before changing code

**Never silently change the spec to match code.** Always get developer confirmation.

---

## Summary Templates

### Change Summary (for PRs/commits)
```
## RQML Trace Summary

**Requirements:**
- REQ-xxx: <title> (added/modified/implemented)

**Implementation:**
- `path/to/file.ext` — <what changed>

**Verification:**
- `path/to/test.ext` — <what it verifies>

**Traces added:**
- TR-xxx: REQ-xxx → TC-xxx (verifiedBy)

**Open items:**
- <any gaps, assumptions, or follow-ups>
```

### Elicitation Questions Template
```
Before I can specify this requirement, I need to understand:

1. **Goal:** What problem does this solve? Why does it matter?
2. **Scope:** What's included? What's explicitly excluded?
3. **Acceptance:** How will we know it's working correctly?
4. **Constraints:** Any performance, security, or compatibility requirements?
5. **Edge cases:** What happens when <unusual situation>?
```

---

## Quick Reference: Strictness Comparison

| Aspect | relaxed | standard | strict | certified |
|--------|---------|----------|--------|-----------|
| Elicitation | Major features | Testable reqs | Edge cases | Formal |
| Spec-first | Recommended | Required | Required | Approved first |
| Code traces | Optional | New features | All changes | With metadata |
| Test traces | Optional | New reqs | All reqs | Full matrix |
| Ghost features | Allowed | Blocked | Blocked | Blocked |
| Trace section | Optional | Recommended | Required | Audited |

---

## Files

- **Specification:** `requirements.rqml`
- **Schema:** Validates against RQML 2.0.1
- **Tests:** `tests/` or `verification/`
`````
