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

  init [path]        Scaffold a starter spec and merge the RQML block into AGENTS.md
  validate [path]    XML well-formedness, XSD, and referential integrity
  status [path]      Spec summary: requirement count, coverage, lint findings
  check [path]       Deterministic enforcement gate (validation + coverage + drift)
  link <id> <uri>    Record an implements/verifiedBy trace edge and its drift baseline
                     (--update repoints an existing edge; --refresh <edge-id>
                     re-records only the baseline for an intentional change)
  show <id>          One artifact: statement, acceptance criteria, trace neighborhood
  impact <id>        What is affected, transitively, if this artifact changes
  overview [path]    Readable spec projection (whole, or --section/--id scoped)
  matrix [path]      Traceability matrix: status, goals, code, tests, coverage gaps
  approve <id>       Transition a requirement's status (--status, default approved)
  gate [paths...]    Block implementation of non-approved requirements (exit 2)
  skeleton <kind>    Print a schema-valid snippet (req | edge | testCase | stateMachine)
```

When no path is given, `rqml` resolves the **governing spec** by walking up from the
working directory to the nearest `*.rqml` (preferring `requirements.rqml`), stopping
at the repository root — so commands work from anywhere inside a project unit. A
directory with several `*.rqml` files and no `requirements.rqml` is reported as
ambiguous. In a repository with multiple specs, see the
[Monorepo guide](/docs/monorepo).

## Options

| Flag | Meaning |
|------|---------|
| `--json` | Emit machine-readable JSON (for `status`, `check`, `validate`, `link`, `show`, `impact`, `matrix`) — for control loops and editor hooks |
| `--strictness <level>` | `relaxed` · `standard` (default) · `strict` · `certified` — how aggressively `check` gates |
| `--base-dir <dir>` | Where spec discovery starts (and the `--workspace` root); code links resolve against the spec's own directory |
| `--workspace`, `--all` | Run `validate` / `status` / `check` across every spec in the repository, with one aggregated exit code (non-zero if any unit fails) — see the [Monorepo guide](/docs/monorepo) |
| `--ignore <names>` | Comma-separated directory names to skip during `--workspace` discovery |
| `--spec <path>` | Explicit spec file for `link`, `show`, and `impact` (whose positional argument is an artifact id, not a path) |
| `--type <type>` | Link type: `implements` (default) · `verifiedBy` |
| `--id <id>` | Explicit edge id for `link`, or the root id for `skeleton` |
| `--kind`, `--title` | Optional locator hints recorded on the edge by `link` (preserved on `--update` unless re-stated) |
| `--update` | For `link`: replace the external locator of the *existing* edge — matched by `--id` or the derived id — instead of appending, and re-record its baseline entry |
| `--refresh <edge-id>` | For `link`: re-record the drift baseline for one intentionally changed artifact; the spec file is not touched |

## The agent loop

`validate` and `check` guard the *ends* of a spec-first task. The loop commands
serve the middle — choosing work, reading one artifact, and recording what was
done — so an agent (or a human) never has to hold the whole document in view or
hand-edit trace XML. This is the **Code** and **Verify** half of the
[five-stage development process](../development-process/index.md):

```bash
rqml show REQ-PAY-001                                  # read the requirement: statement,
                                                       # acceptance criteria, trace neighborhood
rqml impact REQ-PAY-001                                # blast radius before touching anything
# … implement …
rqml link REQ-PAY-001 src/payments/capture.ts#capture # record the implements edge
rqml link REQ-PAY-001 test/capture.test.ts --type verifiedBy
rqml check                                             # the gate — must exit 0
```

`link` is the workhorse:

- It appends a schema-valid edge **textually**, before `</trace>` — XML comments
  and hand formatting in the spec survive untouched.
- It writes the file **only if the edited document still validates**; otherwise
  nothing changes.
- It derives a deterministic edge id (`REQ-PAY-001` → `E-IMPL-PAY-001`); pass
  `--id` to override.
- For `implements` links it records a **drift baseline**: a content hash of the
  linked artifact, stored in `.rqml/baseline.json` (commit it — see below).
- It also **maintains** links as they age: `--update` repoints the existing edge
  in place — same id, same orientation, only the locator changes — and
  `--refresh <edge-id>` re-blesses one artifact's baseline without re-stating
  the URI (see [Drift baselines](#drift-baselines)).

`skeleton` exists so nobody hand-rolls invalid structure:

```bash
rqml skeleton req --id REQ-PAY-002    # a ready-to-fill <req> with acceptance criteria
```

`matrix` is the spec-health view: one row per requirement with its status, the
goals it satisfies, the code that implements it, the tests that verify it, and
any coverage warnings — derived from the same coverage pass as `check`, as a
markdown table or `--json`, and filterable by `--status` / `--type` / `--warning`:

```bash
rqml matrix --warning unverified      # requirements still lacking a test
```

## The `check` gate

`rqml check` is the deterministic enforcement gate. It composes XSD + integrity
validation, trace coverage, and implementation drift into a single pass/fail
verdict, and exits **non-zero** only when the document is invalid or has blocking
drift/coverage. Coverage findings block at `strict` and `certified` — including
the lifecycle-aware ones: **approved** requirements with no `implements` link,
and `implements` edges that point at a requirement that is *not yet* approved
(premature implementation).

Integrity validation also covers state machines: an unresolved `initial` state,
a dangling transition endpoint, or an outgoing transition from a `final` state
fails validation at every strictness level.

Because it invokes no language model, the verdict is reproducible — which is what
makes it safe to wire into a save hook, a pre-commit hook, or CI.

```bash
rqml check --strictness strict
echo $?            # 0 = pass
```

### Drift baselines

`rqml link` records a sha256 hash of each linked artifact in
`.rqml/baseline.json`. When that file exists, `check` reports a linked artifact
as **changed** — its content no longer matches the hash recorded at link time —
in addition to **missing**. Commit the baseline so CI catches both:

```bash
rqml link REQ-PAY-001 src/payments/capture.ts   # writes the edge + the baseline entry
git add requirements.rqml .rqml/baseline.json
# later, someone edits capture.ts without touching the spec…
rqml check                                       # ✗ changed-implementation, exit 2
```

When the failure is *unintentional* drift, fix the code or the spec. When the
change is **intentional** — the implementation was legitimately revised, or it
moved — bless it explicitly instead of hand-editing the trace XML or the
baseline file:

```bash
rqml link --refresh E-IMPL-PAY-001                       # content changed: re-record this edge's hash
rqml link REQ-PAY-001 src/payments/charge.ts --update    # artifact moved: repoint the edge + baseline
rqml check                                               # ✓ exit 0
```

Both forms are deliberately **edge-scoped**: nothing else is re-hashed, so
unrelated drift is never silently blessed along the way.

Without a baseline, drift detection falls back to existence checks only.

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
rqml init                       # scaffold requirements.rqml + merge the RQML block into AGENTS.md
rqml validate                   # is the spec structurally valid?
rqml status --json | jq .       # coverage/lint summary as JSON
rqml show REQ-PAY-001           # one requirement as markdown (add --json for data)
rqml impact GOAL-CHECKOUT       # everything that traces to/from this goal, transitively
rqml link REQ-PAY-001 src/payments/capture.ts#capture
rqml link --refresh E-IMPL-PAY-001   # bless an intentional change to linked code
rqml skeleton stateMachine      # a valid lifecycle snippet to fill in
rqml check --strictness strict  # CI gate
```
