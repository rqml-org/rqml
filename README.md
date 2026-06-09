<p align="center">
  <img src="https://rqml.org/img/RQML_logo_transparent.png" alt="RQML Logo" width="280">
</p>

<h1 align="center">Requirements Markup Language</h1>

<p align="center">
  <strong>An LLM-first (but human-readable) software requirements format that captures your intent and turns it into long-term project context — with a toolchain to keep code honest to the spec.</strong>
</p>

<p align="center">
  <a href="https://rqml.org/docs/quick-start">Quick Start</a> •
  <a href="https://rqml.org/docs/tooling">Tooling</a> •
  <a href="https://rqml.org/docs/user-guide">User Guide</a> •
  <a href="https://rqml.org/docs/reference">Reference</a> •
  <a href="https://rqml.org/docs/examples">Examples</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/schema-2.1.0-8568ab" alt="Schema version">
  <img src="https://img.shields.io/npm/v/@rqml/cli?label=%40rqml%2Fcli&color=8568ab" alt="@rqml/cli on npm">
  <img src="https://img.shields.io/badge/license-Apache%202.0-blue" alt="License">
</p>

---

## The problem

LLMs amplify weak requirements. Teams cut corners on specs because writing "proper documentation" feels slow and unrewarding. AI is fast — but it **guesses context** unless you give it some. You end up with prompt soup, inconsistent decisions, and fragile architecture. And even when you do write things down, the spec quietly rots out of sync with the code.

## The solution

RQML gives your project a **single source of truth** for system intent — structured enough for tools and LLMs to consume reliably, human-readable enough that your team will actually use it. Then a small, deterministic toolchain **checks that the code still matches the spec** — on every save, commit, and CI run.

<p align="center">
  <img src="https://rqml.org/img/hero_workflow.svg" alt="RQML Workflow" width="720">
</p>

**RQML is the missing piece in your LLM workflow.**

<p align="center">
  <img src="https://rqml.org/img/hero_features.svg" alt="RQML Features" width="600">
</p>

---

## Quick start

The fastest way in — no install required:

```bash
# Scaffold a starter spec + an AGENTS.md for your coding agent
npx @rqml/cli init

# Validate + check coverage and drift (deterministic, offline)
npx @rqml/cli check
```

`init` drops a minimal `requirements.rqml` in your project root:

```xml
<rqml xmlns="https://rqml.org/schema/2.1.0"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:schemaLocation="https://rqml.org/schema/2.1.0 https://rqml.org/schema/rqml-2.1.0.xsd"
      version="2.1.0" docId="DOC-HELLO-001" status="draft">
  <meta>
    <title>Hello World CLI</title>
    <system>hello</system>
  </meta>
  <requirements>
    <req id="REQ-HELLO-001" type="FR" title="Print greeting" status="draft" priority="must">
      <statement>
        The program MUST print "Hello, world!" to standard output
        and exit with status code 0.
      </statement>
    </req>
  </requirements>
</rqml>
```

It also writes an [`AGENTS.md`](https://rqml.org/AGENTS.md) that tells AI coding assistants to follow spec-first development, at a strictness level you choose:

| Level | Description |
|-------|-------------|
| `relaxed` | Prototyping. Spec is advisory. Quick iteration allowed. |
| `standard` | Production default. Spec-first for features. Core traces. |
| `strict` | Full traceability. All behavior specified. No ghost features. |
| `certified` | Regulated/safety-critical. Audit-grade traces with metadata. |

From there, use it everywhere: prompt your agent with *"implement the requirements in the .rqml file,"* trace tests back to requirements, and gate CI with `rqml check`. **Start minimal. Grow as the system grows. Let the structure do the hard work.**

---

## The toolchain

RQML ships a small TypeScript toolchain built around **one engine** — so the CLI, the MCP server, the RQML VS Code extension, and your own tools all agree on what a valid, covered, drift-free spec is. Everything runs **offline**, and **no language model sits in the verdict path** — checks are reproducible and safe to gate on.

| Package | Install | What it does |
|---------|---------|--------------|
| **[`@rqml/cli`](https://rqml.org/docs/tooling/cli)** &nbsp;(`rqml`) | `npm i -g @rqml/cli` | `init` · `validate` · `status` · `check` — the deterministic gate for CI, save hooks, and commit hooks (stable exit codes, `--json`) |
| **[`@rqml/core`](https://rqml.org/docs/tooling/core)** | `npm i @rqml/core` | The engine: parse, validate (XSD + referential integrity), lint, trace, coverage, drift. Embed it in your own TS/JS tools |
| **[`@rqml/mcp`](https://rqml.org/docs/tooling/mcp)** | `npx @rqml/mcp` | A [Model Context Protocol](https://modelcontextprotocol.io) server that gives coding agents RQML tools: `validate`, `status`, `check`, `trace` |
| **[`@rqml/schema`](https://rqml.org/docs/reference)** | `npm i @rqml/schema` | The canonical XSDs and example documents — the single source of truth |

**Using a coding agent?** Point it at the MCP server so it can validate and check specs itself:

```json
{ "mcpServers": { "rqml": { "command": "npx", "args": ["-y", "@rqml/mcp"] } } }
```

→ Full tooling docs: **[rqml.org/docs/tooling](https://rqml.org/docs/tooling)**

---

## What RQML captures

| Section | Purpose |
|---------|---------|
| **Goals** | Business objectives, quality targets, obstacles |
| **Scenarios** | User stories, use cases, acceptance flows |
| **Requirements** | Functional and non-functional requirements |
| **Interfaces** | APIs, data contracts, system boundaries |
| **Behavior** | State machines, workflows, decision logic |
| **Verification** | Test cases, acceptance criteria |
| **Trace** | Links between goals → requirements → tests → code |

---

## Why RQML?

- **Clear structure** — Goals, scenarios, requirements, verification, traceability, organized so nothing important gets lost.
- **Low ceremony** — Enough discipline to be useful, without turning spec writing into a second job.
- **LLM-ready** — Predictable, structured context that improves codegen, refactors, tests, and architecture decisions.
- **Diff-friendly** — Review requirements like code. PRs show exactly what changed and why.
- **Traceable** — Connect goals → requirements → verification → code, so you can prove what you built matches intent.
- **Enforceable** — `rqml check` is a deterministic gate: same inputs, same verdict. Run it in CI to catch spec/code drift automatically — no model required.

---

## Documentation

📖 **[rqml.org](https://rqml.org)** — full documentation

- [Quick Start](https://rqml.org/docs/quick-start) — get up and running
- [Tooling](https://rqml.org/docs/tooling) — the `@rqml/core` engine, the `rqml` CLI, and the `@rqml/mcp` server
- [User Guide](https://rqml.org/docs/user-guide) — learn the concepts
- [Reference](https://rqml.org/docs/reference) — element and attribute index
- [Examples](https://rqml.org/docs/examples) — real-world RQML documents

---

## Repository structure

This is a pnpm monorepo:

```
rqml/
├── packages/
│   ├── schema/        # @rqml/schema — canonical XSDs, examples, AGENTS.md
│   ├── core/          # @rqml/core   — the engine (parse, validate, trace, check)
│   ├── cli/           # @rqml/cli    — the `rqml` command
│   └── mcp/           # @rqml/mcp    — Model Context Protocol server
├── apps/
│   └── website/       # Docusaurus documentation site → rqml.org
├── rfc/               # Design proposals and decisions
└── requirements.rqml  # RQML, specified in RQML (the ultimate dogfood)
```

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

- **Report issues** — Found a bug or have a suggestion? [Open an issue](https://github.com/rqml-org/rqml/issues)
- **Propose changes** — Submit RFCs in the `rfc/` directory for significant changes
- **Improve docs** — Documentation improvements are always welcome

---

## License

RQML is licensed under the [Apache License 2.0](LICENSE).

---

<p align="center">
  <strong>Put your intent in the repo. Make LLM output calmer, cleaner, and easier to trust.</strong>
</p>

<p align="center">
  <a href="https://rqml.org/docs/quick-start">
    <img src="https://img.shields.io/badge/Get%20Started-8568ab?style=for-the-badge" alt="Get Started">
  </a>
</p>
