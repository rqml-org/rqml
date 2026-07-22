# @rqml/core

## 0.8.0

### Minor Changes

- fdf72c9: Lint now checks that ADR references still resolve.

  Referential integrity covers trace edges, but an ADR's citations are prose:
  rename or retire a requirement and every record arguing about it silently
  becomes a lie — the rationale survives, its subject does not.

  `rqml lint` (and `rqml status`) now report an Architecture Decision Record whose
  `Decision ID` or `Related requirements` header field names an identifier the
  spec does not declare. The finding carries the record, the line, and the
  remedies.

  The rule is deliberately narrow, because an audit of a seven-repo corpus found
  two real dangling references against twenty-eight correct citations. It does
  not inspect:

  - **Superseded or rejected records** — their references to retired ids are
    accurate history, and "fixing" them would falsify the record.
  - **Body prose** — it carries historical citations and cross-repo mentions.
  - **Examples** — `from="REQ-A" to="GOAL-B"` is syntax, not a reference.
  - **Qualified ids** — `REQ-HOOK-PREIMPL (rqml-claude, rqml-codex)`, the
    established convention for "this one lives elsewhere".

  New in `@rqml/core`: `lintAdrReferences`, `citationsInField`, `isRetiredRecord`,
  and a `LintOptions.adrDir`. The rule runs only when a caller supplies that
  directory, so in-memory consumers (an inlined document, the MCP server) are
  unaffected.

## 0.7.0

### Minor Changes

- d2f9678: Compact trace-edge serialization (RQML 2.2.0, RFC-0003) and generalized `rqml link`.

  - **`rqml link` / `rqml_link`** now record any of the 15 trace types between two
    endpoints (declared id or external URI), auto-orienting implements/verifiedBy,
    stamping `status="draft"` + `createdBy`, and accepting `--notes`/`--confidence`/
    `--tags`. Undeclared bare ids are rejected rather than treated as external.
  - **RQML 2.2.0** makes the compact attribute-form edge (`<edge id type from to/>`)
    the single serialization (−43% edge bytes, lossless). Endpoint values use a
    micro-syntax: bare id = local, `rqml:uri#id` with `;version`/`;git`/`;docId`
    pins = doc, other-scheme URI or schemeless relative path = external.
  - The 2.2.0 schema requires `@from`/`@to`, repairs the identity constraints, and
    drops the (inert) trace keyrefs; referential integrity is processor-enforced.
  - New **`rqml migrate`** rewrites 2.0.1/2.1.0 documents to 2.2.0 in place
    (byte-minimal, comment-safe, drift baselines untouched).

  Breaking: `@rqml/core`'s `LinkRequest` interface changed shape, and the default
  emitted serialization is now the 2.2.0 compact form. Existing documents migrate
  with `rqml migrate`.

### Patch Changes

- Updated dependencies [d2f9678]
  - @rqml/schema@0.2.0

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
  - @rqml/schema@0.1.4

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
  - @rqml/schema@0.1.3

## 0.4.0

### Minor Changes

- 2c75dfd: Add the traceability matrix as a first-class read surface.

  - **@rqml/core**: `buildMatrix(doc, filter?)` derives a per-requirement matrix — status, upstream goals, implementing code, verifying tests, verification/implementation status, and coverage warnings — from the trace graph and coverage report, with `matrixToMarkdown()` and an optional `status`/`type`/`warning` filter. Derived once in the engine so every surface renders one source.
  - **@rqml/cli**: new `rqml matrix` command (markdown or `--json`, with `--status`/`--type`/`--warning` filters).
  - **@rqml/mcp**: new `rqml_matrix` tool returning the matrix as structured data plus a markdown table — at parity with the CLI and tools-only (no resources or elicitation).

## 0.3.0

### Minor Changes

- ee580a4: Trace links are now maintainable, not just creatable: `rqml link --update`
  repoints an existing edge's external locator (refreshing its drift baseline),
  and `rqml link --refresh <edge-id>` re-records the baseline to bless an
  intentional implementation change — no more hand-editing trace XML or
  baseline.json. The MCP `rqml_link` tool gains the same `update` and `refresh`
  modes, and @rqml/core exports the new `updateTraceEdge` primitive.

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
  - @rqml/schema@0.1.1
