---
sidebar_position: 3
title: Plan — the implementation plan
description: The RQML Plan stage — a staged implementation plan stored at .rqml/plan.md, framed for AI coding agents.
---

# Plan — the implementation plan

The **Plan** stage breaks the work into actionable steps. Its output is a staged
implementation plan stored at **`.rqml/plan.md`** — a markdown document structured
for AI coding agents, with each stage framed as a self-contained task.

```
project/
├── requirements.rqml
└── .rqml/
    ├── adr/
    └── plan.md  ← the plan
```

## Framed for coding agents

Unlike a traditional project plan that estimates human time in days or weeks, an
RQML plan is written for **coding agents**. Each stage describes:

- **Goal** — what this stage accomplishes;
- **Input requirements** — which spec requirements (by id) the stage addresses;
- **Files to create or modify** — concrete paths;
- **Acceptance criteria** — how to verify the stage is complete;
- **Verification commands** — the tests, build, or lint commands to run;
- **Trace expectations** — which trace edges should be added once it lands.

This makes the plan directly usable to drive implementation, one stage at a time,
and to generate prompts for an external coding agent.

## The plan file

The plan uses markdown with checkboxes so progress is visible and the next stage
is unambiguous:

```markdown
## Stage 1: Project scaffolding
- [x] Goal: Set up project structure and build tooling
- [x] Requirements: REQ-UI-001, REQ-UI-002
- [x] Verification: `npm run build` passes

## Stage 2: Authentication
- [ ] Goal: Implement auth middleware and login flow
- [ ] Requirements: REQ-AUTH-001, REQ-AUTH-002, REQ-AUTH-003
- [ ] Verification: `npm test -- --grep auth` passes
```

Completed stages are marked `[x]`; regenerating the plan preserves them. An agent
reads this file when building context for a stage, so it always knows where the
work left off.

## Readiness

A plan begins with a readiness assessment against the spec and the
[ADRs](./design.md):

- **READY** — the spec is sufficient to begin implementation;
- **NOT READY** — there are blocking gaps, listed with recommended fixes.

If the spec is not ready, the right move is to return to the [Spec](./index.md) or
[Design](./design.md) stage and close the gaps before planning further. The plan
draws on the ADRs, so design decisions are respected when the work is broken down
and, later, when it is implemented.

## Driving the Plan stage

The `.rqml/plan.md` layout above is the convention. RQML agent integrations add a
guided command to create and update it — for example a `/plan` command in the
[VS Code extension](https://marketplace.visualstudio.com/items?itemName=rqml.rqml-vscode)
and the [Claude Code](https://github.com/rqml-org/rqml-claude) and
[Codex](https://github.com/rqml-org/rqml-codex) plugins — that inspects the spec,
the ADRs, and the codebase, reports readiness, and writes the staged plan.

Next: implement a stage (**Code**), then record traces and run the gate
(**Verify**) — see [the agent loop in the CLI reference](../tooling/cli.md#the-agent-loop).
