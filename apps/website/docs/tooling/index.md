---
id: tooling
title: RQML Tooling
sidebar_label: Tooling
sidebar_position: 6
description: The RQML reference toolchain — the @rqml/core engine, the rqml CLI, and the @rqml/mcp server.
---

# RQML Tooling

The schema and the [Reference](../reference/index.md) describe *what* a conforming
RQML document is. This section covers the **reference toolchain** that reads,
validates, and checks those documents in practice.

It is a small TypeScript suite, published to npm, built around **one engine**:
everything else is a thin surface over it, so a verdict is identical no matter how
you ask for it.

| Package | What it is | Use it from |
|---------|-----------|-------------|
| [`@rqml/core`](./core.md) | The engine: parse, validate, lint, trace, impact, coverage, drift, link recording | Your own TS/JS code, editors, agents |
| [`@rqml/cli`](./cli.md) (`rqml`) | The command-line interface, agent-loop commands, and CI gate | A terminal, CI, save/commit hooks |
| [`@rqml/mcp`](./mcp.md) | A Model Context Protocol server exposing the engine as tools | Coding agents (Claude, etc.) |

There is also [`@rqml/schema`](../reference/index.md) — the canonical XSDs and
example documents that `@rqml/core` bundles, published to the stable
`/schema/rqml-2.2.0.xsd` URL.

## Design principles

These properties hold across every tool, because they all run the same engine:

- **Deterministic.** No language model sits in the verdict path. The same document
  and codebase always produce the same result — so the `rqml check` gate is
  reproducible and usable as audit evidence. Models are confined to *authoring*
  RQML, never to *judging* it.
- **Offline.** The schema is bundled, so validation needs no network access — it
  runs on every editor save, agent turn, and CI job.
- **One engine, many surfaces.** The CLI, the MCP server, the VS Code extension,
  and third-party integrations all call `@rqml/core`. There is one implementation
  of how RQML is parsed and checked, so the surfaces never disagree.
- **Node 18+.** The toolchain targets modern Node; the engine avoids Node-only
  built-ins in its parse/lint/trace paths so it stays embeddable.

## Quick taste

```bash
# one-off check of a spec in the current directory
npx @rqml/cli check

# or wire the engine into your own tool
npm install @rqml/core
```

## The agent loop

Beyond validating and gating, the toolchain serves the *middle* of a spec-first
task — surveying coverage, reading one artifact, accepting requirements, and
recording what was done — so an agent never hand-edits trace XML or loads the
whole spec into context:

```bash
rqml overview                  # readable projection of the spec (--section/--id to scope)
rqml matrix                    # traceability matrix: coverage, goals, code, tests, gaps
rqml show REQ-PAY-001          # one requirement: statement, acceptance, traces
rqml impact REQ-PAY-001        # what is affected if it changes?
rqml approve REQ-PAY-001       # accept a requirement before implementing it
# … implement …
rqml link REQ-PAY-001 src/payments/capture.ts   # record the implements edge + drift baseline
rqml gate src/payments/capture.ts               # block code implementing a non-approved requirement
rqml check                     # the gate — validation + coverage + drift
```

The `link` step also records a content hash of the implementation in
`.rqml/baseline.json`, so a later `rqml check` catches code that *changed* after
it was linked — not just code that disappeared.

This loop is the **Code** and **Verify** half of the
[five-stage RQML development process](../development-process/index.md); the
earlier stages (Spec, Design → ADRs, Plan) produce the spec and the artifacts in
`.rqml/` that this loop draws on.

Head to [`@rqml/core`](./core.md) for the library API, [`@rqml/cli`](./cli.md) for
the command line, or [`@rqml/mcp`](./mcp.md) to give a coding agent RQML tools.
