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
| `rqml_show` | One artifact: statement, acceptance criteria, trace neighborhood — data + markdown |
| `rqml_impact` | What is affected, transitively, if an artifact changes |
| `rqml_matrix` | Traceability matrix: per-requirement status, goals, code, tests, coverage warnings — data + markdown |
| `rqml_skeleton` | Generate a schema-valid RQML snippet (req / edge / testCase / stateMachine) |
| `rqml_link` | Record/maintain an implements/verifiedBy edge and its drift baseline (writes on explicit intent) |

Each tool accepts the document inline as `xml` or as a filesystem `path` (read
without modification — REQ-MCP-PATH-INPUT); `rqml_check` and `rqml_matrix` take
additional options. Every tool is backed by `@rqml/core`, so results are
equivalent to the corresponding `rqml` CLI command (REQ-MCP-PARITY); responses
are text/JSON only (the server depends on no optional MCP client features such as
resources or elicitation), and it performs no irreversible filesystem actions
without explicit caller intent (REQ-MCP-READONLY).

## Run

```
npx @rqml/mcp        # speaks MCP over stdio
```
