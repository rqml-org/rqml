# ADR-0005: Standardize the five-stage RQML development process and the .rqml/adr + .rqml/plan conventions

- Status: Accepted
- Date: 2026-06-13
- Classification: discretionary_design_choice
- Related requirements: REQ-DESIGN-PROCESS, REQ-ADR-CONVENTION, REQ-PLAN-CONVENTION, REQ-AGENTS-TEMPLATE
- Related ADRs: ADR-0001
- Affected components: schema (AGENTS.md template), website (rqml.org docs), agent integrations (rqml-claude, rqml-codex)

## Context

RQML's spec-first loop was historically documented as
`Elicit → Specify → Implement → Verify → Trace` in the AGENTS.md template, the
quick-start, and the self-spec. That framing collapsed two distinct activities —
deciding the architecture and breaking the work into stages — into a single
"implement" step, and it gave design decisions no durable home.

In parallel, the RQML VS Code extension developed and documented a fuller
five-stage process — **Spec → Design → Plan → Code → Verify** — with two new
first-class artifacts: Architecture Decision Records in `.rqml/adr/` and a staged
implementation plan in `.rqml/plan.md`. The core engine already *used* this ADR
convention (the `@rqml/core` package keeps nine ADRs), but only referenced its
format via an external `rqml.dev/vscode/...` page; the process itself was not part
of the standard.

The two descriptions had drifted, and the more useful one lived downstream of the
standard rather than in it.

## Decision drivers

- The Design and Plan stages are exactly where a human should weigh in before code
  is written; hiding them inside "implement" is the wrong default.
- Design rationale decays fastest of all project knowledge; ADRs give it a durable,
  searchable, agent-readable home.
- The standard should own the canonical process and ADR format, with the editor and
  coding-agent integrations as consumers — not the other way around.
- The deterministic `rqml check` gate must keep a model out of the verdict path; its
  exit-code contract should not change.

## Options considered

### Option 1: Keep the four-stage loop
Leave `Elicit → Specify → Implement → Verify → Trace` as the documented process.
Pros: no work. Cons: perpetuates the drift from the VS Code docs, keeps Design and
Plan implicit, and leaves the ADR convention undocumented in the standard despite
core already relying on it.

### Option 2: Adopt the five stages as docs + plugin guidance (chosen)
Promote the five-stage process and the `.rqml/adr/` + `.rqml/plan.md` conventions
into the core standard: a canonical Development Process section on rqml.org, the
AGENTS.md template rewritten to teach it, the self-spec made normative
(REQ-DESIGN-PROCESS, REQ-ADR-CONVENTION, REQ-PLAN-CONVENTION). The deterministic
gate is unchanged; agent integrations (rqml-claude, rqml-codex, VS Code) add the
per-stage commands and anchor the process. Pros: one source of truth, no change to
the gate's contract, faithful to a process already proven downstream. Cons: Design
and Plan adherence is guided rather than gated.

### Option 3: Also make the gate ADR/plan-aware
Option 2 plus deterministic checks in `rqml check` (e.g. an approved ADR-worthy
decision must have a `.rqml/adr/` file). Pros: strongest enforcement, in CI too.
Cons: enlarges the gate's contract and surface; deferred to ISS-PROCESS-GATE until
the process has field experience.

## Decision

Adopt **Option 2**. The five-stage Spec → Design → Plan → Code → Verify process is
the standard RQML development process. Architecture decisions are recorded as ADRs
in `.rqml/adr/` following the canonical format; multi-stage implementation plans
live in `.rqml/plan.md`. The canonical definitions live on rqml.org
(`/docs/development-process` and `/docs/development-process/design`); the AGENTS.md
template and the self-spec are updated to match; and the deterministic check gate
is left unchanged. Deeper gate-level enforcement is recorded as a deferred question
(ISS-PROCESS-GATE).

## Consequences

Positive: the AGENTS.md template, rqml.org, and the downstream Claude Code and
Codex plugins now teach one process; the ADR convention is documented project-wide
and core's existing ADRs point at the canonical rqml.org page; Design and Plan are
explicit stages. Negative: without gate-level checks, ADR and plan adherence relies
on the agent integrations and review, not a reproducible verdict — acceptable while
the process settles, and revisitable via ISS-PROCESS-GATE.

## Supersession

None
