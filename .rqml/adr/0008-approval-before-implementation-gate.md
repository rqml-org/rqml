# ADR-0008: Enforce approval-before-implementation with a deterministic PreToolUse hook over a core verdict

- Status: Accepted
- Date: 2026-06-14
- Classification: discretionary_design_choice
- Related requirements: REQ-CORE-APPROVAL-VERDICT, REQ-ENFORCE-APPROVAL-GATE, REQ-CORE-STATUS-AWARE, REQ-HOOK-PREIMPL (rqml-claude, rqml-codex)
- Related ADRs: ADR-0001 (spec-enforcement control loop), ADR-0003 (deterministic checking), ADR-0005 (five-stage process; ISS-PROCESS-GATE)
- Affected components: core (approval verdict), rqml-claude (hooks), rqml-codex (hooks)

## Context

Spec-first means only approved requirements drive implementation
(REQ-STATUS-ENUM). Today nothing enforces that until the end-of-session stop
gate runs `rqml check` — by which point the code against a draft requirement is
already written. ADR-0005 made Design and Plan explicit stages but deferred
gate-level process enforcement to the open question ISS-PROCESS-GATE.

We want an approval-before-implementation checkpoint that fires **at the moment
of the edit**, is deterministic (no language model in the verdict path), and is
portable across hosts. Note two starting facts: neither plugin registers a
`PreToolUse` hook today (only SessionStart, PostToolUse, Stop), and the
premature-implementation judgement already exists in the engine
(REQ-CORE-STATUS-AWARE flags an implements edge whose requirement is not
approved).

## Decision drivers

- Determinism; no model in the verdict path (ADR-0003, REQ-ENFORCE-DETERMINISM).
- Enforce at the change, not at session end.
- Reuse the existing premature-implementation logic rather than reinvent it.
- Host portability.
- Do not destabilize the stable `rqml check` exit-code contract.
- Fail open: a missing or hung toolchain must never brick the agent.

## Options considered

### Option 1: Advisory prose only (AGENTS.md)
Tell the agent, in the process contract, not to implement non-approved
requirements.

**Pros**
- Zero machinery.

**Cons**
- Puts the model in the loop — it decides whether to obey. Repeats the known
  weakness ADR-0005 called out. Not enforcement.

### Option 2: Deterministic PreToolUse plugin hook over a core verdict (chosen)
Expose the non-approved-implementation judgement as a reusable core verdict;
each plugin adds a `PreToolUse` hook that consults it and denies a code edit
that would implement a non-approved requirement, failing open.

**Pros**
- Deterministic check at the edit moment; the model is never in the verdict path.
- Editor, agent, and CI can share one engine verdict.
- Leaves the `rqml check` contract untouched.

**Cons**
- Net-new, not-yet-linked code escapes a trace-based gate (it has no implements
  edge yet) — that case remains governed by the stop gate, and must be stated
  plainly or the gate feels arbitrary.
- Requires a new hook event and per-host wiring.

### Option 3: Promote the verdict into `rqml check` now
Make the standard gate itself reject non-approved implementation.

**Pros**
- Strongest enforcement, in CI too.

**Cons**
- Enlarges the gate's contract and surface; `check` fires at session end, the
  wrong moment for this; premature before field experience. Deferred to
  ISS-PROCESS-GATE.

## Decision

Adopt **Option 2**, built so Option 3 is a later config flip rather than a
rewrite. Expose the non-approved-implementation judgement as a deterministic
core verdict (REQ-CORE-APPROVAL-VERDICT) built on REQ-CORE-STATUS-AWARE, offered
as an enforcement primitive (REQ-ENFORCE-APPROVAL-GATE). Each plugin adds a
`PreToolUse` hook (REQ-HOOK-PREIMPL) that denies edits to code linked to a
non-approved requirement, failing open. Codex degrades gracefully to the stop
gate plus the review skill where it has no pre-edit event. Promotion into
`rqml check` stays deferred to ISS-PROCESS-GATE.

## Consequences

### Positive
- Approval is enforced at the edit, deterministically, by one shared verdict.
- The stable check/CI contract is undisturbed.

### Negative
- The trace-based gate only bites code that already has an implements edge;
  first-write coverage stays with the stop gate (must be documented).
- Codex parity is parity-of-intent, not parity-of-mechanism, where its hook
  surface differs.

## Supersession

None
