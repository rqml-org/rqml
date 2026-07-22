---
"@rqml/core": minor
"@rqml/cli": minor
"@rqml/mcp": minor
---

Fragment scope: tell "the evidence changed" from "the file around it changed"

A drift baseline hashes the whole file a locator points at, so a routine version
bump in `packages/cli/package.json` failed the build on an edge whose declared
evidence was `#bin`. Four consecutive releases reddened the gate on the same
three edges, and no re-pin in a full working session caught an unintended
change — a gate whose red is usually noise teaches its readers to re-pin without
reading.

`rqml link` now records the content of a locator's `#fragment` alongside the
file hash, and `check` reports a file that changed around unchanged evidence as
`context-changed-implementation`: advisory at every level except `certified`,
where the whole file is the evidence an auditor reads. The JSON report and
`rqml_check` gain a `contextChanged` list beside `drift`.

The whole-file hash is still the detector — fragment scope can only *downgrade*
an alarm it already raised, never suppress one. Only `.json` fragments are
interpreted (a member name, `#bin`, or an RFC 6901 pointer, `#/scripts/build`);
TypeScript, JavaScript and XSD fragments keep whole-file evidence exactly as
before, and any uncertainty — an unresolvable fragment, a file that stops being
valid JSON, a member declared twice — is reported as drift. A locator with no
fragment is never narrowed, so a requirement linked to a whole manifest keeps
every dependency channel in scope by construction.

Existing baselines need no migration: a bare sha256 still means whole-file
scope, and an edge gains fragment scope the next time it is linked or refreshed.
`ArtifactStatus` widens by one member, `context-changed`; consumers that
switch on it exhaustively will want a case for it.
