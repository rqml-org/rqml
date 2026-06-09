---
title: "rqml — the command line"
sidebar_label: "@rqml/cli (rqml)"
sidebar_position: 2
description: The rqml command line — validate, status, and the deterministic check gate for RQML projects.
---

# @rqml/cli (the `rqml` command)

The command-line interface, and the universal substrate every integration can
invoke. It is published as **`@rqml/cli`**; the installed command is **`rqml`**.

```bash
npm install -g @rqml/cli      # then: rqml <command>
# or, no install:
npx @rqml/cli <command>
```

It bundles `@rqml/core`, so it runs fully offline and its verdicts match the
engine and the [`@rqml/mcp`](./mcp.md) server.

## Commands

```text
rqml <command> [spec.rqml] [options]

  init [path]      Scaffold a starter spec and an AGENTS.md project marker
  validate [path]  XML well-formedness, XSD, and referential integrity
  status [path]    Spec summary: requirement count, coverage, lint findings
  check [path]     Deterministic enforcement gate (validation + coverage + drift)
```

When no path is given, the lone `*.rqml` document in the working directory is used
(preferring `requirements.rqml`).

## Options

| Flag | Meaning |
|------|---------|
| `--json` | Emit machine-readable JSON (for `status`, `check`, `validate`) — for control loops and editor hooks |
| `--strictness <level>` | `relaxed` · `standard` (default) · `strict` · `certified` — how aggressively `check` gates |
| `--base-dir <dir>` | Directory to resolve the spec and `implements` code links against |

## The `check` gate

`rqml check` is the deterministic enforcement gate. It composes XSD + integrity
validation, trace coverage, and implementation drift into a single pass/fail
verdict, and exits **non-zero** only when the document is invalid or has blocking
drift/coverage. Coverage findings block at `strict` and `certified`.

Because it invokes no language model, the verdict is reproducible — which is what
makes it safe to wire into a save hook, a pre-commit hook, or CI.

```bash
rqml check --strictness strict
echo $?            # 0 = pass
```

## Exit codes

Stable and documented, so scripts can branch on them:

| Code | Meaning |
|------|---------|
| `0` | success |
| `1` | validation failure (not well-formed, schema-invalid, or integrity error) |
| `2` | check-gate failure (blocking drift or coverage) |
| `64` | usage error |

## Examples

```bash
rqml init                       # scaffold requirements.rqml + AGENTS.md
rqml validate                   # is the spec structurally valid?
rqml status --json | jq .       # coverage/lint summary as JSON
rqml check --strictness strict  # CI gate
```
