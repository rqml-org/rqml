---
"@rqml/schema": minor
"@rqml/core": minor
"rqml": minor
"@rqml/mcp": minor
---

Initial monorepo release. The standalone `rqml-core` library is merged in as
`@rqml/core` (Node-only), with the canonical schemas extracted to `@rqml/schema`,
a new `rqml` CLI and `@rqml/mcp` server over the engine, and deterministic
coverage and drift checks. `@rqml/core` must be published before `rqml-vscode`,
which now depends on it from the registry, can install.
