---
"@rqml/core": minor
"@rqml/cli": minor
"@rqml/mcp": minor
---

Add the traceability matrix as a first-class read surface.

- **@rqml/core**: `buildMatrix(doc, filter?)` derives a per-requirement matrix — status, upstream goals, implementing code, verifying tests, verification/implementation status, and coverage warnings — from the trace graph and coverage report, with `matrixToMarkdown()` and an optional `status`/`type`/`warning` filter. Derived once in the engine so every surface renders one source.
- **@rqml/cli**: new `rqml matrix` command (markdown or `--json`, with `--status`/`--type`/`--warning` filters).
- **@rqml/mcp**: new `rqml_matrix` tool returning the matrix as structured data plus a markdown table — at parity with the CLI and tools-only (no resources or elicitation).
