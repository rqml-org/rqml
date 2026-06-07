# @rqml/mcp

A [Model Context Protocol](https://modelcontextprotocol.io) server that exposes
the RQML engine (`@rqml/core`) to coding agents as tools over stdio.

## Tools

| Tool | Purpose |
|------|---------|
| `rqml_validate` | XSD + referential-integrity validation of a document |
| `rqml_status` | Requirement count, trace coverage, dangling references |
| `rqml_check` | The deterministic gate: validation + coverage + drift → pass/fail |
| `rqml_trace` | Resolve the trace graph and report dangling local references |

Each tool takes the document text as `xml` (`rqml_check` also accepts `baseDir`
and `strictness`). Every tool is backed by `@rqml/core`, so results are
equivalent to the corresponding `rqml` CLI command (REQ-MCP-PARITY), and the
server performs no irreversible filesystem actions (REQ-MCP-READONLY).

## Run

```
rqml-mcp        # speaks MCP over stdio
```

> Note: this package is a scaffold. It targets the stable low-level
> `@modelcontextprotocol/sdk` request-handler API; run `pnpm --filter @rqml/mcp build`
> and exercise it against an MCP client to verify against your installed SDK version.
