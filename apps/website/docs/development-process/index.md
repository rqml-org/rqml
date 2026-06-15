---
sidebar_position: 1
title: Development Process
description: The five-stage RQML development process — Spec, Design, Plan, Code, Verify — and the artifacts each stage produces.
---

# Development Process

RQML defines a **five-stage development process** that keeps requirements,
design, planning, code, and verification in sync. Each stage produces a concrete
artifact, and every artifact lives in version control beside the spec, so the
*why* and *how* of a system are as durable as the code itself.

![The RQML development process](/img/screenshots/RQML-development-process.png)

| Stage | Task | Output |
|---|---|---|
| **Spec** | Document your intent in a detailed requirements specification | `requirements.rqml` |
| **Design** | Decide system architecture and document the decisions | ADRs in [`.rqml/adr/`](./design.md) |
| **Plan** | Break the work into a multi-stage implementation plan for coding agents | [`.rqml/plan.md`](./plan.md) |
| **Code** | Implement the requirements, keeping spec and code in sync | Working code and tests |
| **Verify** | Confirm code, tests, and design satisfy the spec and stay traceable | Trace graph in the `.rqml` document |

The process is a loop, not a one-way street: verification feeds back into the
spec, and new requirements re-enter at the top. The spec stays authoritative
throughout — if code and spec diverge, you update the code or negotiate a spec
change, never silently rewrite the spec to match the code.

## The `.rqml/` directory

Each stage's artifact lives alongside the spec:

```
project/
├── requirements.rqml              ← the spec (Stage 1: Spec)
├── .rqml/
│   ├── adr/                       ← architecture decision records (Stage 2: Design)
│   │   ├── 0001-auth-strategy.md
│   │   ├── 0002-api-versioning.md
│   │   └── 0003-database-choice.md
│   ├── plan.md                    ← the implementation plan (Stage 3: Plan)
│   └── baseline.json              ← drift baseline written by `rqml link`
└── src/                           ← code and tests (Stage 4: Code)
```

In monorepo setups, each spec gets its own `.rqml/` directory, co-located with
that spec file, so a package's design and plan travel with its requirements.

## The chain of reasoning

The five artifacts form one continuous, traceable chain:

1. **Requirements** (`requirements.rqml`) define the problem and acceptance criteria.
2. **ADRs** (`.rqml/adr/`) record the architectural choices made to satisfy them, and why.
3. **The plan** (`.rqml/plan.md`) breaks those choices into implementable stages.
4. **Code** implements the plan, traceable back to requirements and design decisions.
5. **Trace edges** (in the `.rqml` document) link code and tests to requirements, so
   `rqml check` can prove coverage and catch drift.

Code shows *what* was built and tests show *what works*, but only the spec and
the ADRs explain *why this, and not the alternatives*. Keeping all five in the
repository means that reasoning never decays into Slack threads and memory.

## Driving each stage

The process is tool-agnostic — the artifacts and their locations are the
standard; how you produce them is up to your tooling. Two layers help:

- **The deterministic toolchain.** The [`rqml` CLI](../tooling/cli.md) and the
  [`@rqml/mcp`](../tooling/mcp.md) server serve the middle of the loop — `rqml
  overview` / `rqml matrix` to survey the spec and its coverage, `rqml show` to
  read one requirement, `rqml impact` to assess blast radius, `rqml approve` to
  accept a requirement before it drives code, `rqml link` to record a trace edge
  and its drift baseline, `rqml gate` to block implementation of a non-approved
  requirement, and `rqml check` as the gate. No language model sits in any verdict.
- **RQML agent integrations.** Editor and coding-agent integrations add guided,
  per-stage commands on top of those primitives — for example the
  [VS Code extension](https://marketplace.visualstudio.com/items?itemName=rqml.rqml-vscode)
  and the [Claude Code](https://github.com/rqml-org/rqml-claude) and
  [Codex](https://github.com/rqml-org/rqml-codex) plugins provide commands to
  elicit a spec, record a design decision as an ADR, draft the plan, implement a
  stage, and run the gate. A well-behaved integration nudges you toward the next
  stage: ask to implement a feature that isn't specified, and it routes you back
  to Spec first.

## Enforcement and strictness

How strictly the process is enforced scales with the project's declared
strictness level (set in `AGENTS.md`; the gate reads it):

| Strictness | Behaviour |
|---|---|
| `relaxed` | Suggests the process but allows shortcuts. |
| `standard` | Requires spec-first for features; core traces required. |
| `strict` | Full traceability; all behaviour must be specified. |
| `certified` | Audit-grade; formal approval expected at each stage. |

The deterministic gate (`rqml check`) enforces what it can compute — validation,
trace coverage, and implementation drift. Design and Plan adherence is guided by
your agent integration rather than gated by a model, keeping every blocking
verdict reproducible.

Next: [Stage 2 — Design and ADRs](./design.md) · [Stage 3 — the implementation plan](./plan.md).
