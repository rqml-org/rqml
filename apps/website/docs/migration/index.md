---
id: migration
title: Migration
sidebar_label: Migration
sidebar_position: 10
description: Upgrade an existing RQML document to the current schema version with rqml migrate — what changes, what is guaranteed to stay the same, and how to handle a repository with several specs.
---

# Migration

A schema release can change how RQML documents are written. `rqml migrate` rewrites an existing spec to the current version so you never have to do it by hand.

```bash
rqml migrate --dry-run   # see what would change
rqml migrate             # rewrite the spec in place
```

It resolves the governing spec the same way every other command does, so you can run it from anywhere inside a project unit. Migration is **idempotent** — running it on an already-current document reports `is already 2.2.0` and exits 0, so it is safe in a script.

## What it changes

| Changed | Left byte-for-byte alone |
| --- | --- |
| The root `version` attribute, namespace, and `xsi:schemaLocation` | Every other element and attribute |
| Each trace edge, re-emitted in the current canonical form | Comments, whitespace, and formatting outside the trace section |
| | `<notes>` content inside an edge, copied verbatim |

Migrating a real 154-edge spec:

```text
$ rqml migrate --dry-run
✓ would migrate requirements.rqml: 2.1.0 → 2.2.0, 154 edges, 206419 → 192856 bytes (dry run)
```

Only the root element and the trace edges differ afterwards; the document's nine XML comments survive unchanged.

### The drift baseline is deliberately untouched

`.rqml/baseline.json` hashes the content of **linked artifacts**, keyed by edge id. Migration changes neither, so the recorded state carries over exactly — including any drift that already existed. That is intentional: a migration must not silently bless a stale baseline. Run `rqml check` after migrating and resolve any drift the way you normally would, with `rqml link --refresh <edge-id>`.

### Safety properties

- **`--dry-run` writes nothing.** It reports the version change, the edge count, and the size delta.
- **The file is only written if the result validates** against the target schema. If it would not, nothing is written and the diagnostics are printed.
- **The rewritten document parses to an identical trace model.** This is enforced by a guard, not just by construction.
- **Commented-out edges stay commented out.** Edge locations are resolved against comment-masked text, so a stale copy of an edge inside an XML comment can never absorb the rewrite and leave the live edge behind.
- **Unrecognized flags are refused** rather than ignored, because `migrate` takes no required argument and a silently-dropped flag would fall through to a write.

## 2.1.0 → 2.2.0: compact trace edges

2.2.0 changes exactly one thing: how a trace edge's endpoints are written. The nested `from`/`to` element tree is replaced by `from` and `to` **attributes**, and the `locator`, `local`, `doc`, and `external` elements are removed.

```xml
<!-- 2.1.0 -->
<edge id="TR-001" type="dependsOn">
  <from><locator><local id="REQ-UI-007"/></locator></from>
  <to><locator><local id="REQ-SUB-002"/></locator></to>
  <notes>Detail view depends on subscription tier gating.</notes>
</edge>

<!-- 2.2.0 -->
<edge id="TR-001" type="dependsOn" from="REQ-UI-007" to="REQ-SUB-002">
  <notes>Detail view depends on subscription tier gating.</notes>
</edge>
```

Nothing about the *meaning* of an edge changed. The same three endpoint kinds exist; the kind is now inferred from the shape of the value rather than from an element name:

| 2.1.0 element | 2.2.0 value |
| --- | --- |
| `<local id="REQ-A"/>` | `REQ-A` |
| `<doc uri="goals.rqml" id="GOAL-B" version="2.0" docId="DOC-G"/>` | `rqml:goals.rqml#GOAL-B;version=2.0;docId=DOC-G` |
| `<external uri="jira:PROJ-1"/>` | `jira:PROJ-1` |
| `<external uri="src/auth.ts"/>` | `src/auth.ts` |
| `<external uri="README.md"/>` | `./README.md` |

The last row is the one case worth knowing: a schemeless value with no `/` has the same shape as a local id, so migration adds a `./` prefix to keep it a path. The prefix is syntax only and is not part of the recorded path.

The `kind` and `title` hints that lived on a locator become per-side attributes — `fromKind` / `fromTitle` / `toKind` / `toTitle`.

See the [trace user guide](../user-guide/trace.md) for the full endpoint syntax, and [RFC-0003](https://github.com/rqml-org/rqml/blob/main/rfc/0003-compact-trace-edge-serialization.md) for the rationale.

## 2.0.1 → 2.2.0

`rqml migrate` upgrades a 2.0.1 document directly. 2.0.1 used a flat `<traceEdge>` element, which 2.1.0 replaced with `<edge>`; both are rewritten to the current compact form in one pass.

Note that 2.1.0 also removed the inline `refs` elements from `scenario`, `req`, `transition`, `testCase`, `actor`, and `testSuite`. Those carried relationships that belong in the trace section, and migration does **not** invent trace edges for them — if your 2.0.1 document used `refs`, add the corresponding edges with `rqml link` after migrating.

## Upgrading a repository

For a single spec:

```bash
rqml migrate --dry-run    # inspect
rqml migrate              # rewrite
rqml validate             # confirm
rqml check                # gate, including any pre-existing drift
```

`migrate` has **no workspace mode** — it rewrites one spec at a time, so a repository with several specs needs one run per unit:

```bash
# Migrate every spec in the repository, then gate them together.
# `check --workspace` exits non-zero if any unit fails, so ignore its status
# here — this run is only being used to enumerate the specs.
for spec in $(rqml check --workspace --json 2>/dev/null | jq -r '.units[].path' || true); do
  rqml migrate --spec "$spec"
done
rqml check --workspace
```

Commit the migration on its own, separate from any content change. The diff is large but entirely mechanical, and keeping it isolated makes it reviewable.

### Upgrade the toolchain first

A CLI can only migrate to the schema version it ships with. Install the current release before migrating, or the command will report that the spec is already at its target:

```bash
npm install -g @rqml/cli@latest   # or: npx @rqml/cli@latest migrate
```

## When migration refuses

| Message | Cause | Fix |
| --- | --- | --- |
| `duplicate edge id "…"; fix integrity findings before migrating` | Two edges share an id, which makes the rewrite ambiguous | `rqml validate` to list them, then give each edge a unique id |
| `cannot migrate from unknown version "…"` | The root `version` is not a release this CLI knows | Check for a typo; upgrade `@rqml/cli` if the version is newer than your toolchain |
| `migrated document does not validate against 2.2.0; nothing written` | The document had a pre-existing schema problem | Run `rqml validate` and fix the reported diagnostics first |
| `document does not parse: …` | The file is not well-formed XML | Fix the XML syntax error at the reported position |

In every case the original file is left untouched.
