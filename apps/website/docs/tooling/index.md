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
| [`@rqml/core`](./core.md) | The engine: parse, validate, lint, trace, coverage, drift | Your own TS/JS code, editors, agents |
| [`@rqml/cli`](./cli.md) (`rqml`) | The command-line interface and CI gate | A terminal, CI, save/commit hooks |
| [`@rqml/mcp`](./mcp.md) | A Model Context Protocol server exposing the engine as tools | Coding agents (Claude, etc.) |

There is also [`@rqml/schema`](../reference/index.md) — the canonical XSDs and
example documents that `@rqml/core` bundles, published to the stable
`/schema/rqml-2.1.0.xsd` URL.

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

Head to [`@rqml/core`](./core.md) for the library API, [`@rqml/cli`](./cli.md) for
the command line, or [`@rqml/mcp`](./mcp.md) to give a coding agent RQML tools.
