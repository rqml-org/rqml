# @rqml/mcp

## 0.6.1

### Patch Changes

- 596c119: Docs: sync the published `@rqml/cli` and `@rqml/mcp` package READMEs with the
  shipped surface. The CLI README now lists the `rqml lint` command, the
  `--workspace`/`--all` and `--ignore` flags, and the nearest-wins spec resolution;
  the MCP README lists the `rqml_discover` tool and the `file` input. (The READMEs
  are what npm displays; they had drifted behind the 0.6.0/0.7.0 features.)

## 0.6.0

### Minor Changes

- 1ce372d: Monorepo support: nearest-wins spec discovery and workspace fan-out (ADR-0012).

  A repository can host many specs — one per project unit. A file is governed by the
  spec in its nearest ancestor directory; a nested spec takes over its own subtree
  and never governs a parent (no inheritance or merging across specs).

  - **@rqml/core** — new `resolveGoverningSpec` and `discoverSpecs` (pure filesystem,
    no git dependency): resolve the governing spec for any path, and enumerate every
    governing spec beneath a root.
  - **rqml CLI** — resolves the governing spec by walking up from the working
    directory (backward-compatible; `--spec`/`--base-dir` still override), and adds a
    `--workspace`/`--all` mode that runs validate/status/check across every spec with
    one aggregated exit code (`--ignore` to skip directories).
  - **@rqml/mcp** — new `rqml_discover` tool and `file`-based spec resolution, staying
    tools-only.
  - **@rqml/schema** — the bundled `AGENTS.md` template is reworded off the umbrella
    model to the nearest-wins governance model.

### Patch Changes

- Updated dependencies [1ce372d]
  - @rqml/core@0.6.0

## 0.5.0

### Minor Changes

- 5292f71: Add the rest of the interactive-RQML capabilities (2–5).

  - **Spec overview (cap 5):** `@rqml/core` `projectOutline` scopes the document outline by section or id; `rqml overview` (CLI) and `rqml_overview` (MCP) render the whole spec or a subset as markdown + JSON.
  - **Status transition / approve (cap 4):** `@rqml/core` `setStatus` performs a textual, comment-preserving status edit; `rqml approve` (CLI) and `rqml_approve` (MCP) transition a requirement's lifecycle status as an explicit-intent write.
  - **Approval gate (cap 3):** `@rqml/core` `approvalGate` flags implementation linked to non-approved requirements; `rqml gate` (CLI, exit 2 when blocked) and `rqml_gate` (MCP) expose it so editor/agent/CI hooks can block — no language model in the verdict path.
  - **MCP data-plane boundary (cap 2):** the server advertises only the `tools` capability and depends on no optional MCP client feature, keeping every capability reachable on tools-only hosts at CLI parity.
  - The bundled `AGENTS.md` template and the website tooling docs document the new commands and tools.

### Patch Changes

- Updated dependencies [5292f71]
  - @rqml/core@0.5.0

## 0.4.0

### Minor Changes

- 2c75dfd: Add the traceability matrix as a first-class read surface.

  - **@rqml/core**: `buildMatrix(doc, filter?)` derives a per-requirement matrix — status, upstream goals, implementing code, verifying tests, verification/implementation status, and coverage warnings — from the trace graph and coverage report, with `matrixToMarkdown()` and an optional `status`/`type`/`warning` filter. Derived once in the engine so every surface renders one source.
  - **@rqml/cli**: new `rqml matrix` command (markdown or `--json`, with `--status`/`--type`/`--warning` filters).
  - **@rqml/mcp**: new `rqml_matrix` tool returning the matrix as structured data plus a markdown table — at parity with the CLI and tools-only (no resources or elicitation).

### Patch Changes

- Updated dependencies [2c75dfd]
  - @rqml/core@0.4.0

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
