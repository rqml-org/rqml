---
"@rqml/cli": minor
---

`rqml init` now merges a managed RQML block into an existing `AGENTS.md` instead
of skipping the file. The block is delimited by `<!-- BEGIN RQML -->` /
`<!-- END RQML -->` markers: `init` creates the file from it when absent, appends
it when the file exists without one, and refreshes it in place on re-runs. Text
outside the markers is never touched, the merge is idempotent, and a strictness
level the project already declares is preserved across a refresh. This lets a
repository that already has an `AGENTS.md` (common with Codex) adopt RQML without
losing its existing guidance (REQ-CLI-INIT-MERGE, ADR-0016).
