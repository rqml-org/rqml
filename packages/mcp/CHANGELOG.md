# @rqml/mcp

## 0.3.0

### Minor Changes

- ee580a4: Trace links are now maintainable, not just creatable: `rqml link --update`
  repoints an existing edge's external locator (refreshing its drift baseline),
  and `rqml link --refresh <edge-id>` re-records the baseline to bless an
  intentional implementation change — no more hand-editing trace XML or
  baseline.json. The MCP `rqml_link` tool gains the same `update` and `refresh`
  modes, and @rqml/core exports the new `updateTraceEdge` primitive.

### Patch Changes

- 78aaf74: `rqml --version` (and the MCP server's declared version) now report the real
  installed package version instead of a hardcoded constant that went stale on
  release: 0.2.0 shipped while `--version` still printed 0.1.0.
- Updated dependencies [ee580a4]
  - @rqml/core@0.3.0

## 0.2.0

### Minor Changes

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

### Patch Changes

- Updated dependencies [b374d8c]
  - @rqml/core@0.2.0
