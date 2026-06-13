<p align="center">
  <img src="https://rqml.org/img/RQML_logo_transparent.png" alt="RQML Logo" width="280">
</p>

<h1 align="center">Make the spec the artifact. Then gate CI on it.</h1>

<p align="center">
  <strong>RQML</strong> (Requirements Markup Language) is an XML format for software requirements
  with a deterministic toolchain: validate the spec, trace it to the code and tests that realize it,
  and fail the build when they drift apart. Built for codebases where an agent writes much of the
  code — and someone still has to know what the system is supposed to do.
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

## The whole idea, in one terminal session

```console
# the agent implements REQ-AUTH-001, then records the link — no hand-edited XML
$ rqml link REQ-AUTH-001 src/auth.ts#verifyToken
✓ REQ-AUTH-001 ← src/auth.ts#verifyToken (E-IMPL-AUTH-001, implements, baseline recorded)

$ rqml check
✓ check pass (standard) — requirements.rqml

# six weeks later, someone refactors auth without touching the spec…
$ rqml check
  error (drift) [changed-implementation]: implements edge "E-IMPL-AUTH-001"
    points at "src/auth.ts#verifyToken", which has changed since approval.
✗ check fail (standard) — requirements.rqml      (exit 2)
```

No language model is involved in any of those verdicts. `rqml check` is a pure
function of your repository — same input, same answer, on your laptop and in
CI. The model proposes; the toolchain disposes.

## Quick start

```bash
npx @rqml/cli init
```

This scaffolds two files: `requirements.rqml` (a minimal, valid spec) and
[`AGENTS.md`](https://rqml.org/AGENTS.md) (the process contract for coding
agents, with a strictness level from `relaxed` to `certified`). A complete,
valid spec is small:

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

From there, the loop — for humans and agents alike:

```bash
rqml show REQ-HELLO-001      # read one requirement: statement, acceptance, traces
rqml impact REQ-HELLO-001    # what is affected, transitively, if it changes?
# … implement …
rqml link REQ-HELLO-001 src/hello.ts             # record the implements edge + drift baseline
rqml link REQ-HELLO-001 test/hello.test.ts --type verifiedBy
rqml check                   # the gate: validation + coverage + drift; exit 0 or it isn't done
```

This `show` → `impact` → implement → `link` → `check` rhythm is the **Code** and
**Verify** half of RQML's [five-stage development process](https://rqml.org/docs/development-process)
(Spec → Design → Plan → Code → Verify) — where design decisions are recorded as
ADRs in `.rqml/adr/` and the implementation plan lives in `.rqml/plan.md`.

And in CI:

```yaml
- run: npx @rqml/cli check --strictness standard
```

Exit codes are stable: `0` pass · `1` validation failure · `2` blocking drift
or coverage · `64` usage error.

## Yes, XML.

Requirements are documents — prose with structure woven through it — and mixed
content is the problem XML actually solves; JSON and YAML cannot represent it.
It is also what the model vendors already tell you to do: Anthropic, Google,
and AWS all recommend XML tags for structuring LLM context. RQML is that advice
taken seriously — a schema-validated vocabulary instead of ad-hoc tags — so you
get validation, namespaces, comments, and clean diffs. The closing tags cost
tokens once; the structure pays rent for the life of the project.
[The longer argument →](https://rqml.org/why-xml)

## The toolchain

One engine powers every surface, so the CLI, the MCP server, the VS Code
extension, and your own tools can never disagree about what a valid, covered,
drift-free spec is. Everything runs offline, there is no telemetry, and no
model sits in the verdict path.

| Package | Install | What it does |
|---------|---------|--------------|
| **[`@rqml/cli`](https://rqml.org/docs/tooling/cli)** (`rqml`) | `npm i -g @rqml/cli` | `init` · `validate` · `status` · `check`, plus the agent loop: `show` · `impact` · `link` · `skeleton` |
| **[`@rqml/core`](https://rqml.org/docs/tooling/core)** | `npm i @rqml/core` | The engine: parse, validate (XSD + referential integrity), lint, trace, impact, coverage, drift, comment-preserving spec edits |
| **[`@rqml/mcp`](https://rqml.org/docs/tooling/mcp)** | `npx @rqml/mcp` | Eight [MCP](https://modelcontextprotocol.io) tools for coding agents (`rqml_show`, `rqml_impact`, `rqml_link`, `rqml_check`, …) — reads specs by path, writes only on explicit intent |
| **[`@rqml/schema`](https://rqml.org/docs/reference)** | `npm i @rqml/schema` | The canonical XSDs, examples, and the AGENTS.md template — the single source of truth |

**Using Claude Code?** The [rqml plugin](https://github.com/rqml-org/rqml-claude)
turns the loop from documented into enforced: sessions start anchored on your
spec, `.rqml` edits are validated in the same turn, and the session cannot end
until `rqml check` passes.

```text
/plugin marketplace add rqml-org/rqml-claude
/plugin install rqml@rqml
```

**Any other MCP-capable agent?** Point it at the server:

```json
{ "mcpServers": { "rqml": { "command": "npx", "args": ["-y", "@rqml/mcp"] } } }
```

## It eats its own dog food

This repository is specified in RQML. [`requirements.rqml`](requirements.rqml)
defines the language and the toolchain as ~70 requirements; every shipped
feature was specified before it was built, is linked to the code that
implements it and the tests that verify it, and the repo gates its own CI with
`rqml check`. The [Claude Code plugin](https://github.com/rqml-org/rqml-claude)
was built the same way — and once installed, it enforces its own development.

The name is older than you might guess: RQML began as an XML DTD in a 2000 MSc
thesis at the University of York. 2.x is a ground-up redesign of that idea for
coding agents. [The origin story →](https://rqml.org/docs/faq)

## What RQML is not

- **Not a code generator.** It never writes your code — your agent does that.
  RQML is what keeps the agent honest.
- **Not AI-powered.** No model runs anywhere in the toolchain. Verdicts are
  reproducible functions of your repo.
- **Not DOORS.** A text file in your repo and a small npm package — not an
  enterprise requirements suite.
- **Not ceremony.** `meta` plus one requirement is a valid spec. The other
  nine sections (goals, scenarios, domain, behavior, interfaces, verification,
  trace, governance, catalogs) are optional and added when they earn their keep.

## Repository structure

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

## Documentation

Full documentation lives at **[rqml.org](https://rqml.org)**: the
[Quick Start](https://rqml.org/docs/quick-start), the
[User Guide](https://rqml.org/docs/user-guide), the complete
[Tooling](https://rqml.org/docs/tooling) and
[Reference](https://rqml.org/docs/reference) docs, and
[real-world examples](https://rqml.org/docs/examples).

## Contributing

Contributions welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).
Bugs and suggestions: [open an issue](https://github.com/rqml-org/rqml/issues).
Significant changes go through an RFC in [`rfc/`](rfc/). This repo is
spec-first: features start as requirements in `requirements.rqml`, and
`rqml check` must pass before you're done. (Yes, really. The gate will tell you.)

## License

[Apache License 2.0](LICENSE).
