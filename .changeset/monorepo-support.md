---
"@rqml/core": minor
"@rqml/cli": minor
"@rqml/mcp": minor
"@rqml/schema": patch
---

Monorepo support: nearest-wins spec discovery and workspace fan-out (ADR-0012).

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
