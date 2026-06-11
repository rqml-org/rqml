---
id: quick-start
title: Quick-start
sidebar_label: Quick start
sidebar_position: 2
---

# Quick start

Five minutes from empty repo to a spec your agent works from and your CI
enforces.

## 1. Scaffold

```bash
npx @rqml/cli init
```

This creates two files in your project root:

- **`requirements.rqml`** — a minimal, valid spec (a `meta` section and one
  example requirement). This file is about to become the source of truth for
  what your system does.
- **`AGENTS.md`** — the process contract for coding agents: the spec-first
  workflow, the toolchain commands, and your project's **strictness level**
  (`relaxed` · `standard` · `strict` · `certified`). Adjust the strictness to
  taste; everything else works out of the box.

Prefer writing the file by hand? A useful document fits in 15 lines — see the
[reference](/docs/reference) for the document model.

## 2. Write requirements

Draft with your coding agent (that's the point), but hold the output to a
standard:

- one atomic, testable statement per `<req>`, using RFC 2119 keywords
  (SHALL / SHOULD / MAY),
- acceptance criteria (given/when/then) on anything verifiable,
- `status="draft"` until a human approves — only approved requirements should
  drive implementation.

Two commands keep this honest:

```bash
rqml skeleton req   # emits a schema-valid <req> snippet to fill in
rqml validate       # XSD + referential integrity — offline, instant
```

## 3. Develop in the loop

This is the daily rhythm, for humans and agents alike:

```bash
rqml show REQ-PAY-001        # read one requirement: statement, acceptance, traces
rqml impact REQ-PAY-001      # what is affected, transitively, if it changes?
# … implement …
rqml link REQ-PAY-001 src/payments/capture.ts          # record the implements edge
rqml link REQ-PAY-001 test/capture.test.ts --type verifiedBy
rqml check                   # the gate: validation + coverage + drift
```

`rqml link` does more than write a trace edge: it records a content hash of the
linked file in `.rqml/baseline.json` (commit it). From then on, `rqml check`
fails not only when linked code is *deleted* but when it *changes* without the
spec changing — that's drift detection, and it's a pure function of your repo:
no language model is involved in any verdict.

## 4. Gate CI

```yaml
# .github/workflows/ci.yml
- name: RQML gate
  run: npx @rqml/cli check --strictness standard
```

Exit codes are stable and documented: `0` pass · `1` validation failure ·
`2` blocking drift or coverage · `64` usage error. Because the same engine runs
locally, in your agent's hooks, and in CI, the verdicts never disagree.

## Recommended tooling

- **[Claude Code plugin](https://github.com/rqml-org/rqml-claude)** — turns the
  loop from documented into *enforced*: every session starts anchored on your
  spec, every `.rqml` edit is validated in the same turn, and the session
  cannot end until `rqml check` passes. Bundles the MCP tools and an RQML
  authoring skill.

  ```text
  /plugin marketplace add rqml-org/rqml-claude
  /plugin install rqml@rqml
  ```

  (The hooks need the CLI: `npm install -g @rqml/cli`.)

- **[@rqml/mcp](/docs/tooling/mcp)** — for any MCP-capable agent: eight tools
  (`rqml_show`, `rqml_impact`, `rqml_link`, `rqml_check`, …) backed by the same
  engine as the CLI. Point tools at the spec by `path` — no pasting documents
  into tool calls.

- **[VS Code extension](https://marketplace.visualstudio.com/items?itemName=rqml.rqml-vscode)** —
  first-class editor support for `.rqml`: authoring help, real-time validation,
  spec browsing and export.

- **[RQML Agent Skill](https://github.com/rqml-org/rqml-skill)** — authoring
  guidance for other skill-compatible agents that don't run the Claude Code
  plugin.

## About AGENTS.md

`rqml init` writes the current template for you; you can also download it
directly: <a href="/AGENTS.md" target="_blank">AGENTS.md template</a>. It
covers:

- **Strictness levels** — how aggressively the gate blocks, from `relaxed`
  (advisory) to `certified` (audit-grade traces)
- **The spec-first workflow** — Elicit → Specify → Implement → Verify → Trace,
  expressed as toolchain commands
- **The divergence protocol** — what to do when code and spec disagree (never
  silently change the spec to match the code)
- **A change-summary template** for PRs and commits

Where to next: the [User guide](/docs/user-guide) for writing good
requirements, [Tooling](/docs/tooling) for the full CLI/engine/MCP reference,
or the [Reference](/docs/reference) for every element and attribute.
