# @rqml/schema

## 0.1.2

### Patch Changes

- 33ac705: Teach the bundled `AGENTS.md` template about `rqml matrix` — the traceability-matrix read surface added in 0.4.0 — so `rqml init` scaffolds a process contract that mentions it. The website tooling docs (`cli.md`, `mcp.md`) document the `rqml matrix` command and the `rqml_matrix` MCP tool alongside.

## 0.1.1

### Patch Changes

- b374d8c: Agent-loop toolchain (PKG-LOOP): `rqml link` records implements/verifiedBy
  trace edges mechanically and captures a drift baseline (`.rqml/baseline.json`)
  so `rqml check` detects changed artifacts, not just missing ones. New
  `rqml show` (single-artifact slice with acceptance criteria and trace
  neighborhood), `rqml impact` (transitive trace traversal), and `rqml skeleton`
  (schema-valid snippets). The core engine now enforces state-machine references
  in `checkIntegrity` (unresolved initial states, dangling transitions, outgoing
  transitions from final states) and reports lifecycle-aware coverage
  (approved-only implementation gap, premature-implementation findings). Every
  MCP tool accepts a `path` input alternative to inline XML, and the server
  gains `rqml_show`, `rqml_impact`, `rqml_skeleton`, and `rqml_link` (explicit
  write). The AGENTS.md template now routes agents to the rqml CLI instead of
  raw xmllint.
