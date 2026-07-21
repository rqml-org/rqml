---
id: monorepo
title: Monorepo guide
sidebar_label: Monorepo guide
sidebar_position: 7
description: How RQML governs multiple specs in one repository — nearest-wins discovery, per-unit .rqml directories, workspace-wide checks, and the design decisions behind them.
---

# Monorepo guide

RQML scales down to a single `requirements.rqml` and up to a repository that hosts
**many specs** — one per package, app, or service. This guide explains how RQML
decides which spec governs which code, how to check them all at once, and the
design decisions behind the model.

The short version: **one spec per project unit, and the nearest spec wins.** A
file is governed by the spec in its closest enclosing directory — the same mental
model as `.editorconfig` or `tsconfig.json`.

## One spec per project unit

A *project unit* is a directory that owns a distinct set of requirements — a
package, app, or service. Each unit holds:

- exactly **one** spec file (by convention `requirements.rqml`, but any single
  `*.rqml` works), and
- its own co-located **`.rqml/`** directory, which holds that unit's ADRs
  (`adr/`), implementation plan (`plan.md`), and drift baseline (`baseline.json`).

The spec and its `.rqml/` directory live in the **same directory** — the top of
the subtree the spec governs.

```
my-monorepo/
├── requirements.rqml          ← governs the repo root and everything below…
├── .rqml/                      ← …its ADRs, plan, and baseline
│   ├── adr/
│   ├── plan.md
│   └── baseline.json
├── packages/
│   ├── api/
│   │   ├── requirements.rqml   ← takes over the packages/api subtree
│   │   ├── .rqml/
│   │   └── src/
│   └── web/
│       ├── requirements.rqml   ← takes over the packages/web subtree
│       ├── .rqml/
│       └── src/
└── packages/shared/
    └── src/                    ← no spec here → governed by the root spec
```

A repository does not need a root spec at all — you can put specs only in the
units that need them. A directory with no spec at or above it (up to the
repository root) is simply *not governed by RQML*.

## Which spec governs a file — nearest-wins

A spec governs:

- the directory it sits in, **and every subdirectory beneath it**,
- **except** any subtree taken over by a nested (deeper) spec,
- and **never** a parent directory.

Equivalently: **the spec in a file's nearest enclosing directory governs it.** To
resolve a file, RQML walks up from the file's directory and uses the first spec it
finds, stopping at the repository boundary (a `.git`/`.hg` marker, or the
filesystem root).

In the tree above:

| File | Governed by |
| --- | --- |
| `packages/api/src/server.ts` | `packages/api/requirements.rqml` (nearest) |
| `packages/web/src/app.tsx` | `packages/web/requirements.rqml` (nearest) |
| `packages/shared/src/util.ts` | root `requirements.rqml` (no nearer spec) |
| `README.md` (repo root) | root `requirements.rqml` |

A nested spec **fully takes over** its subtree — the parent spec governs nothing
inside it.

### The naming rule

Per directory, the spec is `requirements.rqml` if present; otherwise the sole
`*.rqml` file. A directory that holds **several** `*.rqml` files and no
`requirements.rqml` is **ambiguous** — RQML reports it rather than guessing. Fix
it by naming one of them `requirements.rqml`.

The `.rqml/` governance directory is never mistaken for a spec.

## Design decisions

These choices are recorded in
[ADR-0012](https://github.com/gudgeirsson/rqml) (monorepo spec discovery) and are
worth understanding as an end user:

- **No umbrella inheritance.** When a nested spec exists, it *replaces* its parent
  for its own subtree — requirements are never merged or inherited across the
  boundary. Each governing spec is self-contained, so a unit's spec stays readable
  on its own and its gate (`rqml check`) is independent of every other unit.
- **Placement decides governance, nothing else.** Where a spec sits in the tree
  determines only *which files it governs*. It never carries information *between*
  specs. Any flow of information across specs — referencing a requirement in
  another spec — is always explicit, via [trace edges and
  URIs](../reference/elements/trace.md), never implied by directory layout.
- **One `.rqml/` per spec, co-located.** A unit's design (ADRs), plan, and drift
  baseline travel with its requirements, so a package is self-describing. ADRs are
  a flat, sequentially-numbered series within each unit's `.rqml/adr/`.
- **A familiar resolution model.** Nearest-wins mirrors `.editorconfig`,
  `tsconfig.json`, and `.gitignore` — there is nothing new to learn about *where*
  configuration applies.

## Working in a monorepo with the tooling

**Resolution is automatic.** Run `rqml` commands from anywhere inside a unit — the
CLI walks up to the governing spec for you. Override it with an explicit spec path,
`--spec <path>`, or `--base-dir <dir>` (which sets where discovery starts).

**Check the whole repository at once.** Workspace mode runs `validate`, `status`,
and `check` across **every** spec beneath the base directory and returns a single
aggregated exit code — non-zero if *any* unit fails. This is the CI entry point:

```bash
rqml check --workspace          # gate every spec in the repo (alias: --all)
rqml check --workspace --ignore examples,fixtures   # skip directories by name
```

Each unit is checked against **its own directory**, so its code links and drift
baseline resolve per-unit.

**From an MCP agent**, the [`@rqml/mcp`](/docs/tooling/mcp) server exposes
`rqml_discover` — given a `root` it enumerates every governing spec (and the
ambiguous directories), and given a `file` it returns the spec that governs it.
The read tools also accept a `file` argument and resolve the governing spec for
you, so an agent never has to know the spec's exact path.

## Cross-spec references and federation

You can reference an artifact declared in **another** spec with an
[`rqml:` endpoint](../reference/elements/trace.md) — a URI to the other document
plus the target `id`, optionally pinned to a `version` or `git` commit:

```xml
<edge id="TR-CROSS" type="dependsOn" from="REQ-PAY-001"
      to="rqml:../auth/requirements.rqml#REQ-AUTH-001;version=1.4;docId=AUTH-001"/>
```

This is valid RQML you can author today. Note, though, that the toolchain
currently validates and enforces coverage **within each spec**; resolving and
checking `rqml:` references *across* specs repo-wide (full federation) is on the
roadmap, not yet enforced by `rqml check`. Treat cross-spec `rqml:` edges as
intentional, human-meaningful links until then.

## Quick reference

| Task | How |
| --- | --- |
| Find the spec governing the current directory | `rqml status` (resolves nearest-wins) |
| Check one unit | `rqml check` from inside that unit |
| Check the whole repo (CI) | `rqml check --workspace` |
| Skip directories in workspace mode | `rqml check --workspace --ignore <names>` |
| List every spec in the repo (agent) | the `rqml_discover` MCP tool |
| Reference another spec's requirement | an [`rqml:` endpoint](../reference/elements/trace.md) |
