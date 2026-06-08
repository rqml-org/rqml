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