# @rqml/cli

The RQML command-line interface — the universal substrate every RQML integration
can invoke. Backed entirely by `@rqml/core`, so its verdicts match the engine and
the `@rqml/mcp` server.

Published as `@rqml/cli`; the installed command is `rqml`:

```bash
npm i -g @rqml/cli   # then: rqml <command>
# or, no install:    npx @rqml/cli <command>
```

```
rqml <command> [spec.rqml] [options]

  init [path]      Scaffold a starter spec and merge the RQML block into AGENTS.md
  validate [path]  XML well-formedness, XSD, and referential integrity
  status [path]    Spec, coverage, and lint summary
  lint [path]      Semantic lint findings; severity scales with --strictness (exit 1 on error)
  check [path]     Deterministic enforcement gate (validation + coverage + drift)
  show <id>        One artifact: statement, acceptance criteria, trace neighborhood
  impact <id>      What is affected, transitively, if this artifact changes
  overview [path]  Readable spec projection (whole, or --section/--id scoped)
  matrix [path]    Traceability matrix: status, goals, code, tests, coverage gaps
  link <id> <uri>  Record an implements/verifiedBy edge and its drift baseline
  approve <id>     Transition a requirement's status (--status, default approved)
  gate [paths...]  Block implementation of non-approved requirements (exit 2)
  skeleton <kind>  Print a schema-valid snippet (req|edge|testCase|stateMachine)
  migrate [path]   Rewrite a 2.0.1/2.1.0 spec to the current schema version (--dry-run)

  --json                     Machine-readable output (REQ-CLI-JSON)
  --strictness <level>       relaxed | standard | strict | certified
  --workspace, --all         Run validate/status/check across every spec in the repo (one exit code)
  --ignore <names>           Comma-separated directory names to skip during --workspace discovery
  --base-dir <dir>           Where spec discovery starts / the --workspace root
  --status/--type/--warning  Filter matrix rows; --status also sets approve's target
  --section/--id             Scope overview to sections or element ids (comma-separated)
  --changed <paths>          Scope gate to changed paths (or pass them as positionals)
```

When no spec path is given, `rqml` resolves the governing spec by walking up from
the working directory to the nearest `*.rqml` (preferring `requirements.rqml`),
stopping at the repository root — so commands work from anywhere inside a project
unit. In a repo with multiple specs, `rqml check --workspace` gates them all.

## Exit codes (stable — REQ-CLI-EXIT-CODES)

| Code | Meaning |
|------|---------|
| 0 | success |
| 1 | validation failure (not well-formed, schema-invalid, or integrity error) |
| 2 | check gate failure (blocking drift or coverage) |
| 64 | usage error |

`rqml check` exits non-zero only when the document is invalid or has blocking
drift/coverage, so it works as a CI and editor-save gate. It invokes no language
model: identical inputs yield identical verdicts (REQ-ENFORCE-DETERMINISM).
