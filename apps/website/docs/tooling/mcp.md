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
| `rqml_validate` | XSD + referential-integrity validation | `xml` or `path` |
| `rqml_status` | Requirement count, trace coverage, dangling references | `xml` or `path` |
| `rqml_check` | The deterministic gate (validation + coverage + drift) → `pass`/`fail` | `xml` or `path`, `baseDir?`, `strictness?` |
| `rqml_trace` | Resolve the trace graph and report dangling local references | `xml` or `path` |
| `rqml_show` | One artifact: statement, acceptance criteria, trace neighborhood (+ rendered markdown) | `xml` or `path`, `id` |
| `rqml_impact` | What is affected, transitively, if this artifact changes | `xml` or `path`, `id` |
| `rqml_skeleton` | A schema-valid snippet: `req`, `edge`, `testCase`, or `stateMachine` | `kind`, `id?` |
| `rqml_link` | Record an `implements`/`verifiedBy` edge and its drift baseline — **writes the spec file** | `path`, `artifactId`, `uri`, `type?`, `edgeId?`, `kind?`, `title?` |

Every document-reading tool accepts either the document text (`xml`) or a
filesystem `path` — prefer `path`, so the agent never inlines a multi-thousand-line
spec into a tool call. When `path` is given, `implements` code links resolve
against the spec's directory unless `baseDir` overrides it. `strictness` is
`relaxed` · `standard` · `strict` · `certified`.

`rqml_show` and `rqml_impact` are the context-economy tools: an agent working on
one requirement reads a few-hundred-token slice instead of the whole document.

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
  corresponding [`rqml`](./cli.md) CLI command — covered by an integration test
  that runs both against the same project.
- **Read-mostly.** Every tool is read-only except `rqml_link`, which writes the
  named spec file — it requires an explicit `path` (no inline-XML form), appends
  the edge textually so comments and formatting survive, and writes only when
  the edited document still validates. It also records the linked artifact's
  hash in `.rqml/baseline.json`, so subsequent `rqml_check` calls detect
  *changed* implementations, not just missing ones.
- **Deterministic.** Like the rest of the toolchain, the verdicts involve no
  language model — the agent proposes RQML, the engine disposes.

:::tip Authoring vs. enforcement
Use the MCP tools to let an agent *write and revise* RQML, and the
[`rqml check`](./cli.md#the-check-gate) gate (in CI or a hook) to *enforce* it.
The model proposes; the deterministic engine decides.
:::
