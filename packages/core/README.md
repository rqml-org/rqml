# @rqml/core

The RQML engine — the **dependency-clean** library that every RQML surface (the
`rqml` CLI, the `@rqml/mcp` server, the VS Code extension, and third-party tools)
reuses, so there is one implementation of how RQML is parsed and checked
(`GOAL-REUSABLE-ENGINE`).

## Capabilities

- **Parse / serialize** — `parse()` turns a `.rqml` string into a typed model;
  `serialize()` writes it back. Round-trip preserves structure.
- **Validate** (`@rqml/core/validate`) — XSD validation via a libxml2 engine plus
  in-code referential integrity (id uniqueness, trace keyrefs) that the XSD alone
  does not enforce. Schema text is bundled from `@rqml/schema`, so validation is
  offline and deterministic (`REQ-CORE-VALIDATE`, `REQ-CORE-NO-LLM`).
- **Lint** — strictness-aware semantic checks (`lint()`).
- **Trace** — resolve trace edges, index declared ids, find dangling references.
- **Coverage / gate** — deterministic coverage, drift, and impact over the trace
  graph; `approvalGate()` flags implementation linked to non-approved requirements.
- **Edit** — `appendTraceEdge`/`updateTraceEdge` record trace links and
  `setStatus` transitions a requirement's status, all as safe textual edits.
- **Export** — document outline + Markdown (`buildOutline`/`outlineToMarkdown`,
  `projectOutline` to scope), and the **traceability matrix** (`buildMatrix`):
  one row per requirement with status, goals, code, tests, and coverage.

## Entry points

```ts
import { parse, serialize, lint, resolveTrace, buildMatrix, projectOutline, setStatus, approvalGate } from "@rqml/core";
import { validate } from "@rqml/core/validate"; // separate entry: loads the XSD engine
```

The main entry never loads the validation engine, so consumers that only parse,
lint, or trace stay lean. The `.` and `./validate` entry points and the ESM
output are a **stable contract** the VS Code extension depends on — keep them.

## Boundaries

`@rqml/core` carries **no** CLI argument-parsing or MCP SDK dependency and invokes
**no** language model (`REQ-CORE-DEPS`, `REQ-CORE-NO-LLM`); those live in the `rqml`
CLI and `@rqml/mcp`. Target runtime is **Node 18+** (`CON-OFFLINE`); the code avoids
DOM globals so it remains portable, but the browser is not a supported target.

## Provenance

This package is the former standalone `rqml-core` library, merged into the RQML
monorepo and renamed `@rqml/core`. Its bundled XSD copies were removed in favor of
the single canonical source in `@rqml/schema`. See `packages/core/.rqml/adr/` for
the design decisions carried over from the original project.
