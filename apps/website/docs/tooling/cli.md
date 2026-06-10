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

  init [path]        Scaffold a starter spec and an AGENTS.md project marker
  validate [path]    XML well-formedness, XSD, and referential integrity
  status [path]      Spec summary: requirement count, coverage, lint findings
  check [path]       Deterministic enforcement gate (validation + coverage + drift)
  link <id> <uri>    Record an implements/verifiedBy trace edge and its drift baseline
  show <id>          One artifact: statement, acceptance criteria, trace neighborhood
  impact <id>        What is affected, transitively, if this artifact changes
  skeleton <kind>    Print a schema-valid snippet (req | edge | testCase | stateMachine)
```

When no path is given, the lone `*.rqml` document in the working directory is used
(preferring `requirements.rqml`).

## Options

| Flag | Meaning |
|------|---------|
| `--json` | Emit machine-readable JSON (for `status`, `check`, `validate`, `link`, `show`, `impact`) — for control loops and editor hooks |
| `--strictness <level>` | `relaxed` · `standard` (default) · `strict` · `certified` — how aggressively `check` gates |
| `--base-dir <dir>` | Directory to resolve the spec and `implements` code links against |
| `--spec <path>` | Explicit spec file for `link`, `show`, and `impact` (whose positional argument is an artifact id, not a path) |
| `--type <type>` | Link type: `implements` (default) · `verifiedBy` |
| `--id <id>` | Explicit edge id for `link`, or the root id for `skeleton` |
| `--kind`, `--title` | Optional locator hints recorded on the edge by `link` |

## The agent loop

`validate` and `check` guard the *ends* of a spec-first task. The loop commands
serve the middle — choosing work, reading one artifact, and recording what was
done — so an agent (or a human) never has to hold the whole document in view or
hand-edit trace XML:

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

`skeleton` exists so nobody hand-rolls invalid structure:

```bash
rqml skeleton req --id REQ-PAY-002    # a ready-to-fill <req> with acceptance criteria
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
rqml init                       # scaffold requirements.rqml + AGENTS.md
rqml validate                   # is the spec structurally valid?
rqml status --json | jq .       # coverage/lint summary as JSON
rqml show REQ-PAY-001           # one requirement as markdown (add --json for data)
rqml impact GOAL-CHECKOUT       # everything that traces to/from this goal, transitively
rqml link REQ-PAY-001 src/payments/capture.ts#capture
rqml skeleton stateMachine      # a valid lifecycle snippet to fill in
rqml check --strictness strict  # CI gate
```
