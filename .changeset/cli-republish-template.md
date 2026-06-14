---
"@rqml/cli": patch
---

Republish the CLI so `rqml init` scaffolds the matrix-aware `AGENTS.md`. The CLI bundles the template from `@rqml/schema` (`tsup` `noExternal`), so it needs a rebuild to pick up the 0.1.2 template that documents `rqml matrix`.
