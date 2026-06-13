---
sidebar_position: 2
title: Design — ADRs
description: The RQML Design stage — Architecture Decision Records (ADRs) stored in .rqml/adr/, their format, classification model, and lifecycle.
---

# Design — Architecture Decision Records

The **Design** stage decides *how* a system will be built. Its output is a set of
**Architecture Decision Records (ADRs)** — short, durable documents that capture a
single significant design decision: the context that motivated it, the options
considered, and the rationale for the choice. ADRs are stored in **`.rqml/adr/`**
alongside the spec.

This page is the canonical RQML ADR format. The RQML toolchain and agent
integrations follow it, and so does the RQML project itself.

## Why ADRs

Design decisions are the hardest things to reconstruct after the fact. Code shows
*what* was built and tests show *what works*, but neither explains *why this
approach was chosen over the alternatives*. Without a record, that rationale lives
in chat threads and memory and decays quickly.

ADRs fit RQML naturally. The spec captures *what* the system should do; ADRs
capture *how* it should be built and why. Together with the [plan](./plan.md) and
the trace graph they form a complete, durable chain of reasoning — and they make
the Design stage explicit, so teams (and agents) stop jumping from requirements
straight to code and skipping the deliberate evaluation of alternatives that
prevents costly rework.

ADRs are especially valuable with LLM coding agents: an agent with access to your
ADRs understands not just *what* to build (from the spec) but *how* (from the
decisions), which keeps generated code consistent with your intent across sessions.

## Where ADRs live

ADRs are stored in `.rqml/adr/`, beside the spec:

```
project/
├── requirements.rqml
└── .rqml/
    └── adr/
        ├── 0001-auth-strategy.md
        ├── 0002-api-versioning.md
        └── 0003-database-choice.md
```

In a monorepo, each spec has its own `.rqml/adr/` directory co-located with it,
so a package's decisions travel with its requirements.

### Naming convention

Filenames use a zero-padded four-digit number followed by a kebab-case slug:

```
NNNN-kebab-case-slug.md
```

Examples: `0001-auth-strategy.md`, `0002-api-versioning.md`,
`0003-monorepo-handling.md`. Numbers are sequential and monotonically increasing;
the next number is the highest existing number plus one.

## ADR template

Every ADR follows this template:

```markdown
# ADR-0001: Short decision title

- Status: Accepted
- Date: 2026-04-02
- Classification: discretionary_design_choice
- Related requirements: REQ-AUTH-001, REQ-AUTH-003
- Related ADRs: None
- Affected components: auth service, middleware

## Context
Why this decision is needed.

## Decision drivers
The main forces behind the decision.

## Options considered

### Option 1: JWT tokens
Description, pros, and cons.

### Option 2: Session cookies
Description, pros, and cons.

## Decision
The chosen option and why.

## Consequences
Positive and negative consequences of the decision.

## Supersession
None (or reference to the superseded/superseding ADR)
```

## Classification model

Every design issue is classified into exactly one of four categories. Only the
first three are ADR-worthy:

| Classification | Meaning | Creates ADR? |
|---|---|---|
| `required_by_spec` | Directly mandated by RQML or spec rules | Yes |
| `derived_from_requirements` | Effectively forced by requirements or constraints | Yes |
| `discretionary_design_choice` | A real design choice with multiple viable alternatives | Yes |
| `implementation_detail` | Too low-level for architectural significance | No |

The classification is recorded in the ADR's metadata block.

### When is a decision ADR-worthy?

A decision warrants an ADR when at least some of these are true:

- there are multiple plausible options;
- the choice affects architecture, workflow, or system behaviour;
- the choice is likely to matter later or constrains future work;
- the choice affects more than one component;
- the choice is not already trivially mandated by existing rules.

If a topic is not ADR-worthy, reason about it as needed but do not create an ADR.

## ADR lifecycle

ADRs support five statuses:

| Status | Meaning |
|---|---|
| **Proposed** | Drafted but not yet finalized. |
| **Accepted** | Decision made and in effect. |
| **Superseded** | Replaced by a newer ADR. |
| **Deprecated** | No longer relevant but preserved for history. |
| **Rejected** | Considered but not adopted. |

An ADR is **immutable once accepted**. When a decision is revisited, do **not**
edit the existing ADR — write a new one that supersedes it, mark the old one
`Superseded by ADR-NNNN`, and reference the old one from the new one's
**Supersession** section. History is preserved; ADRs are never deleted.

## ADRs and the `<decision>` element

The RQML schema also has a [`<decision>`](../reference/elements/catalogs.md)
element in `<catalogs>`. The two are complementary:

- A **`<decision>`** in the spec is the *agent-readable summary* — a compact,
  machine-traceable record that other artifacts can reference with trace edges.
- An **ADR** in `.rqml/adr/` is the *long-form context* — drivers, options, and
  consequences in prose.

Significant decisions can carry both: a `<decision>` for traceability and an ADR
for the full reasoning, cross-referenced by id (e.g. `DEC-LAZY-WASM` ↔ `ADR-0002`).
Not every ADR needs a matching `<decision>`, and not every `<decision>` needs an
ADR — record what each decision's weight warrants.

## Driving the Design stage

The ADR format above is the standard. RQML agent integrations add a guided
command to produce and maintain ADRs that follow it — for example a `/design`
command in the [VS Code extension](https://marketplace.visualstudio.com/items?itemName=rqml.rqml-vscode)
and the [Claude Code](https://github.com/rqml-org/rqml-claude) and
[Codex](https://github.com/rqml-org/rqml-codex) plugins, which classify the
decision, weigh options, and write the ADR into `.rqml/adr/` when it is
ADR-worthy.

Next: [Stage 3 — the implementation plan](./plan.md).
