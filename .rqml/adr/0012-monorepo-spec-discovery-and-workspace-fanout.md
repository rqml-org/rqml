# ADR-0012: Monorepo support via nearest-wins spec discovery in core and workspace fan-out

- Status: Accepted
- Date: 2026-06-17
- Classification: discretionary_design_choice
- Related requirements: REQ-CORE-SPEC-DISCOVERY, REQ-WORKSPACE-FANOUT (drafted alongside this ADR); SCN-AUTHOR (revised to the per-unit / nearest-wins model); REQ-AGENTS-TEMPLATE (the AGENTS.md template content it governs is to be reworded off the umbrella model)
- Related ADRs: ADR-0002 (the *toolchain's own* pnpm monorepo — distinct from the consumer-monorepo support decided here), ADR-0005 (owns the AGENTS.md template wording this revises)
- Affected components: core (new discovery module), cli (resolution + `--workspace`/`--all`), mcp (discovery tool + `file` resolution), schema (AGENTS.md template), agent integrations (rqml-claude, rqml-codex, rqml-skill), vscode (alignment to the shared algorithm)

## Context

The reference tooling assumes **one spec per invocation, discovered in a single
directory**. The CLI's `resolveSpecPath` scans only `baseDir` (default `cwd`) for
`*.rqml`, preferring `requirements.rqml`; it never walks the tree. The MCP server
is stateless and requires an explicit `path` or inline `xml` per call. Code links
and the drift baseline (`.rqml/baseline.json`) already resolve relative to the
spec's directory, so they are *already* per-spec — the only thing missing is
discovery.

Meanwhile three surfaces have grown **three different, divergent resolution
rules**:

- **vscode** already ships full consumer-monorepo support: recursive discovery
  plus a parent-directory walk, one spec per project unit (prefer
  `requirements.rqml`, else the sole `*.rqml`, else treat the directory as
  ambiguous), an active-spec switcher, and per-workspace persistence. Its docs
  define the canonical semantics: exactly one spec per project unit, **no
  repo-root umbrella spec**, walk upward and **nearest wins**, never cross a
  workspace-folder boundary, and **cross-unit traceability is not supported**.
- **rqml-skill** (Python) resolves a single repository root by walking up for a
  directory that contains *both* `requirements.rqml` and `.rqml/` — a single-root
  assumption with no multi-spec notion, a third rule again.
- **cli/mcp** do the single-directory scan above.

The AGENTS.md template (shipped via `@rqml/schema` into rqml-claude and
rqml-codex) states the *opposite* of vscode's policy: that a spec "applies to
everything that is higher in the project tree, unless overridden by another
.rqml file" — i.e. an inheriting umbrella. The self-spec's `SCN-AUTHOR` likewise
narrates "one .rqml file in the project root." So the ecosystem currently
documents two incompatible scoping models and implements a third behavior.

Separately, the schema already defines the **cross-spec reference primitive** —
the `doc` locator (`<doc uri="..." id="..." docId? version? git?>`), "reference
by ID in another RQML document." It is **unresolved and unvalidated** by the
schema and by core (`integrity.ts` excludes `doc` ids from the declared-id index
but never resolves the target; `matrix.ts` only displays `uri#id`). The skill
*does* partially resolve `doc` targets on the filesystem. True cross-spec
traceability ("federation") is a deliberate future direction, but it is out of
scope here. This ADR covers only discovery and fan-out — the prerequisite that
later makes resolving `doc` URIs repo-wide tractable.

## Decision drivers

- One repo hosting several independent specs (per package/app/service) must be a
  first-class, low-ceremony case — not something callers script around.
- CI needs a single "is the whole repo green?" answer with one aggregated exit
  code, not N invocations to wrangle.
- Eliminate the three divergent resolution rules: one algorithm, one source of
  truth, shared by every surface.
- Honor what is already shipped and documented in vscode rather than inventing a
  fourth behavior.
- Keep `@rqml/core` dependency-clean and deterministic (per ADR-0002's
  consequence): discovery is filesystem-only, no model SDK.
- Defer federation cleanly — discovery must not foreclose later `doc`-locator
  resolution, but must not pull it in now.

## Options considered

### Scoping model

#### Option A: No umbrella, nearest-wins (chosen)
Each path is governed by exactly one spec — the nearest one walking up from it; a
spec covers its own directory subtree and a nested spec fully overrides its own
subtree, with no inheritance or merging across the boundary; cross-spec
traceability stays unsupported.

**Pros**
- Already implemented and documented in vscode — least new design, immediate
  cross-surface consistency.
- Simple, predictable mental model that mirrors `.editorconfig`/`tsconfig`
  resolution developers already know.
- Each unit's `.rqml/` (baseline, ADRs, plan) is self-contained, matching the
  current per-`baseDir` behavior with no data-model change.

**Cons**
- No inheritance: shared/cross-cutting requirements cannot live in a parent spec
  and flow down. Contradicts the current AGENTS.md template wording, which must
  be rewritten.

#### Option B: Umbrella + override (inheritance)
A higher spec governs its subtree unless a nearer spec overrides it, per the
current AGENTS.md template.

**Pros**
- Expressive: common/platform requirements can be authored once at a parent and
  inherited.

**Cons**
- Requires merge/override semantics that do not exist anywhere today, including
  vscode; significant new design and a clear precedence model.
- Blurs the boundary with federation (what does a child "see" of a parent?),
  pulling forward complexity we are explicitly deferring.

### Implementation locus

#### Option C: Lift discovery into @rqml/core (chosen)
A single discovery resolver in `@rqml/core`; cli and mcp consume it directly, the
skill via subprocess, and vscode aligns to it over time.

**Pros**
- One source of truth replaces three divergent rules; behavior cannot drift
  between surfaces.
- Discovery becomes testable in core's deterministic, dependency-clean
  environment.

**Cons**
- More upfront work and a new core API surface; vscode must migrate off its
  bespoke `specService` discovery to converge (can be staged).

#### Option D: CLI/MCP only for now
Add discovery to cli and mcp; leave vscode (TS) and skill (Python) as they are.

**Pros**
- Faster to ship the immediate CLI/MCP gap.

**Cons**
- Entrenches three implementations of subtly different rules — the exact problem
  this ADR exists to remove.

## Decision

Adopt **Option A (no umbrella, nearest-wins)** as the cross-tool scoping standard
and **Option C (lift discovery into `@rqml/core`)** as the implementation locus.

Concretely:

1. **Core discovery API & governance rule.** A spec governs the directory it sits
   in and every subdirectory beneath it, except subtrees taken over by a nested
   spec, and never a parent directory — equivalently, each path is governed by the
   spec in its nearest ancestor directory (its own, else the closest above it).
   No content is inherited or merged across a nested-spec boundary: a nested spec
   fully replaces its parent for its own subtree. Add a deterministic,
   filesystem-only resolver to `@rqml/core`: given a starting directory/file, walk
   upward to the nearest directory whose spec is resolvable (prefer
   `requirements.rqml`, else the sole `*.rqml`, else ambiguous → error), stopping
   at a boundary (git root / workspace root). Add a `discoverSpecs(root)` that
   enumerates each governing spec across a tree, applying the same naming rule.
   This makes precise the nearest-wins discovery the vscode extension already
   implements.
2. **CLI.** `resolveSpecPath` gains the upward walk; add a `--workspace`/`--all`
   mode that runs `validate`/`status`/`check` across every discovered unit-spec
   and returns one aggregated exit code (non-zero if any unit fails).
3. **MCP.** Keep per-call statelessness; add a discovery tool (given a `root`,
   return the unit-specs and which one governs a given file) and let spec inputs
   optionally accept a `file`/`cwd` that resolves via the core walk server-side.
4. **Reconcile the divergences.** Rewrite the AGENTS.md template and revise
   `SCN-AUTHOR` to state the nearest-wins, one-spec-per-unit model (no umbrella).
   Migrate rqml-skill's `repo_root` to the core algorithm; align vscode's
   `specService` to consume the shared resolver.
5. **Scope boundary.** Cross-unit traceability and `doc`-locator resolution are
   **explicitly out of scope** and deferred to a future federation ADR. Discovery
   is the prerequisite that later makes repo-wide `doc` resolution tractable; this
   ADR only names the seam, it does not build it.
6. **Project layout convention.** Each spec owns exactly one co-located `.rqml/`
   directory (holding `baseline.json`, `adr/`, `plan.md`); a directory without a
   spec carries no `.rqml/`. ADRs live as a single flat, sequentially-numbered
   series in that one `.rqml/adr/` — **no subdirectories** — so tooling can assume
   one numbered line. When a spec is removed or merged, its ADRs are consolidated
   into the surviving spec's numbered sequence, not nested and not left in a
   spec-less `.rqml/` (as done for the former `packages/core` spec, whose ADRs
   folded into root ADR-0013–0015).

Accepted: the scoping model and implementation locus are settled, `SCN-AUTHOR` is
revised, and `REQ-CORE-SPEC-DISCOVERY` / `REQ-WORKSPACE-FANOUT` are drafted under
the Spec stage. The AGENTS.md template rewording (point 4) and the cross-surface
migrations (skill, vscode) remain implementation follow-ups.

## Consequences

### Positive
- Monorepos with multiple independent specs become first-class; agents and CI
  resolve "the governing spec" and "all specs" without bespoke scripting.
- One discovery algorithm in core ends the three-way divergence across cli, mcp,
  skill, and vscode.
- No data-model or baseline change: per-unit `.rqml/` already works.
- The federation path (`doc` locators) is left open and clearly seamed, not
  foreclosed.

### Negative
- The AGENTS.md template and `SCN-AUTHOR` must change, and downstream agent
  integrations re-ship the revised template — a published-contract change.
- vscode and the skill must migrate to the shared resolver to fully realize the
  consolidation; until then, partial divergence persists.
- "No umbrella" means shared requirements cannot yet be inherited; teams wanting
  that must wait for federation.

## Supersession

None
