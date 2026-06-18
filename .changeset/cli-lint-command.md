---
"@rqml/cli": minor
---

Add a `rqml lint` command that runs `@rqml/core`'s semantic lint over the resolved
spec and reports the findings, with severities scaled by `--strictness`. It exits
non-zero when any finding is an error — so `rqml lint --strictness strict` is a
usable document-quality gate — and zero otherwise. Linting was previously reachable
only via `rqml status`/`rqml check`.
