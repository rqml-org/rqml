---
id: ci
title: CI guide
sidebar_label: CI guide
sidebar_position: 7
description: How to wire rqml check into CI — a complete GitHub Actions workflow, why a red build is not a gate until you make the check required, and what to do when it fails.
---

# CI guide

RQML is enforced at several points — your editor, your agent, a pre-commit hook,
and CI. This guide covers the last one: wiring `rqml check` into a build, making
that check required, and reading the verdict when it fails.

The short version: **wire `rqml check` into CI, then make that check required.**
A workflow that runs is not a gate — until the check is marked required, a red X
does not stop a merge.

Wire CI first, but do not make it the first place you learn. The same verdict is
available locally in well under a second — `npx --yes @rqml/cli check` — and if
you use an RQML agent plugin, your agent should already be running it before it
ends a turn. Treat a red CI run as a sign the local layer was skipped, not as the
normal way to find problems.

## Before you start

This guide assumes five things. Check each one now — every later step depends on
them.

1. **Your code is on GitHub**, and you can push to it.
2. **You are an admin on the repository** (you can see a Settings tab). Required
   status checks are an admin-only setting.
3. **A spec exists.** `ls requirements.rqml` prints the file. If not, run
   `rqml init` first — see the [Quick start](../quick_start.md).
4. **At least one implementation is linked.** `rqml matrix` lists your code
   links. If its code column is empty everywhere, the gate will pass but is
   protecting nothing yet.
5. **A baseline exists.** `ls .rqml/baseline.json` prints the file. It is created
   by `rqml link`; if it is missing, see [The drift baseline in
   CI](#the-drift-baseline-in-ci) below and create it before continuing.

The terminal commands in the ruleset section also need the [GitHub
CLI](https://cli.github.com) (`gh`), authenticated once with `gh auth login`.
Everything in that section can be done in the web UI instead.

## Why CI is the layer that counts

RQML is enforced at several points, and they are not equivalent. The fast ones
are guardrails; the slow one is the boundary. Fix things in the fast layers; CI
is where you find out you did not.

| Layer | When it runs | Speed | Can it be skipped | What it catches |
| --- | --- | --- | --- | --- |
| Editor save | As you edit `.rqml` | Instant | Yes — a teammate without the extension | Spec validity |
| Agent pre-edit gate | Before an agent writes a file | Instant | Yes — a shell redirect or an MCP writer never fires it | Code implementing a non-approved requirement |
| Agent turn-end gate | When an agent finishes a turn | Under a second | Yes — the agent can end without it, and some hosts have no turn-end hook at all | The full gate |
| Pre-commit hook | `git commit` | Under a second | Yes — `git commit --no-verify`, or a clone where nobody installed the hooks | The full gate |
| **CI** | **Every push and pull request** | **Seconds** | **No — once the check is required** | **The full gate** |

The RQML plugins say this about themselves rather than pretending otherwise: each
describes its in-session enforcement as a best-effort guardrail for fast feedback
and CI as the unconditional backstop.

Three things route around every layer above CI, and all three are ordinary:

- **A teammate who does not use the plugin.** Hooks live in one person's setup.
- **`--no-verify`.** One flag, and the pre-commit hook never runs.
- **A bot.** A formatter, a release bot, or a sync bot commits directly, rewrites
  a baselined file without re-pinning it, and reports success while carrying
  drift the gate would have caught.

## What the gate does

`rqml check` composes four passes into one verdict: XSD validation → referential
integrity → drift → coverage. It is **deterministic** — no language model sits
anywhere in the verdict path, so the same commit always produces the same answer,
which is what makes it safe to require.

For CI specifically, four properties matter:

- **The check is offline; fetching the CLI is not.** The schema is bundled, and
  `rqml check` opens no sockets and never shells out — including to `git`. But
  `npx --yes @rqml/cli@…` does hit the npm registry on a cold runner. Air-gapped
  or behind a proxy, install the CLI from your own registry, or add it to
  `devDependencies` so the gate depends on your lockfile rather than on network
  reachability. On a self-hosted runner, pin Node explicitly rather than
  inheriting the machine's.
- **It needs no git history.** Drift is a hash comparison against a committed
  file, never a diff against a base ref. The default shallow clone — a checkout
  of just the commit under test — is all it needs. Do not copy `fetch-depth: 0`
  from somewhere else on the belief that drift needs history; it does not. Do
  keep the `.git` directory, though: no git binary is ever invoked, but its
  presence is what bounds the upward walk for spec discovery.
- **It writes nothing.** Safe to run before a build, safe in a read-only
  container, and it will never leave a dirty working tree behind.
- **It is fast.** Under a fifth of a second on this project's own ~2,900-line
  spec, so where you put it in the pipeline is a diagnostics decision, not a
  performance one.

**How a command turns into a red X.** Every command reports a number when it ends
— its *exit code*. Zero means success; anything else means failure. CI reads only
that number: a non-zero exit fails the step, a failed step fails the job, and a
failed job turns the status check red. That is the whole mechanism, and it is why
anything that swallows or rewrites the exit code (`|| true`, `continue-on-error`,
an unguarded pipe) turns the gate into decoration while leaving it looking
present.

`rqml check` uses four: `0` pass, `1` validation failure, `2` blocking drift or
coverage, `64` usage error. The authoritative table and the full flag reference
live on the [`@rqml/cli`](../tooling/cli.md#exit-codes) page — this guide is about
wiring and judgement, not flags.

One thing the gate does *not* do: it never evaluates acceptance criteria.
Requirements with none pass `rqml check` at every strictness level.

## A first gate

This is a complete, working file. Create it now — before you set up any branch
rule, because the rule you create later will stop you pushing straight to `main`.

```bash
mkdir -p .github/workflows      # a hidden directory; Finder will not show it
$EDITOR .github/workflows/rqml.yml   # paste the file below
git add .github/workflows/rqml.yml
git commit -m 'ci: add RQML gate'
git push origin main
```

If your default branch is not called `main`, substitute its name here and in the
`branches:` line below.

```yaml
# .github/workflows/rqml.yml
name: RQML

on:
  pull_request:
  merge_group:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  rqml:
    name: rqml
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: '22'
      - name: RQML gate
        run: npx --yes @rqml/cli@0.10.0 check
```

Line by line, assuming nothing:

- **The file location is the configuration.** GitHub runs any YAML file under
  `.github/workflows/`. There is nothing to enable and no dashboard to visit —
  committing the file is what turns it on.
- **`on:` lists the events that start a run.** `pull_request` runs it on every
  pull request; `push: branches: [main]` runs it again after a merge, which is
  the backstop that tells you if `main` ever drifts anyway. `merge_group` is
  required by the merge queue, if you ever enable one — a queue runs checks
  against that event, and a workflow that does not trigger on it never reports,
  leaving entries queued forever.
- **`permissions: contents: read`** is the access token this run gets. Reading
  the repository is everything an RQML gate needs. Note the rule, because it is
  the opposite of most config systems: once you specify *any* permission, every
  one you did not list is set to `none`.
- **`jobs:` holds one job named `rqml`.** A *job* is a batch of *steps* that run
  in order on one machine; a step is a single unit of work — either a prebuilt
  action (`uses:`) or a shell command (`run:`). If any step fails, the job fails.
  **Remember the job name** — it is the string you will type into the branch rule
  later, and renaming it silently disconnects the gate.
- **`runs-on: ubuntu-latest`** picks the *runner* — the fresh virtual machine
  GitHub provisions for the job. Use Linux. Filenames are case-sensitive there,
  which makes it the honest arbiter of whether your trace locators are right.
- **`actions/checkout@v7`** copies your repository onto that machine. Its default
  is a *shallow clone* — just the single commit under test, no history — and that
  is exactly right here.
- **`actions/setup-node@v7`** installs Node. The toolchain requires Node 18.18 or
  newer; pin a version rather than inheriting whatever the runner happens to
  ship. No published RQML package declares an `engines` field, so an old Node
  gives you an opaque crash rather than a clear error.
- **`npx --yes @rqml/cli@0.10.0 check`** downloads and runs the CLI. `--yes`
  suppresses the install prompt, which has no answer on a runner. The **version
  pin is deliberate**: with a floating version, yesterday's green build can go red
  today with no commit in your repository to explain it. `0.10.0` is an example —
  pin whatever the current release is. Bumping the pin then becomes a reviewable
  change, which is the entire point of a deterministic gate.
- **`rqml check` finds the spec by searching the current directory and its parent
  directories** — never its subdirectories. If your spec is not at the repository
  root, set `working-directory:` on the step (or pass `--base-dir <dir>`) to the
  directory that holds it. Getting this wrong is exit `64`,
  `no .rqml document found` — a workflow bug, not a spec problem.

**Check that it ran.** Open your repository on github.com and click the
**Actions** tab at the top. Within a few seconds a run named **RQML** appears with
a yellow dot (running), then a green tick or a red X. Click the run, then click
the job named **rqml** in the left sidebar — that opens the log. Each step is a
collapsible line; click **RQML gate** to expand it and read exactly what
`rqml check` printed. The last line of an expanded step is either nothing
(success) or `Process completed with exit code N` — that N is the exit code the
tables in this guide refer to.

Do not be alarmed if this first run is red. A red X here means the gate is working
and found something — go to [When the gate fails](#when-the-gate-fails).

If the run fails with `Unable to resolve action actions/checkout@vN, unable to
find version vN`, that major does not exist — a version-pin problem, not an RQML
problem. Open the action's releases page, take the newest major, and change the
number. Nothing else in this guide depends on which major you use.

You have a workflow. You do not yet have a gate.

## Adopting on a repo that already has code

Order matters here, and the obvious order is the one that locks you out.

1. **Merge the workflow to `main` first and let it run.** Do not create the
   ruleset yet.
2. **Read the first red run.** Almost every day-one failure on an existing
   repository is `changed-implementation` (code moved on after `rqml link`) or
   `missing-implementation` (files moved). Both are re-pin and repoint work, not
   spec work: `rqml link --refresh <edge-id>` per drifted edge, and
   `rqml link <REQ-ID> <new-path> --update` per moved file. Do this in one
   "baseline the world" pull request, reviewed as such.
3. **Only when the workflow is green on `main` do you create the ruleset.**
   Requiring a check that has never reported green blocks every pull request in
   the repository, including the one that would fix it.
4. **Then prove it blocks**, as below.

The honest ramp is standard now, strict later. There is no supported warn-only
mode for drift at any strictness — the ramp is fixing the links, not weakening the
gate.

## Required status checks

**A workflow that fails does not stop a merge.**

When your job finishes it reports a *status check* — a named pass/fail result
attached to the commit, which GitHub shows as a green tick or a red X in the pull
request's check list. By default that is pure information. The merge button stays
enabled. Somebody clicks it. Nothing in the interface says "blocked", because
nothing is.

To make it block, you add a rule on the branch saying that this named check *must*
pass. GitHub calls the modern version a **ruleset** (Settings → Rules → Rulesets).
The older mechanism, **branch protection**, still works — GitHub has not
deprecated it — but rulesets are where new capability ships, several rulesets can
apply to a branch at once, and they have no implicit exemption for repository
admins. Prefer rulesets.

Two preconditions. You need admin access to the repository — if there is no
**Settings** tab, ask whoever owns it. And on a **private** repository, enforceable
repository rules may require a paid GitHub plan; check GitHub's current plan
documentation. If you cannot make the check required, the pre-commit hook and the
`push:`-triggered run above are your only enforcement.

Run the workflow at least once first, so GitHub knows the check's name exists.
Then:

1. Open your repository on github.com → **Settings** → **Rules** → **Rulesets**.
2. Click **New ruleset** (top right) and choose **New branch ruleset**.
3. **Ruleset Name**: type `Require RQML gate`.
4. **Enforcement status**: set to **Active**. (`Evaluate` looks identical
   afterwards and blocks nothing.)
5. **Bypass list**: leave it empty. Anyone you add here is exempt from the gate.
6. **Target branches**: click **Add target** → **Include default branch**. A line
   reading `Default` appears; that is your `main`.
7. Under **Rules**, tick **Require a pull request before merging**. This expands.
   **Set "Required approvals" to `0`** unless you have reviewers — GitHub does not
   let you approve your own pull request, so leaving it at 1 on a solo repository
   means you can never merge again.
8. Tick **Require status checks to pass**. It expands with an **Add checks**
   button. Click it, type `rqml` in the search box, and **click the `rqml` entry
   in the dropdown** — it only counts once it appears as a row below the button.
   This is why you ran the workflow once first: GitHub lists names it has seen.
9. Still inside that rule, tick **Require branches to be up to date before
   merging**.
10. Click **Create** at the bottom.

You should land back on the Rulesets list with `Require RQML gate` showing
**Active**. That is not proof it works — see [Proving the gate
blocks](#proving-the-gate-blocks). GitHub moves this screen occasionally; if a
label has been renamed, the structure (Ruleset name → Enforcement → Bypass →
Target branches → Rules) is stable.

The same thing from a terminal, which is reproducible and reviewable:

```bash
# Requires the `gh` CLI, authenticated with admin rights on the repository.
# Run the workflow once first, so the check name exists.
gh api --method POST /repos/OWNER/REPO/rulesets --input - <<'JSON'
{
  "name": "Require RQML gate",
  "target": "branch",
  "enforcement": "active",
  "bypass_actors": [],
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "rules": [
    { "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false
      } },
    { "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [ { "context": "rqml" } ]
      } }
  ]
}
JSON
```

Four values in there carry weight:

- **`"enforcement": "active"`** actually blocks. The other setting you will be
  offered is `evaluate`, which looks completely configured in the UI and blocks
  nothing.
- **`"bypass_actors": []`** means nobody is exempt — not admins, not Dependabot.
  Classic branch protection exempts admins *by default*, which for a solo
  maintainer means the gate has never once applied to the only person who commits.
- **`strict_required_status_checks_policy: true`** is "require branches to be up
  to date": the branch must be synchronised with `main` before it merges. For RQML
  this earns its cost, because the spec is shared mutable state — two
  independently green pull requests can produce a drifted `main` that no run ever
  evaluated. On a repository with several pull requests in flight it forces
  serialised update-and-re-run; a merge queue is the scaling answer to that, not
  turning the setting off.
- **The `pull_request` rule** is what forces changes through a pull request at
  all. Without it, a direct push to `main` is not gated by status checks.

### How a required check quietly passes

A required status check is satisfied by a status that is successful, **skipped**,
or neutral. That one word is behind most useless gates.

- **`if:` on the gate job.** A skipped job reports success. Never put a condition
  on the required job — branch inside a step instead, so the job always runs and
  always reports a real verdict.
- **`needs:` on a job that failed.** `needs:` makes one job wait for another; you
  only have this if you split your workflow into several jobs. If you do, and your
  gate job `needs: build` while build fails, the gate is skipped — and therefore
  satisfied. GitHub's own remedy is `if: always()` on the dependent job, plus an
  explicit failure check.
- **`paths:` filters.** Tempting ("only run when `src/**` changed") and wrong in
  both directions. A pull request that edits only `requirements.rqml` — exactly
  the change most likely to break coverage — skips the gate entirely; and a
  workflow skipped by a path filter produces no check at all, leaving the pull
  request stuck at "Expected — waiting for status to be reported" forever.
  GitHub's guidance is explicit: avoid requiring workflows that can be skipped.
- **`continue-on-error: true` or `|| true`.** These make the step fail and the job
  report success. Usually added "just until we clean up the spec" and then never
  removed. See [Choosing a strictness level](#choosing-a-strictness-level) for the
  honest alternative.
- **A pipe.** GitHub's default shell for a `run:` block is `bash -e {0}` — with
  errexit but **no pipefail**. So `rqml check | tee summary.txt` reports the exit
  code of `tee`, which is always `0`. Add `shell: bash` to the step — GitHub runs
  that with `-eo pipefail`, so the first failing command in the pipe wins.

### Proving the gate blocks

The only way to know you have a gate is to try to get past it.

```bash
git switch -c prove-the-gate-blocks

# Pick any file an `implements` edge points at — `rqml matrix` lists them in its
# code column. Appending a comment produces exactly one `changed-implementation`
# finding at every strictness level, and cannot accidentally break the spec's XML
# instead.
echo '// intentional drift — proving the gate blocks' >> src/your/linked/file.ts

git commit -am 'temp: prove the RQML gate blocks merges'
git push -u origin prove-the-gate-blocks
gh pr create --fill     # or open the pull request in the web UI
```

Three things must be true on that pull request: the `rqml` check **ran** and is
**red**, the merge box says merging is **blocked** with the button disabled, and
the reason is readable within one click. A grey "Skipped" means a condition is
short-circuiting the job. No check at all means a path filter, or the workflow
never triggered. A pull request stuck at "Expected — waiting for status to be
reported", with no red X to explain it, means the required check name does not
match any job that reports. Red but mergeable means the check is not required — go
back and fix the ruleset.

**Clean up.** Do not merge this pull request. Close it
(`gh pr close prove-the-gate-blocks --delete-branch`), then `git switch main &&
git branch -D prove-the-gate-blocks` locally.

To make the reason readable without expanding a log step, capture the verdict and
write it to the run summary. Replace the gate step with these two:

```yaml
      - name: RQML gate
        shell: bash          # `-eo pipefail`, so the gate's exit code survives the pipe
        run: npx --yes @rqml/cli@0.10.0 check | tee rqml.out
      - name: Publish the verdict
        if: always()         # also publish it when the gate failed
        run: |
          { echo '### RQML gate'; echo '```'; cat rqml.out; echo '```'; } \
            >> "$GITHUB_STEP_SUMMARY"
```

### When you must ship anyway

First check whether you actually need a bypass. A red RQML gate is usually one
`rqml link --refresh <edge-id>` plus a commit — seconds, not a debugging session.
Bypassing costs more than fixing.

If you genuinely must, do not delete the rule and do not flip Enforcement to
`evaluate`; both are easy to forget re-enabling, and they silently ungate
everything. Add yourself to `bypass_actors` temporarily, merge, remove yourself,
and open a follow-up issue. This is also why the workflow runs on
`push: branches: [main]`: a bypassed merge still turns `main` red, so the debt is
visible rather than invisible.

## The drift baseline in CI

`rqml link` records a drift baseline (see [Drift
baselines](../tooling/cli.md#drift-baselines)). What CI adds is a way to notice
when it is missing.

Each `rqml link` — and each `rqml link --refresh` — records a sha256 hash of the
one file it just linked into `.rqml/baseline.json`; the file accumulates one entry
per `implements` edge. That file is what lets `check` tell you code *changed*.
Without it, drift detection silently falls back to "does this file still exist",
and a rewritten implementation sails through green.

There is no warning for this. No note, no non-zero code, no hint in the output —
a missing file, an unreadable file, and invalid JSON all look identical to "this
project has no baseline". It is the single highest-impact CI pitfall, precisely
because the build looks like it is protecting you.

```bash
# Run these from the directory that contains requirements.rqml.
git add requirements.rqml .rqml/baseline.json   # always stage these two together

git ls-files .rqml/baseline.json
# Good: prints `.rqml/baseline.json`.
# Bad:  prints nothing — the file is not staged or does not exist. Run `rqml link`
#       to create it, then repeat the `git add` above.

git check-ignore -v .rqml/baseline.json
# Good: prints nothing at all.
# Bad:  prints a line like `.gitignore:12:.rqml/`. That line number is the rule
#       hiding your baseline from git — delete it from .gitignore and re-run.

git commit -m 'chore: commit RQML baseline'
```

Every repository in the RQML ecosystem that uses the gate commits its baseline,
and none of them gitignores it. Two consequences worth knowing:

- **The baseline is read from the spec's own directory**, always
  `<dir containing the spec>/.rqml/baseline.json` — never from the working
  directory. That is a good property (the verdict is the same wherever CI runs
  from), but it also means `rqml link` run from a package subdirectory writes an
  orphaned baseline the gate will never read. Run `link` from the directory that
  holds the spec.
- **Only `implements` edges are hashed.** A `verifiedBy` edge to a test file gets
  no baseline entry and is never drift-checked. Test linkage is enforced
  structurally — "a test link exists" — through the coverage classes at `strict`,
  not by content.

Because the failure is silent, make it loud yourself. Open
`.github/workflows/rqml.yml` and add the assertion directly above the gate step.
The `- name:` must line up in the same column as the steps around it — YAML
rejects the file outright if the indentation is off, and the Actions tab shows it
as `Invalid workflow file`. Your `steps:` block should end up reading:

```yaml
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: '22'

      - name: Drift baseline is committed
        run: |
          test -s .rqml/baseline.json || {
            echo '::error::.rqml/baseline.json is missing — rqml check cannot detect changed code'
            exit 1
          }

      - name: RQML gate
        run: npx --yes @rqml/cli@0.10.0 check
```

That guard is the single-spec version; see [Monorepos](#monorepos) for the
per-unit form.

## Choosing a strictness level

Two different things are called strictness. The [Development
Process](../development-process/index.md) describes *process* strictness — how
much ceremony your agents are expected to follow. This section is about *gate*
strictness: what `rqml check` blocks on. They share the four level names and
nothing else.

For `rqml check` there are only **two distinct behaviours**:

| Level | What `rqml check` blocks on |
| --- | --- |
| `relaxed` | Validation · integrity · drift |
| `standard` (default) | Identical to `relaxed` |
| `strict` | The above, plus five coverage classes |
| `certified` | Identical to `strict` |

Two consequences fall out of that table:

**Drift blocks at every level, including `relaxed`.** Picking `relaxed` to "not be
gated yet" does not work — changed or missing implementation code fails the build
regardless. Relaxed is not an off switch.

**Choosing between `strict` and `certified` for CI is choosing nothing.** The
findings, the exit code and the blocking behaviour are identical; the only
difference is the level named in the verdict line and in the `strictness` field of
`--json`.

The five coverage classes that `strict` adds, and only these five, are: a goal
with no requirement satisfying it · a requirement with no verification edge · a
requirement that satisfies nothing · an **approved** requirement with no
implementation · an `implements` edge pointing at a requirement that is not yet
approved. Anything not on that list will not block.

**Gate strictness comes only from the flag.** `rqml init` writes a
`## Strictness: standard` heading into your `AGENTS.md` — that declares process
strictness for your agents, and `rqml check` never reads it back. There is no
config file and no environment variable. Editing that heading to `strict` leaves
CI running at `standard`, silently. If you want strict in CI, pass
`--strictness strict`.

### From standard to strict

Nobody can start at `strict`. The starter spec `rqml init` scaffolds fails it out
of the box — one draft requirement, no goals, no trace edges, three coverage
findings. And `rqml check` has no way to scope itself to the files a pull request
touched, so adopting RQML mid-project surfaces the entire backlog in one run.

The RQML repositories disagree with each other on purpose. Some run two steps —
`rqml check`, then `rqml check --strictness strict` — and pass both. Others,
including the toolchain's own repository, run the standard gate only and do not
yet pass strict. A reader who cannot pass strict is in the same position as the
reference implementation, not behind it.

**Do not reach for `|| true` or `continue-on-error`.** Both make a failing gate
report success, which is worse than no gate — it is a gate everyone trusts and
nobody has. The honest version is two jobs: one required, one advisory.

```yaml
# .github/workflows/rqml.yml
name: RQML

on:
  pull_request:
  merge_group:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  # REQUIRED. Never weakened, never conditional, no `|| true`.
  rqml:
    name: rqml
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: '22'
      - run: npx --yes @rqml/cli@0.10.0 check

  # NOT required. Shows the backlog without lying about the gate. When this is
  # reliably green, raise the job above to --strictness strict and delete this.
  rqml-strict:
    name: rqml (strict, advisory)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: '22'
      - run: npx --yes @rqml/cli@0.10.0 check --strictness strict
```

A job is advisory purely by omission — you do nothing. Do **not** add
`rqml (strict, advisory)` to the ruleset's required-checks list; it will be offered
in the same dropdown as `rqml`, and adding it is how people accidentally block
themselves on the backlog they meant only to observe. Expect a permanent red X for
that job on every pull request until the backlog is cleared. It is correct and it
blocks nothing — GitHub still shows `All checks have passed` for the merge box as
long as `rqml` is green, because only required checks gate the merge.

One caveat while you sit at `standard`: coverage findings are not merely
non-blocking there, they are **suppressed from the output entirely**. A green
`standard` run tells you nothing about how far you are from strict. Use
`rqml status`, `rqml matrix`, or `rqml check --json` — whose `coverage` object is
fully populated at every strictness level, and is `null` only when the spec fails
to parse — to see the debt you are paying down.

## A complete workflow

Everything above, in one realistic file for a repository that also builds and
tests. **It replaces `.github/workflows/rqml.yml`** — delete that file in the same
commit, or the gate runs twice. The job is still named `rqml`, so a ruleset you
already created needs no change.

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
  merge_group:
  push:
    branches: [main]

# Everything an RQML gate needs. Any scope not listed becomes `none`.
permissions:
  contents: read

# A new push cancels the run it supersedes, instead of racing it.
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  rqml:
    # This name is what the branch ruleset requires. Treat it as a public API:
    # renaming it disconnects the gate without any warning.
    name: rqml
    runs-on: ubuntu-latest

    # No `if:` on this job, ever — a skipped job reports SUCCESS to a required
    # status check, which turns the gate into a no-op that looks green.
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: '22'
          cache: npm

      - run: npm ci
      - run: npm run lint
      - run: npm run build
      - run: npm test

      # Without this file, `rqml check` cannot detect changed code — and says so
      # nowhere. Fail loudly rather than passing blindly.
      - name: Drift baseline is committed
        run: |
          test -s .rqml/baseline.json || {
            echo '::error::.rqml/baseline.json is missing — rqml check cannot detect changed code'
            exit 1
          }

      # Runs after the tests on purpose: a change that breaks a test usually also
      # drifts the file it touched, and you want the test failure read first.
      - name: RQML gate
        run: npx rqml check
```

**The four `npm` lines are a placeholder for your project's build.** Delete any
script you do not have — `npm run lint` fails with `Missing script: "lint"` if
your package.json has no `lint` script. If your repository has no
`package-lock.json`, remove both `cache: npm` and `npm ci` as well; `cache: npm`
fails the run with `Dependencies lock file is not found`. If you use pnpm or yarn,
swap in your own setup step. Only the last two steps are part of this guide.

Two choices in there are deliberate:

**The gate runs last.** It costs a fifth of a second, so this is not about speed. A
pull request that genuinely breaks a test has usually also changed a baselined
file. If the gate fires first, the developer sees `changed-implementation`, spends
their time re-pinning a baseline, and ends up blessing drift onto broken code.
Correctness failures should surface before process failures. The RQML repositories
order it this way.

**Pin the CLI in your lockfile, not in the `run:` line.** This workflow assumes
`@rqml/cli` is in your `devDependencies`, which is why its gate step is a bare
`npx rqml check` after `npm ci`. That is the recommended setup rather than a
footnote. The spec's XML namespace is versioned and the schemas ship inside the
CLI, so a newer local CLI — or a `rqml migrate` run — can produce a spec that a
pinned older CI CLI refuses to parse, and the fix would live in the workflow file,
which is the last place anyone looks. One version in the lockfile governs the
gate, your contributors, and Dependabot's update pull requests at once; nothing
updates a version string embedded in a `run:` command.

One warning if you link your workflow file to a requirement: editing `ci.yml` trips
`changed-implementation` on the very next run. Re-pin it in the same commit with
`rqml link --refresh <edge-id>`, or do not link the workflow at all.

## Bots and fork pull requests

- **A bot pull request that trips `changed-implementation` is a legitimate
  finding** — the code really did change. Either give the bot a re-pin step, or
  accept that a human re-pins and merges. Do not add the bot to `bypass_actors`;
  that exempts it from every rule, not just this one.
- **Keep the `pull_request` event for forks.** It checks out the fork's head,
  which is the code being proposed, and the gate needs no secrets, so the
  restricted token costs nothing. Never switch to `pull_request_target` to "make
  forks work": it checks out the base branch, so the gate passes on code the pull
  request does not contain.
- **First-time contributors' workflows need "Approve and run".** Until a
  maintainer clicks it, the required check is pending, not failing.

## Monorepos

A bare `rqml check` resolves exactly one governing spec — the nearest one — and
reports green while every sibling package goes unchecked. The CI entry point for a
repository with several specs is workspace mode:

```bash
rqml check --workspace                              # every spec, one exit code
rqml check --workspace --ignore examples,fixtures   # skip directories by name
```

Three things to know before you put that in a workflow:

- **`--workspace` takes no argument.** `rqml check --workspace .` parses `.` as
  the flag's *value*, silently disables workspace mode, and checks one spec. Set
  the root with `--base-dir` instead. A real workspace run always ends with a
  `workspace check: N spec(s)` line — `✓` when it passed, `✗` with a failing or
  ambiguous count when it did not — or, under `--json`, a top-level `units` array.
  If neither is there, it did not happen.
- **`--ignore` matches directory base names**, not paths and not globs.
  `--ignore build` works; `--ignore apps/web/build` does nothing. Discovery has no
  gitignore awareness, so a directory of example specs — or a build-output copy of
  one — becomes an *ambiguous directory* and fails the whole run with exit `2` even
  when every real spec passed. The one-line fix is usually to rename one file in
  that directory to `requirements.rqml`.
- **A workspace run that finds zero specs exits 0.** Single-spec mode is fail-safe
  here (no spec found is a usage error, exit `64`); workspace mode is fail-open.
  Assert a minimum in a separate step that does not pipe the gate itself:

```yaml
      - name: RQML gate (all specs)
        shell: bash          # gives you `-eo pipefail`, so the gate's exit code survives the pipe
        run: npx rqml check --workspace --json | tee rqml.json

      - name: At least one spec was found
        run: jq -e '.units | length > 0' rqml.json

      - name: Every spec has a committed baseline
        run: |
          jq -r '.units[].path | "\(.|sub("/[^/]+$";""))/.rqml/baseline.json"' rqml.json \
            | while read -r f; do test -s "$f" || { echo "::error::missing $f"; exit 1; }; done
```

The `shell: bash` line is load-bearing: without it the pipe throws away
`rqml check`'s exit code and the gate reports success no matter what it found.
`jq` is preinstalled on GitHub's `ubuntu-latest` runners; on other providers you
may need to install it.

Each unit is checked against its own directory, so **every package needs its own
committed `.rqml/baseline.json`** — which is what the last step above asserts. See
the [Monorepo guide](../monorepo/index.md) for how RQML decides which spec governs
which file.

## When the gate fails

**What a failure looks like.** Expand the `RQML gate` step in the Actions tab and
you will see lines like:

```text
  error (drift) [changed-implementation]: implements edge "E-IMPL-CLI-CHECK-GATE" points at "packages/cli/src/commands/check.ts", which has changed since approval.
✗ check fail (standard) — /home/runner/work/repo/repo/requirements.rqml
```

The name in square brackets is the finding type — that is what the table below is
keyed on. `E-IMPL-CLI-CHECK-GATE` is the **edge id**: the identifier of one trace
link, and what `rqml link --refresh` takes. A **requirement id** like
`REQ-CHECK-GATE` is a different thing, and is what `rqml link <REQ-ID> <path>
--update` takes; passing one where the other is expected exits `64`. `rqml matrix`
lists every code link if you need to look one up.

| What you see | What it means | What to do |
| --- | --- | --- |
| Schema or well-formedness errors, exit `1` | The spec failed the XSD, or could not be parsed | Fix the spec. **Referential integrity** was not evaluated this run — it only runs once the XSD passes — so expect a second round. Drift and coverage still ran and are reported alongside, unless the XML is not well-formed, in which case nothing beyond the parse error is evaluated |
| `unresolved-local-ref`, duplicate id, bad `rqml:` locator, exit `1` | Referential integrity: an id that does not exist, or two that clash | Fix the reference. These live in code, not the XSD — your editor's XML validator will not catch them |
| `missing-implementation`, exit `2` | An `implements` edge points at a file that is not there | The file moved: `rqml link <REQ-ID> <new-path> --update`. Or check the path's *case* — CI is case-sensitive even if your laptop is not |
| `changed-implementation`, exit `2` | Linked code no longer matches the hash recorded when it was linked | Unintentional: fix the code or negotiate a spec change. Intentional: `rqml link --refresh <edge-id>`, and commit the baseline in the same pull request |
| `unverified-requirement`, `strict` only | A requirement has no verification edge | `rqml link <REQ-ID> ./<test-path> --type verifiedBy` — the leading `./` is required, or a bare filename is read as an artifact id |
| `uncovered-goal`, `strict` only | A goal or quality goal that no requirement satisfies | Add a `satisfies` edge, or drop the goal |
| `orphan-requirement`, `strict` only | A requirement with no outgoing `satisfies` edge to a goal, quality goal, scenario, misuse case, or edge case | Add a `satisfies` edge to one of those — no other edge type clears it — or reconsider why the requirement exists |
| `premature-implementation`, `strict` only | An `implements` edge points at a requirement that is not approved | Approve the requirement (`rqml approve <id>`) or stop implementing it |
| `unimplemented-requirement`, `strict` only | A requirement with no `implements` edge. It blocks only when the requirement's `status="approved"` — but the printed rule is identical either way | Check the requirement's status (or the `unimplementedApprovedRequirements` array in `--json`) before deciding it is noise. Approved: implement and link it, or move it back to `draft`. Not approved: nothing to do |
| `✗ ambiguous spec directory`, exit `2` | Workspace mode found a directory with several `*.rqml` files and no `requirements.rqml` | Rename one to `requirements.rqml`, or `--ignore` that directory by base name |
| exit `64` | You invoked the command wrong | A workflow bug, not a spec problem. Note that a *bad flag value* fails loudly like this, but an **unknown flag name is silently ignored** — `--strictnes strict` runs `standard` and exits 0 |

Two habits make this table rarely necessary. First, never hand-edit
`.rqml/baseline.json`, and never delete it to make CI green — deleting it works
instantly and permanently disarms changed-code detection for every edge in the
spec. `rqml link --refresh` is edge-scoped on purpose: nothing else is re-hashed,
so unrelated drift is never blessed along the way. Second, read the failing verdict
line, which always names the effective level and the spec it judged —
`✗ check fail (strict) — <path to the spec>`. If it says `(standard)` when you
asked for strict, you have a typo in the flag name, not a coverage problem.

Human and JSON output both go to **stdout**, even on failure. Two exceptions in
`--workspace` mode: the `ambiguous spec directory` lines and the trailing
`failing:` list go to stderr, as do usage errors (exit `64`). Capture both streams.

## Other CI systems

Nothing above is GitHub-specific except the branch ruleset, the
`permissions:`/`concurrency:` blocks, and the `::error::` annotation — on other
providers, drop the `::error::` prefix and just `echo` the message. The
provider-neutral contract is four lines:

```bash
# 1. the working tree at the commit under test (a shallow clone is fine, but keep .git)
# 2. Node >= 18.18 on PATH
# 3. .rqml/baseline.json present in that checkout
# 4. run the gate and let its exit code stand
npx --yes @rqml/cli@0.10.0 check
```

No git binary, no service containers, no credentials, and no need to install your
project's dependencies — the gate does not build or test your code.

```yaml
# .gitlab-ci.yml
rqml-check:
  image: node:22
  script:
    - npx --yes @rqml/cli@0.10.0 check
```

GitLab's equivalent of a required status check is a project setting, not a CI
keyword: Settings → Merge requests → Merge checks → **Pipelines must succeed**.

```yaml
# .circleci/config.yml
version: 2.1

jobs:
  rqml-check:
    docker:
      - image: cimg/node:lts
    steps:
      - checkout
      - run: npx --yes @rqml/cli@0.10.0 check

workflows:
  gate:
    jobs:
      - rqml-check
```

```yaml
# azure-pipelines.yml
trigger:
  - main

pool:
  vmImage: ubuntu-latest

steps:
  - task: UseNode@1
    inputs:
      version: '22.x'
  - script: npx --yes @rqml/cli@0.10.0 check
    displayName: RQML gate
```

Whatever the provider, two rules carry over unchanged. Run the gate job on Linux:
drift hashes raw file bytes, so a Windows runner that converted line endings on
checkout reports every edge as `changed-implementation` on a commit that changed
nothing. And never reach for the keyword that neuters the gate while leaving it
visibly present — GitLab's `allow_failure: true`, Azure's `continueOnError: true`,
a Jenkins `catchError`, or a bare `|| true`.

## Quick reference

| Task | How |
| --- | --- |
| Gate one spec | `npx rqml check` |
| Gate every spec in a monorepo | `npx rqml check --workspace` |
| Add coverage enforcement | `--strictness strict` (`certified` is identical) |
| Make CI actually block a merge | a ruleset requiring the **job** name, Enforcement `Active`, empty bypass list |
| Prove the gate blocks | open a pull request that drifts a linked file on purpose |
| Stop drift passing silently | commit `.rqml/baseline.json`; assert it exists before the gate |
| Bless an intentional code change | `rqml link --refresh <edge-id>` |
| Repoint a moved implementation | `rqml link <REQ-ID> <new-path> --update` |
| Look up an edge id | `rqml matrix` |
| See coverage debt without blocking | `rqml status`, `rqml matrix`, or `rqml check --json` |
| Understand a verdict | [Exit codes](../tooling/cli.md#exit-codes) |

Where to next: [`@rqml/cli`](../tooling/cli.md) for the full command reference, the
[Monorepo guide](../monorepo/index.md) for a repository with several specs, or the
[Development Process](../development-process/index.md) for where the gate sits in
the five stages.
