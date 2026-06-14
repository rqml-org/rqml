# RQML Reference Toolchain — Implementation Plan

All language-format requirements (`PKG-STRUCTURE`, `PKG-VOCAB`, `PKG-TRACE`, `PKG-BEHAVIOR`, `PKG-FORMAT`, `PKG-PROCESS`, `PKG-QUALITY`) are already realized by the published XSD and are out of scope here. The unimplemented work is the **reference toolchain** (`PKG-MONOREPO`, `PKG-CORE`, `PKG-CLI`, `PKG-MCP`, `PKG-ENFORCEMENT`) — all `draft`, zero `implements` edges. Stages are ordered by dependency; each is a self-contained agent task.

## Stage 1 — Workspace scaffold
- **Scope:** `REQ-TS-ENGINE`, `REQ-WORKSPACE`, `REQ-PACKAGE-LAYOUT`, `REQ-VERSION-DECOUPLE`
- **Key output:** pnpm workspace with `packages/{core,cli,mcp,schema}` + docs app; TypeScript project references; Changesets
- **Do:** Scaffold pnpm monorepo, root `tsconfig`, shared lint/test config; stub each package's `package.json` and `src/index.ts`.
- **Touch:** `pnpm-workspace.yaml`, `package.json` (root), `packages/*/package.json`, `tsconfig*.json`, `.changeset/`
- **Inputs:** ADR-0002; spec `PKG-MONOREPO`; `DEC-MONOREPO`, `DEC-VERSION-DECOUPLE`
- **Verify:** `pnpm install` clean; `pnpm -r build` (empty) passes; lint config runs
- [ ] Complete

## Stage 2 — Canonical schema package
- **Scope:** `REQ-SCHEMA-CANONICAL`
- **Key output:** `@rqml/schema` holding `rqml-2.1.0.xsd` (+ `2.0.1`) as the single source, exported for offline bundling
- **Do:** Move/copy canonical XSDs into the schema package; export resolver by version; remove duplicate copies elsewhere.
- **Touch:** `packages/schema/xsd/*.xsd`, `packages/schema/src/index.ts`
- **Inputs:** `schema/xsd/*.xsd`, ADR-0002; `DEC-SCHEMA-PACKAGE`
- **Verify:** unit test asserts byte-identical XSD resolved per version; no stray XSD copies remain
- [ ] Complete

## Stage 3 — Core parse + typed model
- **Scope:** `REQ-CORE-PARSE`, `REQ-CORE-API`, `REQ-CORE-DEPS`, `REQ-CORE-NO-LLM`
- **Key output:** `@rqml/core` parses `.rqml` into a typed model; stable public API; dependency-clean
- **Do:** Implement XML parse → typed RQML model; define exported types and entry API; forbid CLI/MCP/LLM deps.
- **Touch:** `packages/core/src/{parse,model,index}.ts`
- **Inputs:** spec `domain` entities + `PKG-CORE`; ADR-0003
- **Verify:** parse example specs (`schema/examples/*.rqml`); `dependency-cruiser`/manifest test asserts no CLI/MCP/model deps (`TC-CORE-NO-DEPS`)
- [ ] Complete

## Stage 4 — Validation engine
- **Scope:** `REQ-CORE-VALIDATE`, `REQ-CORE-SCHEMA-DETECT`, `REQ-CLI-OFFLINE`
- **Key output:** offline validation (XML well-formedness, XSD, ID uniqueness, trace integrity) with version auto-detection
- **Do:** Integrate WASM `xmllint` (or equivalent) against bundled XSD; detect version from namespace; layer key/keyref checks.
- **Touch:** `packages/core/src/{validate,schema-detect}.ts`
- **Inputs:** `@rqml/schema`; spec `PKG-CORE`; `BR-UNIQUE-ID`, `BR-TRACE-INTEGRITY`
- **Verify:** `TC-XSD-VALID`, `TC-UNIQUE-ID`, `TC-TRACE-RESOLVE`, `TC-SM-INITIAL`, `TC-MINIMAL-DOC`, `TC-CORE-OFFLINE` (run with network disabled)
- [ ] Complete

## Stage 5 — Trace graph + coverage
- **Scope:** `REQ-CORE-TRACE-GRAPH`, `REQ-CORE-COVERAGE`
- **Key output:** in-memory trace graph; deterministic coverage report (uncovered goals, unverified reqs, dangling/orphans)
- **Do:** Build directed graph from `edge` locators; implement impact + coverage queries.
- **Touch:** `packages/core/src/{graph,coverage}.ts`
- **Inputs:** spec `trace` section, `PKG-CORE`
- **Verify:** unit tests on a fixture spec assert known uncovered goals (e.g. `QGOAL-DIFF`, `QGOAL-HUMAN`); repeated runs are identical
- [ ] Complete

## Stage 6 — Drift detection
- **Scope:** `REQ-CORE-DRIFT`, `REQ-ENFORCE-CODE-TRACE`
- **Key output:** resolves `implements` external locators (file/symbol/test) and flags missing/changed artifacts
- **Do:** Parse external locator URIs; resolve against filesystem + AST; compare against last-approved state.
- **Touch:** `packages/core/src/{drift,locator-resolve}.ts`
- **Inputs:** ADR-0003; `DEC-EXPLICIT-TRACE`; `SM-IMPL-STATUS`
- **Verify:** `TC-DRIFT-DETECT` (missing target → drifted); deterministic across runs/machines
- [ ] Complete

## Stage 7 — CLI
- **Scope:** `REQ-CLI-BINARY`, `REQ-CLI-COMMANDS`, `REQ-CLI-CHECK-GATE`, `REQ-CLI-JSON`, `REQ-CLI-EXIT-CODES`, `REQ-CLI-SPEED`, `REQ-CLI-OFFLINE`
- **Key output:** `rqml` binary with `init|validate|status|check`; stable JSON + exit codes; `<~1s` on typical specs
- **Do:** Wire commands to `@rqml/core`; define exit-code map; emit human + `--json` output; `init` scaffolds spec + marker.
- **Touch:** `packages/cli/src/{index,commands/*}.ts`
- **Inputs:** spec `PKG-CLI`; ADR-0001
- **Verify:** `TC-CHECK-GATE` (non-zero on drift), `TC-CHECK-DETERMINISM`; snapshot tests on JSON schema; timing assertion
- [ ] Complete

## Stage 8 — Enforcement semantics
- **Scope:** `REQ-ENFORCE-PRIMITIVES`, `REQ-ENFORCE-DETERMINISM`, `REQ-ENFORCE-STRICTNESS`, `REQ-ENFORCE-CERTIFIED`, `REQ-ENFORCE-AUTHOR-SPLIT`
- **Key output:** strictness-governed gate behavior + append-only audit trail at `certified`
- **Do:** Implement strictness levels (relaxed→certified) over check results; emit audit records; ensure no model in verdict path.
- **Touch:** `packages/core/src/{strictness,audit}.ts`, `packages/cli/src/commands/check.ts`
- **Inputs:** ADR-0001/0003; spec `PKG-ENFORCEMENT`
- **Verify:** per-level gate tests; audit-trail append-only test; determinism re-run
- [ ] Complete

## Stage 9 — MCP server
- **Scope:** `REQ-MCP-SERVER`, `REQ-MCP-TOOLS`, `REQ-MCP-PARITY`, `REQ-MCP-READONLY`
- **Key output:** `@rqml/mcp` exposing validate/status/check/trace/skeleton tools, backed by `@rqml/core`
- **Do:** Implement MCP server over the core API; ensure read-mostly behavior; reuse engine for parity.
- **Touch:** `packages/mcp/src/{server,tools/*}.ts`
- **Inputs:** spec `PKG-MCP`; `REQ-CORE-API`
- **Verify:** `TC-MCP-PARITY` (MCP vs CLI equivalence); no irreversible FS actions without explicit intent
- [ ] Complete

## Stage 10 — Schema URL publishing
- **Scope:** `REQ-SCHEMA-URLS`
- **Key output:** docs site serves `/schema/<version>/…` and `/AGENTS.md` at stable URLs from `@rqml/schema`
- **Do:** Generate published schema routes from the canonical package; wire into Docusaurus build.
- **Touch:** `docs/` static generation, build config
- **Inputs:** `@rqml/schema`; `REQ-SCHEMA-CANONICAL`
- **Verify:** `TC-SCHEMA-URL` (build + request canonical URL returns the XSD)
- [ ] Complete

---

## Readiness Verdict: **READY (with advisories)**

The spec is detailed, internally consistent, and backed by three ADRs with explicit requirement mappings and a clear dependency order — sufficient for agents to begin at Stage 1.

**Advisories (non-blocking under `relaxed`, resolve before `strict`/`certified` build):**
- All toolchain requirements are `status="draft"` and their decisions `status="review"`; ADRs are `Proposed`. Promote the load-bearing ones to `approved`/`Accepted` before treating them as frozen.
- No `implements` edges exist yet — expected (dogfood baseline, `ISS-IMPL-TRACE`). Agents must **add `implements` edges as each stage lands**, or Stage 6 drift detection has nothing to resolve.
- Soft acceptance terms ("typical project", "~1s") need a fixed benchmark fixture for `REQ-CLI-SPEED`/`QGOAL-CHECK-SPEED`.

**Hard blockers:** None.

---

# Interactive RQML capabilities (1–6) — Implementation Plan

Makes RQML development more interactive inside coding agents: text read-surfaces
(spec overview, traceability matrix) and a review→accept-before-implementation
workflow. Decisions are recorded in ADR-0006 … ADR-0011; the requirements are
`draft` in `requirements.rqml` (PKG-CORE, PKG-LOOP, PKG-MCP, PKG-ENFORCEMENT) and
in the plugin/extension specs.

**Precondition (spec-first):** these requirements are `status="draft"`. Promote
the load-bearing ones to `approved` before implementing them — only approved
requirements drive implementation (REQ-STATUS-ENUM). Add `implements` edges with
`rqml link` as each stage lands. Stages are ordered by dependency: the engine
(11–13) lands before the surfaces (14), which land before the plugins (15) and the
editor (16). Stage 17 is gated on ADR-0011 sign-off.

## Stage 11 — Traceability matrix in core (capability 1, engine)
- **Scope:** `REQ-CORE-MATRIX`
- **Key output:** `@rqml/core` derives a `MatrixReport` (one row per requirement: status, upstream goals, implementing artifacts, verifying tests, verification/implementation status, warnings) plus a `matrixToMarkdown` renderer; deterministic
- **Do:** Add a matrix derivation composing `computeCoverage` + `resolveTrace` + shared title collection; plain TypeScript types (no Zod); stable, sorted output. Export from the core entry.
- **Touch:** `packages/core/src/analyze/matrix.ts`, `packages/core/src/export/markdown.ts`, `packages/core/src/index.ts`
- **Inputs:** ADR-0006; reuse `check/coverage.ts`, `trace/index.ts`, `export/outline.ts` (`collectTitles`)
- **Verify:** `CRIT-MATRIX-DERIVED` — a requirement with an implements edge and no verifiedBy edge yields an unverified row whose values equal the coverage report; repeated runs byte-identical
- [ ] Complete

## Stage 12 — Scoped document projection in core (capability 5, engine)
- **Scope:** `REQ-CORE-PROJECTION`
- **Key output:** additive scoping options (section / package / id-set) on the existing outline + markdown projection; whole-document output unchanged
- **Do:** Extend `MarkdownOptions` with deterministic selection; filter the outline by id/section. No new renderer.
- **Touch:** `packages/core/src/export/markdown.ts`, `packages/core/src/export/outline.ts`, `packages/core/src/index.ts`
- **Inputs:** ADR-0010; reuse `buildOutline`, `outlineToMarkdown`
- **Verify:** `CRIT-PROJECTION-SCOPE` — a filter naming a subset of ids renders exactly those with their resolved refs; the default whole-document render is byte-identical to today
- [ ] Complete

## Stage 13 — Status-transition edit + approval verdict in core (capabilities 3 & 4, engine)
- **Scope:** `REQ-CORE-SETSTATUS`, `REQ-CORE-APPROVAL-VERDICT`
- **Key output:** `edit/status.ts` `setStatus` (textual, comment-preserving, integrity-checked status edit); a deterministic non-approved-implementation verdict
- **Do:** Mirror `edit/link.ts` (parse-guard → textual edit → reparse → integrity-guard → return) for `setStatus`. Build the verdict on `computeCoverage().prematureImplementations`, optionally filtered to changed paths.
- **Touch:** `packages/core/src/edit/status.ts`, `packages/core/src/analyze/` (verdict), `packages/core/src/index.ts`
- **Inputs:** ADR-0009, ADR-0008; reuse `edit/link.ts`, `check/coverage.ts` (REQ-CORE-STATUS-AWARE)
- **Verify:** `CRIT-SETSTATUS-INPLACE` (only the status attribute changes, document revalidates, byte-identical elsewhere); `CRIT-VERDICT-NONAPPROVED` (a `review`-status target is flagged identically every run)
- [ ] Complete

## Stage 14 — CLI + MCP surfaces at parity (capabilities 1, 4, 5 + verdict)
- **Scope:** `REQ-LOOP-OVERVIEW`, `REQ-LOOP-MATRIX`, `REQ-LOOP-APPROVE`, `REQ-MCP-INTERACTION-BOUNDARY`, `REQ-ENFORCE-APPROVAL-GATE`
- **Key output:** `rqml overview|matrix|approve` and `rqml_overview|rqml_matrix|rqml_approve`; the approval-gate verdict exposed for hooks/CI; MCP stays text/JSON with no resources/elicitation dependency
- **Do:** Add CLI commands mirroring `commands/show.ts` / `commands/link.ts`; add MCP tools mirroring `rqml_show` / `rqml_link`; `approve` is an explicit-intent write; surface the verdict (CLI flag/JSON field + MCP tool).
- **Touch:** `packages/cli/src/commands/{overview,matrix,approve}.ts`, `packages/cli/src/index.ts`, `packages/mcp/src/tools.ts`
- **Inputs:** ADR-0007, ADR-0006, ADR-0009, ADR-0010; `REQ-MCP-PARITY`
- **Verify:** parity tests `CRIT-OVERVIEW-PARITY`, `CRIT-MATRIX-SURFACE`, `CRIT-APPROVE-WRITE`, `CRIT-MCP-TOOLS-ONLY` (capability reachable and equal to CLI on a tools-only host)
- [ ] Complete

## Stage 15 — Plugin review/accept choreography + PreToolUse gate (capability 3, enforcement)
- **Scope:** rqml-claude `REQ-CMD-REVIEW`, `REQ-HOOK-PREIMPL`; rqml-codex `REQ-SKILL-REVIEW`, `REQ-HOOK-PREIMPL`
- **Key output:** `/rqml:review` command (Claude) + `rqml-review` skill (Codex) that render the overview + matrix of draft/review requirements and drive acceptance via `rqml approve`; a `PreToolUse` hook denying edits to code linked to non-approved requirements (fail-open; Codex degrades to stop gate + review skill where it has no pre-edit event)
- **Do:** Claude — `commands/review.md`, register a `PreToolUse` hook in `hooks.json` + a hook script that consults the verdict via the CLI. Codex — `skills/rqml-review/SKILL.md`, a `pre-tool-use` branch in `lib/rqml-codex-core.mjs` + `hooks.json`. Human decides; toolchain performs the edit.
- **Touch:** `rqml-claude/commands/review.md`, `rqml-claude/hooks/{hooks.json,scripts/pre-impl-gate.mjs}`; `rqml-codex/skills/rqml-review/SKILL.md`, `rqml-codex/{hooks/hooks.json,lib/rqml-codex-core.mjs}`
- **Inputs:** ADR-0008, ADR-0007; reuse `stop-gate.mjs` / `lib.mjs` fail-open pattern
- **Verify:** `CRIT-PREIMPL-DENY` (edit to code linked to a draft req denied naming it; toolchain-unavailable proceeds with one warning); `CRIT-REVIEW-ACCEPT` (only confirmed requirements transition to approved)
- [ ] Complete

## Stage 16 — VS Code matrix adapter; retire duplication (capability 1, consumer)
- **Scope:** rqml-vscode `REQ-MAT-DELEGATE`
- **Key output:** the extension's matrix derived from `@rqml/core`'s `MatrixReport` via an adapter to its webview shape; the extension's own derivation retired
- **Do:** Bump the `@rqml/core` dependency; write a `MatrixReport → MatrixData` adapter feeding the existing webview Zod contract; delete `matrixDerive.ts`'s duplicated classification. Sequence adapter-first so the editor keeps shipping.
- **Touch:** `rqml-vscode/extension/src/transformers/rqmlToMatrix.ts` (→ adapter), `extension/src/services/core.ts`; remove `extension/src/transformers/matrixDerive.ts`
- **Inputs:** ADR-0006; rqml-vscode ADR-0004
- **Verify:** `AC-MAT-DELEGATE-01` (each row's verification/implementation status equals `@rqml/core`'s value for the same requirement); existing matrix webview tests pass
- [ ] Complete

## Stage 17 — Certified approval provenance metadata (capability 6) — gated on ADR-0011
- **Scope:** `REQ-APPROVAL-PROVENANCE`
- **Key output:** optional `approvedBy` / `approvedAt` schema metadata; a certified-only validation/coverage check; provenance surfaced in overview and matrix
- **Do:** Additive XSD change (optional attributes only); certified-mode check in core; surface in CLI/MCP. **Do not start until ADR-0011 is accepted** — it changes the published schema contract.
- **Touch:** `packages/schema/versions/<ver>/*.xsd` (additive), `packages/core/src/check/*` (certified), CLI/MCP surfaces
- **Inputs:** ADR-0011 (Proposed); `REQ-BACKWARD-COMPAT`, `REQ-ENFORCE-CERTIFIED`
- **Verify:** `CRIT-PROVENANCE-OPTIONAL` (minimal spec without provenance valid under standard; certified flags missing provenance on an approved artifact); documents valid under earlier 2.x still validate
- [ ] Complete (blocked: ADR-0011 sign-off)