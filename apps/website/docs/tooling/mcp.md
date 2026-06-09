---
title: "@rqml/mcp — agent tools"
sidebar_label: "@rqml/mcp"
sidebar_position: 3
description: A Model Context Protocol server that exposes the RQML engine to coding agents as tools.
---

# @rqml/mcp

A [Model Context Protocol](https://modelcontextprotocol.io) server that exposes
`@rqml/core` to coding agents as tools, over stdio. It lets an agent validate and
reason about RQML documents through the same engine the CLI uses — so a tool call
and the corresponding `rqml` command return equivalent results.

```bash
npm install -g @rqml/mcp     # provides the `rqml-mcp` binary
```

## Tools

| Tool | Purpose | Input |
|------|---------|-------|
| `rqml_validate` | XSD + referential-integrity validation | `xml` |
| `rqml_status` | Requirement count, trace coverage, dangling references | `xml` |
| `rqml_check` | The deterministic gate (validation + coverage + drift) → `pass`/`fail` | `xml`, `baseDir?`, `strictness?` |
| `rqml_trace` | Resolve the trace graph and report dangling local references | `xml` |

Each tool takes the document text as `xml`; `rqml_check` also accepts `baseDir`
(to resolve `implements` code links) and `strictness`
(`relaxed` · `standard` · `strict` · `certified`).

## Connecting an agent

Most MCP clients are configured with a server entry that launches the binary over
stdio. For example:

```json
{
  "mcpServers": {
    "rqml": {
      "command": "npx",
      "args": ["-y", "@rqml/mcp"]
    }
  }
}
```

(If you installed it globally, use `"command": "rqml-mcp"` with no `args`.)

## Behavior

- **Engine parity.** Every tool is backed by `@rqml/core`, so results match the
  corresponding [`rqml`](./cli.md) CLI command.
- **Read-mostly.** The server treats the spec as read-only and performs no
  irreversible filesystem actions, so an agent can call it freely while reasoning.
- **Deterministic.** Like the rest of the toolchain, the verdicts involve no
  language model — the agent proposes RQML, the engine disposes.

:::tip Authoring vs. enforcement
Use the MCP tools to let an agent *write and revise* RQML, and the
[`rqml check`](./cli.md#the-check-gate) gate (in CI or a hook) to *enforce* it.
The model proposes; the deterministic engine decides.
:::
