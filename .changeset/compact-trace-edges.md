---
"@rqml/schema": minor
"@rqml/core": minor
"@rqml/cli": minor
"@rqml/mcp": minor
---

Compact trace-edge serialization (RQML 2.2.0, RFC-0003) and generalized `rqml link`.

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
