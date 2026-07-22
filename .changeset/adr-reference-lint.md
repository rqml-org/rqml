---
"@rqml/core": minor
"@rqml/cli": minor
---

Lint now checks that ADR references still resolve.

Referential integrity covers trace edges, but an ADR's citations are prose:
rename or retire a requirement and every record arguing about it silently
becomes a lie — the rationale survives, its subject does not.

`rqml lint` (and `rqml status`) now report an Architecture Decision Record whose
`Decision ID` or `Related requirements` header field names an identifier the
spec does not declare. The finding carries the record, the line, and the
remedies.

The rule is deliberately narrow, because an audit of a seven-repo corpus found
two real dangling references against twenty-eight correct citations. It does
not inspect:

- **Superseded or rejected records** — their references to retired ids are
  accurate history, and "fixing" them would falsify the record.
- **Body prose** — it carries historical citations and cross-repo mentions.
- **Examples** — `from="REQ-A" to="GOAL-B"` is syntax, not a reference.
- **Qualified ids** — `REQ-HOOK-PREIMPL (rqml-claude, rqml-codex)`, the
  established convention for "this one lives elsewhere".

New in `@rqml/core`: `lintAdrReferences`, `citationsInField`, `isRetiredRecord`,
and a `LintOptions.adrDir`. The rule runs only when a caller supplies that
directory, so in-memory consumers (an inlined document, the MCP server) are
unaffected.
