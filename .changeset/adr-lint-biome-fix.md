---
---

Build fix only: the ADR lint's finding message is now built with a template
literal instead of string concatenation, to satisfy biome's `useTemplate`.
Behaviour and message text are unchanged.

No version bump: the feature this belongs to is already covered by the
`@rqml/core` / `@rqml/cli` minor in `adr-reference-lint`, which has not been
released yet, so this rides along with it.
