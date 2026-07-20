# ADR-0017: Compact trace-edge serialization (2.2.0) and generalized link recording

- Status: Accepted
- Date: 2026-07-20
- Classification: discretionary_design_choice
- Related requirements: REQ-LOOP-LINK, REQ-LOOP-RELINK, REQ-CORE-DRIFT-BASELINE, REQ-MCP-READONLY, QGOAL-DIFF
- Related ADRs: ADR-0003 (deterministic checking), ADR-0009 (textual mutation primitive pattern), ADR-0014 (typed model and versioned roundtrip)
- Affected components: schema (2.2.0), core (parse, serialize, integrity, edit/link, skeleton), cli (link), mcp (rqml_link), all dogfood specs

## Context

Agent feedback from real RQML-governed coding sessions identified trace-edge
verbosity as the top cost of working with the format. Measurement across the
six dogfood specs (779 edges) confirmed it:

- Trace edges are **32.1% of all spec bytes** (~51k tokens), paid on every
  whole-spec read; the share grows monotonically as edges accrete.
- The `<from><locator><local id="…"/></locator></from>` endpoint wrapping is
  44 bytes of scaffolding per endpoint that encodes exactly one datum: the
  locator kind (local / doc / external).
- Edge kinds in practice: 44% local–local, 49% external (`file:` implements/
  verifiedBy edges recorded during coding), 6.5% doc (federation).
- Rich edge markup is unused so far (0/779 edges carry status/createdBy/tags;
  1% carry `<notes>`) — read as a **guidance gap**, not as evidence the
  features are dispensable. The maintainer's direction is to *promote* rich
  markup through tooling defaults and guidance, which compaction makes
  affordable.
- In agent-driven development the spec behaves as a **requirements log**:
  edges are appended continuously through prompting. Write cost is
  per-interaction; `rqml link` (a ~13-token invocation vs a ~63-token edge
  block) already solves it — but only for `implements`/`verifiedBy` with an
  external URI. `satisfies`/`refines` local–local edges, the exact exemplar
  in the feedback, must still be hand-typed XML.

Two structural facts free the design space. Referential integrity is enforced
in code, not XSD (the 2.1.0 identity constraints are inert — their unprefixed
selector XPaths cannot match namespace-qualified elements — and code-level
checking was already the chosen architecture). And there are **no RQML
documents in the wild**: only the dogfood repos can go stale, so a
serialization change is a one-sitting `rqml migrate` sweep, not an ecosystem
event.

## Decision drivers

- Read cost dominates and compounds; it can only be fixed by changing the
  bytes on disk.
- The write path must be a mechanical tool call for *every* trace type
  (requirements-as-log).
- The three locator kinds and doc-locator pinning (uri/docId/version/git) are
  load-bearing (federation); any compact form must preserve them losslessly.
- One dialect: an open standard must not carry two edge serializations
  indefinitely (the RDF/XML-vs-Turtle and SHACL-compact lesson).
- Rich edge markup (status, createdBy, tags, confidence, notes) must survive
  and become cheaper to use, with tooling stamping the mechanical parts.
- Diff-friendliness (QGOAL-DIFF) and deterministic textual edits (ADR-0009
  pattern) are non-negotiable.

## Options considered

### Option A: Attribute shorthand for local refs only, on the existing `<edge>`

`from="REQ-A" to="GOAL-B"` allowed as an alternative to nested endpoints,
local refs only.

**Pros**
- Small XSD delta; XLink simple/extended precedent.

**Cons**
- Misses the plurality workload (49% external `file:` edges).
- XSD 1.0 cannot express "attributes XOR child endpoints", so `<from>`/`<to>`
  become optional and endpoint-less or dual-form edges validate — the only
  option that *regresses* validation.
- Permanent two-forms-per-element dialect.

### Option B: Compact edge with a three-kind locator micro-syntax (chosen for Stage 1)

`<edge id="E-1" type="satisfies" from="REQ-A" to="GOAL-B"/>` with required
union-typed `@from`/`@to`: bare id ⇒ local (the id lexical space excludes
`:`, `#`, `@`), `rqml:` URI with fragment and optional `?docId=…;version=…;git=…`
⇒ doc, any other scheme ⇒ external (matching the schema's existing external
URI conventions). Hint attributes (`fromKind`/`fromTitle`/`toKind`/`toTitle`)
and the `<notes>` child keep the model lossless. Ships as the **only** edge
form in 2.2.0; `rqml migrate` rewrites existing documents.

**Pros**
- All 779 measured edges compact: −43% edge bytes; whole-file trace share
  32.1% → 21.7%. Endpoints stay `use="required"` — no validation regression.
- The internal model (`TraceEdge`, `Locator` union) is untouched; every
  consumer of the model (CLI, MCP, vscode, plugin hooks, analyzers) is
  unaffected by construction.
- Exactly one dialect; federation pinning fully expressible.

**Cons**
- Breaking serialization change: migrate sweep + drift re-baseline across
  dogfood repos; `updateTraceEdge`'s locator splice must be generalized first.
- Per-field XSD typing of doc refs collapses into one union pattern; trace
  keyrefs become impossible over union values (moot: they are inert today,
  and integrity is code-enforced by design).

### Option C: Non-XML shorthand on disk (`E-X: REQ-A satisfies GOAL-B`)

**Pros**
- Best raw compression (−65%); best raw LLM ergonomics.

**Cons**
- Breaks XML well-formedness and validation for every consumer outside
  @rqml/core; demands a RELAX NG-grade bill (normative grammar, lossless
  bidirectional mapping, reference converter) plus a canonical-serialization
  mandate so drift hashing survives — the debt RDF paid a decade late.
- Only ~11k tokens better than Option B corpus-wide. Its sound variant
  ("agent emits shorthand, tool writes XML") is Option D.

### Option D: Tool-surface only (agents never touch edge XML)

**Pros**
- Zero standard change; write cost already ~13 tokens per edge.

**Cons**
- Does nothing for the read path, which is the measured dominant cost.
- The ReqIF trajectory: viable only if specs stop being readable git-native
  text, which is RQML's core differentiation.

## Decision

Adopt a staged combination (D now, B next, C never for on-disk format):

**Stage 0 — tooling, no standard change (this ADR's implementation):**
Generalize the link primitive (REQ-LOOP-LINK) from hard-coded
implements/verifiedBy-with-external-URI to *any* trace type between two
endpoints, each a declared local id or an external URI, with at least one
local. Orientation stays mechanical for `implements` (external → local) and
`verifiedBy` (local → external) regardless of argument order; other types are
recorded exactly from → to as given. A bare token that looks like an id but
is not declared is a hard error, never silently treated as external. New
edges are stamped `status="draft"` and `createdBy` (tool identity, both
overridable) — the provenance the requirements-log curation loop needs —
and `--notes` / `--confidence` / `--tags` make judgment-bearing markup a flag
away. `createdAt` is deliberately not stamped: git records when, and a
timestamp would break the primitive's determinism. Edge-id derivation for the
two legacy types keeps its prefix pattern (E-IMPL-*/E-VER-*, which
REQ-LOOP-RELINK's matching depends on); other types derive
`E-<TYPE>-<FROM>-<TO>`. All derivations pass through one shared 76-char cap
(leaving room for a `-<n>` collision suffix within the schema's 80-char id
limit), and the append and update paths derive through the same function so the
roundtrip matches even for artifact ids long enough to be truncated.

**Stage 1 — RQML 2.2.0, via the RFC process:** Option B as the single edge
serialization, plus: repair the `allIds` uniqueness key (namespace-prefixed
selectors); delete the inert trace keyrefs and state normatively that
referential integrity is checker-enforced; define one canonical emitted form
(attribute order, self-closing style) that serialize/link/migrate all emit; a
conformance test asserting parse-visible edges equal integrity-visible refs
for every accepted form; `rqml migrate` plus a coordinated drift re-baseline.
Versioned **2.2.0** by the maintainer's call: the model gains no new
functionality — only its serialization changes — and every RQML version
already carries its own targetNamespace, so consumers version-dispatch
regardless (ADR-0014). Whether the 2.0.1 flat `<traceEdge>` compatibility
path retires in the same release is left to the RFC (recommended: yes; the
parser should not carry three edge forms).

**Not adopted:** a non-XML on-disk shorthand. Revisit only if plain-file
agent environments (no CLI/MCP) prove material to adoption, and then only as
expand-on-write.

## Consequences

### Positive
- Edge writes become a ~13-token mechanical call for every trace type; the
  last reason to hand-type edge XML disappears.
- Whole-spec reads shed ~10 points of trace share now (~22k tokens across the
  current corpus) once 2.2.0 lands, with no loss of model richness or
  federation pinning.
- Draft/createdBy stamping turns the trace graph into a curatable log
  (draft → approved), aligning with the oversight workflow.
- The standard keeps one dialect, and its validation story becomes honest:
  XSD for structure, the checker for integrity, stated normatively.

### Negative
- A breaking serialization release lands within weeks of 2.1.0's structured
  locators — visible design churn, accepted while the standard has one user.
- Textual-splice write paths (`edgeBlock`, `updateTraceEdge`) must be
  generalized carefully; the 2.2.0 emitter adds a second serialize branch
  until 2.1.0 documents are migrated.
- Draft-stamped edges introduce a lifecycle the analyzers currently ignore;
  coverage semantics must stay status-blind until curation tooling exists.

## Supersession

None. Extends ADR-0009's textual mutation pattern; narrows ADR-0014's
roundtrip guarantees to a single canonical edge emission per version.
