# @rqml/schema

## 0.2.0

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

## 0.1.4

### Patch Changes

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

## 0.1.3

### Patch Changes

- 5292f71: Add the rest of the interactive-RQML capabilities (2–5).

  - **Spec overview (cap 5):** `@rqml/core` `projectOutline` scopes the document outline by section or id; `rqml overview` (CLI) and `rqml_overview` (MCP) render the whole spec or a subset as markdown + JSON.
  - **Status transition / approve (cap 4):** `@rqml/core` `setStatus` performs a textual, comment-preserving status edit; `rqml approve` (CLI) and `rqml_approve` (MCP) transition a requirement's lifecycle status as an explicit-intent write.
  - **Approval gate (cap 3):** `@rqml/core` `approvalGate` flags implementation linked to non-approved requirements; `rqml gate` (CLI, exit 2 when blocked) and `rqml_gate` (MCP) expose it so editor/agent/CI hooks can block — no language model in the verdict path.
  - **MCP data-plane boundary (cap 2):** the server advertises only the `tools` capability and depends on no optional MCP client feature, keeping every capability reachable on tools-only hosts at CLI parity.
  - The bundled `AGENTS.md` template and the website tooling docs document the new commands and tools.

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
