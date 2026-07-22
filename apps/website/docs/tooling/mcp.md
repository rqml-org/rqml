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
| `rqml_discover` | Enumerate the governing specs in a repository, and resolve the spec governing a `file` — for monorepos | `root`, `file?` |
| `rqml_show` | One artifact: statement, acceptance criteria, trace neighborhood (+ rendered markdown) | `xml` or `path`, `id` |
| `rqml_impact` | What is affected, transitively, if this artifact changes | `xml` or `path`, `id` |
| `rqml_matrix` | Traceability matrix: per-requirement status, goals, code, tests, and coverage warnings (+ rendered markdown) | `xml` or `path`, `status?`, `type?`, `warning?` |
| `rqml_overview` | Readable spec projection: whole document or scoped by section/id — outline + markdown | `xml` or `path`, `section?`, `id?` |
| `rqml_approve` | Transition a requirement's lifecycle status — **writes to disk** | `path`, `id`, `status?` |
| `rqml_gate` | Approval-before-implementation verdict (optionally scoped to changed paths) | `xml` or `path`, `changed?` |
| `rqml_skeleton` | A schema-valid snippet: `req`, `edge`, `testCase`, or `stateMachine` | `kind`, `id?` |
| `rqml_link` | Record or maintain an `implements`/`verifiedBy` edge and its drift baseline — **writes to disk** | `path`, `mode?`, `artifactId`, `uri`, `type?`, `edgeId?`, `kind?`, `title?` |

Every document-reading tool accepts the document text (`xml`), a filesystem
`path`, or a `file` — a path whose **governing spec** is resolved by nearest-wins
discovery (handy in monorepos; see the [Monorepo guide](/docs/monorepo)). Prefer
`path` or `file`, so the agent never inlines a multi-thousand-line spec into a tool
call. When `path` is given, `implements` code links resolve against the spec's
directory unless `baseDir` overrides it. `strictness` is `relaxed` · `standard` ·
`strict` · `certified`.

`rqml_show` and `rqml_impact` are the context-economy tools: an agent working on
one requirement reads a few-hundred-token slice instead of the whole document.
`rqml_matrix` is the spec-health surface — one row per requirement with coverage
status and warnings, filterable by `status` / `type` / `warning` — for reviewing
what is implemented, verified, or still has gaps without reading the raw spec.

`rqml_link` is the one writing tool, and mirrors [`rqml link`](./cli.md) mode for
mode: `mode: "append"` (the default) adds a new edge and records the linked
artifact's hash in `.rqml/baseline.json`; `mode: "update"` repoints the
*existing* edge's external locator in place — matched by `edgeId` or the same
derived id used when appending — and re-records its baseline entry;
`mode: "refresh"` takes an `edgeId` alone and re-blesses one intentionally
changed artifact's baseline without touching the spec document. The maintenance
modes are deliberately edge-scoped, so unrelated drift is never silently blessed
along the way (see [Drift baselines](./cli.md#drift-baselines)).

`rqml_check` returns `contextChanged` beside `drift`: links whose file changed
but whose named `#fragment` did not, which is advisory rather than drift except
at `strictness: "certified"` (see
[Fragment scope](./cli.md#fragment-scope)).

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
- **Read-mostly.** Every tool is read-only except `rqml_link`, which requires an
  explicit `path` (no inline-XML form). Its append and update modes edit the
  spec textually — comments and formatting survive — and write the file only
  when the edited document still validates; refresh mode writes only the
  baseline store. The recorded hashes are what let subsequent `rqml_check`
  calls detect *changed* implementations, not just missing ones.
- **Deterministic.** Like the rest of the toolchain, the verdicts involve no
  language model — the agent proposes RQML, the engine disposes.

:::tip Authoring vs. enforcement
Use the MCP tools to let an agent *write and revise* RQML, and the
[`rqml check`](./cli.md#the-check-gate) gate (in CI or a hook) to *enforce* it.
The model proposes; the deterministic engine decides.
:::
