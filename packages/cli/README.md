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

  init [path]      Scaffold a starter spec and AGENTS.md project marker
  validate [path]  XML well-formedness, XSD, and referential integrity
  status [path]    Spec, coverage, and lint summary
  check [path]     Deterministic enforcement gate (validation + coverage + drift)
  show <id>        One artifact: statement, acceptance criteria, trace neighborhood
  impact <id>      What is affected, transitively, if this artifact changes
  matrix [path]    Traceability matrix: status, goals, code, tests, coverage gaps
  link <id> <uri>  Record an implements/verifiedBy edge and its drift baseline
  skeleton <kind>  Print a schema-valid snippet (req|edge|testCase|stateMachine)

  --json                     Machine-readable output (REQ-CLI-JSON)
  --strictness <level>       relaxed | standard | strict | certified
  --base-dir <dir>           Resolve the spec and implements code links against <dir>
  --status/--type/--warning  Filter matrix rows (comma-separated, e.g. --warning unverified)
```

When no spec path is given, the lone `*.rqml` in the working directory is used
(preferring `requirements.rqml`).

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
