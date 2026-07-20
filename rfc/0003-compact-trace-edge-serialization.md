---
rfc: 0003
title: "Compact trace-edge serialization"
status: Accepted
author: "Gardar (with Claude)"
created: 2026-07-20
requires-version: "2.2.0"
---

# Summary

Replace the verbose nested trace-edge serialization with a compact,
attribute-form edge, as the single canonical edge form in RQML **2.2.0**:

```xml
<!-- 2.1.0 (today) -->
<edge id="E-PORT-GATECI-H1" type="satisfies" confidence="0.9">
  <from><locator><local id="REQ-PORT-GATE-CI"/></locator></from>
  <to><locator><local id="GOAL-H1-SUBSTRATE"/></locator></to>
</edge>

<!-- 2.2.0 (this RFC) -->
<edge id="E-PORT-GATECI-H1" type="satisfies" confidence="0.9"
      from="REQ-PORT-GATE-CI" to="GOAL-H1-SUBSTRATE"/>
```

The three locator kinds that the 2.1.0 endpoint model expresses — `local`,
`doc`, `external` — survive fully, encoded as a lexically-discriminated
micro-syntax in the `from`/`to` attributes rather than as nested elements. No
information is lost: doc-locator pinning (`version`/`git`/`docId`) and the
locator hint fields (`kind`/`title`) are preserved. Only the serialization
changes; the abstract model (`LocalLocator | DocLocator | ExternalLocator`) is
untouched.

This is a **breaking serialization change** with no functional additions,
which is why it is a minor version (2.2.0), not a major one — see
[Compatibility](#compatibility). It is the schema half of the plan recorded in
ADR-0017; the tooling half (generalized `rqml link`) already shipped as
"Stage 0".

# Motivation

Trace edges are the single largest and fastest-growing cost of authoring and
reading RQML documents, and the cost is almost entirely scaffolding.

Measured across the six dogfood specs (779 edges):

- Trace edges are **32.1% of all spec bytes** (~51k tokens). This tax is paid
  on every whole-document read — session-start hooks, `Read` of a governing
  spec, any tool that loads the file.
- The compact form cuts edge bytes by **43%** (attribute-form, fully lossless),
  dropping the trace section's share of a whole-file read from 32.1% to
  **21.7%** — roughly 22k tokens across the current corpus.
- The `<from><locator><local id="…"/></locator></from>` wrapper is **44 bytes
  of scaffolding per endpoint** that encodes exactly one bit of real
  information: which of the three locator kinds this endpoint is.

Who this helps:

- **Agents**, which are the primary authors and readers of edges. In
  agent-driven development `requirements.rqml` behaves as a *requirements log*
  that accretes edges continuously through prompting, so both the per-edge
  write cost and the whole-file read cost compound over a project's life.
- **Humans** reading diffs and specs: a one-line edge is scannable; a six-line
  edge is not.
- **Tool builders**: the abstract model is unchanged, so consumers that read
  the parsed model need no changes at all (verified — see
  [Compatibility](#compatibility)).

The rich edge markup that the verbose form was built to carry (`status`,
`createdBy`, `tags`, `confidence`, `<notes>`) is **not** what makes edges
verbose — those are already attribute/child form and carry over unchanged.
Compaction removes only the endpoint scaffolding, which makes the rich markup
*more* affordable to use, not less.

# Goals

- Make the compact attribute-form edge the single canonical serialization in
  2.2.0 — one dialect, no permanent second form.
- Preserve the full expressiveness of the 2.1.0 endpoint model: all three
  locator kinds, doc-locator `version`/`git`/`docId` pinning, and the
  `kind`/`title` hint fields.
- Keep `from`/`to` **required** in the schema (no endpoint-optional regression).
- Keep the strongest lexical validation XSD 1.0 (libxml2, no assertions) can
  express for the endpoint values.
- Make the document's real validation posture honest and normative: XSD checks
  structure; the reference checker (`checkIntegrity`) enforces id-uniqueness
  and reference resolution.
- Ship a deterministic `rqml migrate` that rewrites existing dogfood documents
  with a clean, reviewable diff.

# Non-goals

- A non-XML on-disk shorthand (e.g. `E-X: REQ-A satisfies GOAL-B`). Rejected;
  see [Alternatives](#alternatives-considered).
- Any change to trace *semantics*, the `TraceType` vocabulary, coverage/drift
  analysis, or the abstract locator model. Only serialization changes.
- New edge capabilities. This RFC removes zero features and adds zero features;
  it re-encodes an existing model.
- Cross-document *resolution* (fetching and validating the target of a doc
  locator). Doc locators remain unresolved references, exactly as today.

# Proposed design

## Schema changes

### 1. Compact `edge` content model

`TraceEdgeType` loses its `from`/`to` child elements and gains `from`/`to`
**required** attributes, plus optional companion hint attributes. The `notes`
child and all existing metadata attributes are retained.

```xml
<xs:complexType name="TraceEdgeType">
  <xs:sequence>
    <xs:element name="notes" type="TextBlockType" minOccurs="0"/>
  </xs:sequence>

  <xs:attribute name="id"   type="IdType"    use="required"/>
  <xs:attribute name="type" type="TraceType" use="required"/>

  <!-- Endpoints: required, union-typed micro-syntax (see below). -->
  <xs:attribute name="from" type="TraceEndpointRef" use="required"/>
  <xs:attribute name="to"   type="TraceEndpointRef" use="required"/>

  <!-- Endpoint hint fields (formerly @kind/@title on the nested locators). -->
  <xs:attribute name="fromKind"  type="xs:token"/>
  <xs:attribute name="fromTitle" type="xs:string"/>
  <xs:attribute name="toKind"    type="xs:token"/>
  <xs:attribute name="toTitle"   type="xs:string"/>

  <!-- Unchanged edge metadata. -->
  <xs:attribute name="confidence" type="ConfidenceType"/>
  <xs:attribute name="status"     type="StatusType"/>
  <xs:attribute name="createdBy"  type="xs:string"/>
  <xs:attribute name="createdAt"  type="xs:dateTime"/>
  <xs:attribute name="tags"       type="xs:NMTOKENS"/>
</xs:complexType>
```

**Deleted types** (no longer referenced): `TraceEndpointType`,
`TraceLocatorType`, `TraceLocalRefType`, `TraceDocRefType`,
`TraceExternalRefType`.

### 2. The endpoint micro-syntax

An endpoint value is one of three shapes, discriminated by its leading
characters. This works because `IdType` forbids `:`, `#`, and `@`.

```
endpoint = local | doc | external

local    = IdType                       ; e.g. REQ-A, GOAL-H1-SUBSTRATE
                                        ; [A-Za-z][A-Za-z0-9._-]{1,79}, no ":" "#" "@"

doc      = "rqml:" doc-uri "#" fragment ; a reference into another RQML document
doc-uri  = <URI reference>               ; may itself contain "#": the value is
                                        ; split at the LAST "#" (pin values
                                        ; never contain "#", so this is
                                        ; unambiguous)
fragment = id [ ";" pin *( ";" pin ) ]   ; target element id, then optional pins
pin      = "version=" pinval
         | "git="     pinval
         | "docId="   IdType

external = scheme ":" *char             ; scheme ≠ "rqml"
                                        ; e.g. file:src/a.ts#L10, jira:PROJ-1, urn:gdpr:article:17
         | rel-path                     ; schemeless relative path with "/"
                                        ; e.g. packages/core/src/edit/link.ts#runLink
```

The `rel-path` external form exists because the toolchain records external
locators as repo-relative paths without a `file:` prefix (that is what
`rqml link` writes and what drift hashing and gate path-matching compare
against); requiring a scheme would force a lossy rewrite of every existing
external locator. A bare token with no `/` and no scheme remains **invalid**
as an external — it is either a declared local id or an error, preserving the
typo protection described under Security.

Examples of each kind (the same three edges as a local–local, a doc ref with a
version pin, and an external file ref):

```xml
<edge id="E-1" type="satisfies" from="REQ-A" to="GOAL-B"/>

<edge id="E-2" type="dependsOn"
      from="REQ-PAY-001"
      to="rqml:auth-spec.rqml#REQ-AUTH-001;version=2.1.0;git=a1b2c3d4;docId=AUTH-DOC"/>

<edge id="E-3" type="implements"
      from="file:src/auth/login.ts#L42-L87" fromKind="code"
      to="REQ-AUTH-001"/>
```

Doc-locator pins are carried in the **fragment**, after the target id, as
`;`-separated `key=value` pairs. Two deliberate encoding choices:

- **`;` not `&`** as the separator, so no `&amp;` escaping is ever needed inside
  an XML attribute value.
- **pins in the fragment, not the query**, so the document URI before `#` stays
  pristine and may carry its own `?query` (e.g.
  `rqml:https://host/spec.rqml?ref=main#REQ-X;version=2.1.0`). The id is
  `IdType` and contains no `;`, so the split is unambiguous: fragment up to the
  first `;` is the id, the rest are pins.

### 3. XSD validation of endpoint values (and its limit)

`TraceEndpointRef` is a union of two pattern-restricted members:

```xml
<xs:simpleType name="TraceEndpointRef">
  <xs:union memberTypes="TraceLocalRef TraceSchemeRef TracePathRef"/>
</xs:simpleType>

<xs:simpleType name="TraceLocalRef">
  <xs:restriction base="xs:token">
    <xs:pattern value="[A-Za-z][A-Za-z0-9._\-]{1,79}"/>   <!-- IdType shape -->
  </xs:restriction>
</xs:simpleType>

<xs:simpleType name="TraceSchemeRef">
  <xs:restriction base="xs:token">
    <xs:pattern value="[A-Za-z][A-Za-z0-9+.\-]*:.+"/>      <!-- any scheme URI -->
  </xs:restriction>
</xs:simpleType>

<xs:simpleType name="TracePathRef">
  <xs:restriction base="xs:token">
    <xs:pattern value="[^:\s]+/[^\s]*"/>                   <!-- schemeless rel path -->
  </xs:restriction>
</xs:simpleType>
```

XSD 1.0's regular-expression language has **no lookahead**, so "any scheme
*except* `rqml:`" cannot be written as a pattern. `TraceSchemeRef` therefore
matches doc *and* external values alike. This is fine for XSD's job, which is
only to confirm each endpoint is *well-formed as one of the shapes* (rejecting
garbage like `has space` or `#nofragment`). Precise discrimination — is this
a doc locator or an external one, and does a `rqml:` value carry the required
`#fragment`? — is performed by the reference checker, consistent with RQML's
existing "referential integrity in code, not XSD" architecture (rqml-core
ADR-0004). See [Security / safety](#security--safety--misuse-considerations)
for the one behavior this pushes to code.

### 4. Identity constraints: repair the key, retire the trace keyrefs

The 2.1.0 identity constraints are **inert**: their selector XPaths use
unprefixed element names (`.//edge`), which in a schema with a target
namespace resolve to *no namespace* and match nothing (empirically confirmed
with libxml2). This RFC:

- **Repairs `allIds`** by binding a prefix to the target namespace on the
  `<xs:schema>` element (`xmlns:r="https://rqml.org/schema/2.2.0"`) and
  qualifying every selector step (`.//r:edge`, `.//r:req`, …). Id-uniqueness
  then becomes genuinely XSD-enforceable. (Same one-line-per-step fix applies
  to `smInitialRef`/`transitionFromRef`/`transitionToRef`.) The repaired
  constraint is `xs:unique`, not `xs:key`: a key requires the field on every
  selected node, and some selected elements legitimately carry no `@id` (the
  leaf-text use of `decision`) — discovered the moment the repaired constraint
  first ran against a real document. `xs:unique` excludes id-less nodes while
  still rejecting duplicates, and keyrefs may refer to a unique.
- **Deletes `traceFromRef` and `traceToRef`.** They cannot be expressed over
  the union-typed endpoint attributes: an identity-constraint field XPath
  allows no predicates, so it cannot select "only the endpoints that are local
  ids", and a union value holding `file:src/a.ts` is not a declared id. They
  are inert today regardless. Reference resolution stays in `checkIntegrity`,
  stated normatively (see [Semantics](#semantics)).

### 5. Version and namespace

`version` fixed at `2.2.0`; `targetNamespace` and the default `xmlns` become
`https://rqml.org/schema/2.2.0`. Every RQML version already carries its own
target namespace, so a bump forces a one-line document edit regardless of how
much else changes — which is part of why a serialization-only change is still
a legitimate minor version rather than a major one.

## Semantics

Add normative conformance language to the schema's documentation and to the
standard:

> A conforming RQML processor MUST enforce id-uniqueness across the document
> and MUST resolve every `local` trace endpoint to a declared id. XSD
> validation alone is **not** conformance: the schema constrains structure and
> the lexical shape of endpoint values, but referential integrity is enforced
> by the processor. `doc` and `external` endpoints are unresolved references
> and are not checked for existence.

This is honest about the architecture that already exists (the keyref
namespace defect made code-level checking load-bearing, and the maintainer
chose it deliberately), and it converts five silently-dead XSD constraints into
a stated design position.

The compact and verbose forms are **model-equivalent**: a processor parses a
2.2.0 compact edge to the exact same `TraceEdge` the 2.1.0 verbose edge would
have produced. `parse → serialize` is idempotent and emits the one canonical
compact form (see below); there is no round-trip `form` hint on the model.

### Canonical serialization

Tooling (`serialize`, `rqml link`, `rqml migrate`) MUST emit edges in one fixed
form so diffs are stable and drift baselines are byte-predictable:

- Attribute order: `id`, `type`, `from`, `fromKind?`, `fromTitle?`, `to`,
  `toKind?`, `toTitle?`, `confidence?`, `status?`, `createdBy?`, `createdAt?`,
  `tags?`.
- Self-closing when there is no `<notes>` child; otherwise the child is
  indented one level under the edge.

The existing serializer already branches on document version (2.0.1 flat vs
2.1.0 nested trace output); the 2.2.0 compact emitter is a third branch, for
which rqml-core ADR-0006 (version-aware trace parse/serialize) is the direct
precedent.

## Examples

**Before (2.1.0) — a local edge, a doc edge with pinning, an external edge:**

```xml
<trace>
  <edge id="E-1" type="satisfies" confidence="0.9">
    <from><locator><local id="REQ-A"/></locator></from>
    <to><locator><local id="GOAL-B"/></locator></to>
  </edge>
  <edge id="E-2" type="dependsOn">
    <from><locator><local id="REQ-PAY-001"/></locator></from>
    <to><locator>
      <doc uri="auth-spec.rqml" docId="AUTH-DOC" id="REQ-AUTH-001" version="2.1.0" git="a1b2c3d4"/>
    </locator></to>
  </edge>
  <edge id="E-3" type="implements">
    <from><locator><external uri="file:src/auth/login.ts#L42-L87" kind="code"/></locator></from>
    <to><locator><local id="REQ-AUTH-001"/></locator></to>
  </edge>
</trace>
```

**After (2.2.0):**

```xml
<trace>
  <edge id="E-1" type="satisfies" from="REQ-A" to="GOAL-B" confidence="0.9"/>
  <edge id="E-2" type="dependsOn" from="REQ-PAY-001"
        to="rqml:auth-spec.rqml#REQ-AUTH-001;version=2.1.0;git=a1b2c3d4;docId=AUTH-DOC"/>
  <edge id="E-3" type="implements"
        from="file:src/auth/login.ts#L42-L87" fromKind="code" to="REQ-AUTH-001"/>
</trace>
```

An edge with a rationale keeps `<notes>` and stays compact:

```xml
<edge id="E-4" type="satisfies" from="REQ-A" to="GOAL-B"
      confidence="0.8" status="draft" createdBy="rqml" tags="safety compliance">
  <notes>Gate-CI is the enforcement mechanism the goal sells; without it the goal is aspirational.</notes>
</edge>
```

# Compatibility

**Existing documents:** breaking. Every 2.1.0 (and 2.0.1) document must be
migrated; a 2.1.0-shaped edge does not validate under the 2.2.0 schema and
vice versa. This is acceptable *now* and expensive *later*: there are no RQML
documents outside the ~7 dogfood repos, so the migration is a single scripted
sweep the maintainer runs and reviews. The same change after external adoption
would be a major, coordinated event. Doing it pre-1.0 is the cheap window.

**Tools reading the parsed model:** unaffected, by construction. The abstract
`TraceEdge`/`Locator` model does not change, so every consumer that reads the
model rather than raw edge XML needs zero changes — verified for the CLI, the
MCP server, `rqml-vscode` (delegates entirely to `@rqml/core`), and the
plugin hooks (`rqml-claude`/`rqml-codex`/`rqml-opencode`), all of which consume
only the model.

**Tools reading raw edge text:** any grep/sed-level downstream that matches
`<from><locator>` breaks. None are known in the ecosystem; if one exists it is
a one-time fix.

**Core packages (`@rqml/core` et al.):** the change touches ~4 files
(`parse`, `serialize`, `integrity`, `edit/link`, plus `skeleton` snippets) and
the XSD. `parse` already normalizes two edge shapes (2.1.0 nested `<edge>` and
2.0.1 flat `<traceEdge>`) into one model — `parseFlatEdge` is the direct
precedent for adding a third (compact) reader. Accepting a new input form is a
minor bump for core; **emitting** compact by default is breaking for any
text-level downstream and lands with the 2.2.0 schema, not before.

**Version dispatch:** the standard SHOULD state that a processor MUST reject a
document whose `version` it does not recognize, so an old pinned `@rqml/core`
fails loudly on a 2.2.0 document rather than misparsing it.

**Retire the 2.0.1 flat `<traceEdge>` path:** recommended in this same release.
With no 2.0.1 documents in existence, carrying three edge readers in the parser
is pure liability. (Open question below if the maintainer wants to keep it.)

# Migration plan

Ship `rqml migrate` (`@rqml/core` + a `rqml migrate` CLI command):

1. **Parse** the source document (any of 2.0.1 / 2.1.0) to the model — the
   existing multi-version parser already does this.
2. **Rewrite in place, minimally:** replace each `<edge>…</edge>` block in the
   trace section with its canonical compact form, and update the root
   `version`/`xmlns`. Everything outside the trace section and the root tag is
   left byte-identical, so the diff is exactly "the trace section got shorter"
   — consistent with the toolchain's diff-friendliness value (QGOAL-DIFF), and
   far more reviewable than a whole-document reserialize.
3. **Leave drift baselines untouched.** Baselines hash linked-ARTIFACT
   content keyed by edge id; migration changes neither, so the recorded state
   carries over exactly. A clean repo checks clean immediately after
   migration with no re-baselining — and, critically, re-recording would
   silently bless any drift that already existed, which a deterministic-
   enforcement tool must never do. (An earlier draft of this step prescribed
   an in-pass re-record; adversarial review showed its only real effect was
   exactly that drift-blessing, and it was removed.)
4. The maintainer runs it across the dogfood repos in one sitting and commits
   the diffs.

Manual migration is not expected; the corpus is small and scripted migration
is exact.

## Required guard: parse/integrity form parity

`integrity.ts` is a **second, independent raw-XML parser** (its own tree walk
plus raw-text line regexes for id-uniqueness and dangling-ref detection). If it
is not taught the compact form, compact edges silently escape duplicate-id and
dangling-reference checking — the highest-severity possible failure, because
deterministic enforcement is the product's core promise. This RFC therefore
**requires** a conformance test asserting that, for every accepted edge form,
the set of edges and references visible to `parse` equals the set visible to
`checkIntegrity`.

# Alternatives considered

**A. Attribute shorthand for local endpoints only, on the existing `<edge>`.**
`from="REQ-A" to="GOAL-B"` for local refs, nested elements retained for
doc/external. Rejected: misses the plurality workload (49% of real edges are
external `file:` implements/verifiedBy edges), and XSD 1.0 cannot forbid an
edge that has *both* `@from` and `<from>` (no co-occurrence constraints, and
libxml2 rejects `xs:assert`), so `<from>`/`<to>` would have to become optional
— the only option that *regresses* validation.

**B1. Additive `<link>` sibling element (compact) alongside a retained
`<edge>` (verbose), superset, non-breaking.** Rejected as the primary path
because it bakes a permanent two-dialect vocabulary into the standard at
adoption time — every future consumer must parse both forever, and the RDF/XML
-vs-Turtle and SHACL-compact histories show the "temporary" second form never
dies. B1's only real advantage is protecting adopters who do not exist yet.
Kept as the **fallback** if an untracked early adopter turns out to hold 2.1.0
documents (see open questions): ship B1 and set a deprecation date for `<edge>`
the day it lands.

**C. Non-XML on-disk shorthand** (`E-X: REQ-A satisfies GOAL-B @0.9`).
Rejected as a file format. It compresses ~22 points more than compact XML
(~11k additional tokens corpus-wide) but breaks XML well-formedness and XSD
validation for every consumer outside `@rqml/core`, and demands the full
RELAX-NG-grade specification bill (normative grammar, lossless bidirectional
mapping including comments, a reference converter) plus a canonical-
serialization mandate so drift hashing and git pinning survive two byte-forms
of one edge — the debt RDF paid a decade late with RDF-CANON. Its only sound
mode ("agent emits shorthand, tool writes canonical XML") is the already-
shipped Stage-0 tooling wearing a costume. May be revisited *only* if
plain-file agent environments (no CLI/MCP) prove material to adoption, and then
only as expand-on-write.

**Hybrid: compact attributes for local/external, optional nested `<doc>` child
for doc locators.** Rejected: reintroduces two endpoint forms for the sake of
the rarest edge kind (6.5%). The doc micro-syntax expresses everything the
nested `<doc>` did, so the nested form earns nothing but complexity.

**Keep the trace keyrefs (repaired).** Rejected: identity-constraint field
XPaths permit no predicates, so a keyref cannot be scoped to "only local
endpoints" of a union-typed attribute, and a `file:` value is not a declared
id. Repairing them is impossible over the compact form; they are inert today.

# Open questions

- **Adoption ground truth.** Does *any* consumer outside the dogfood repos hold
  a 2.1.0 document or pin a specific `@rqml/*` version (real npm installs, CI
  images, a colleague)? If yes, switch to the B1-then-deprecate fallback. The
  recommendation assumes the answer is no.
- **Retire the 2.0.1 flat `<traceEdge>` reader** in this release (recommended),
  or keep it for one more version out of caution?
- **Hint attributes.** Keep `fromTitle`/`toTitle` for full losslessness
  (measured cost: 2.2% of edge bytes), or drop titles from the standard as
  derivable display sugar and keep only `fromKind`/`toKind` (which `rqml link`
  actively emits)? This RFC assumes keep, per ADR-0017.
- **`rqml link` doc-locator support.** Stage 0 deferred `rqml:` endpoints. Does
  2.2.0's `rqml link` gain doc-locator authoring (`rqml link REQ-A
  'rqml:other.rqml#REQ-X;version=2.1.0' --type dependsOn`), or do doc edges
  stay hand-authored (then tool-validated) for now?
- **`createdAt`.** Kept in the schema for completeness, but Stage 0 does not
  stamp it (git records when; a timestamp breaks the primitive's determinism).
  Keep the attribute available for hand/CI authoring, or drop it entirely?

# Security / safety / misuse considerations

The change is about serialization, not meaning, so it does not make
requirements more ambiguous. Two lexical hazards are handled explicitly:

- **Malformed `rqml:` values falling through to `external`.** A value like
  `rqml:auth.rqml` with no `#fragment` matches the broad `TraceSchemeRef`
  pattern and would validate against XSD, but it is a broken doc locator, not
  an external one. The reference checker MUST classify any `rqml:`-scheme value
  as a doc locator and **reject** it if it lacks a valid `#id` fragment, rather
  than silently treating it as an external URI (which would hide a dangling
  cross-document reference). A conformance test covers this.
- **A typoed id silently becoming an "external" locator.** Because a bare token
  that is not a declared id could look like a scheme-less string, authoring
  tools MUST treat a bare `IdType`-shaped endpoint as a *local* reference and
  error if it is undeclared, never coerce it to an external URI. (Stage 0's
  `rqml link` already does exactly this.)

Unrelated but adjacent, surfaced during review of the compact `confidence`
attribute: `ConfidenceType` is `xs:decimal`, which does **not** accept
exponential notation, so a serializer that renders a tiny confidence as
`1e-7` produces an XSD-invalid document. The canonical serializer MUST emit
`confidence` as a plain decimal. (This hazard exists in 2.1.0 too; 2.2.0 is a
natural place to specify the fix.)

# Reference implementation

- **Stage 0 (shipped):** ADR-0017 and the generalized `rqml link` /
  `rqml_link` (any `TraceType`, endpoint classification with the local-vs-
  external discrimination rule above, draft/`createdBy` provenance stamping)
  are implemented and tested in `@rqml/core`, `@rqml/cli`, `@rqml/mcp`. The
  endpoint-classification and orientation logic this RFC formalizes is already
  running in `packages/core/src/edit/link.ts`.
- **Parser precedent:** `parse.ts::parseFlatEdge` already normalizes a second
  historical edge shape into the one model — the pattern a compact reader
  follows.
- **Serializer precedent:** the version-keyed trace-output branch in
  `serialize.ts` (2.0.1 flat vs 2.1.0 nested) is where the 2.2.0 compact
  emitter slots in.
- Not yet built: the 2.2.0 XSD, the compact parse/serialize branches, the
  `integrity.ts` compact reader, `rqml migrate`, and the form-parity
  conformance test.
- **Schema fragments verified:** the `TraceEndpointRef` union and the compact
  `TraceEdgeType` in this RFC were checked against libxml2 (`xmllint --schema`):
  the three example edges validate; a missing `@from` is rejected; a
  whitespace endpoint is rejected by the union; and the namespace-prefixed
  `allIds` key fires on a duplicate id (the repair). These are the same engine
  and behaviors `@rqml/core` relies on via `libxml2-wasm`.

# Decision record

- Status: **Accepted**
- Maintainer decision date: 2026-07-20
- Rationale: The read-path token tax (32.1% of spec bytes) can only be fixed by
  changing the bytes on disk; the compact form is lossless against the 2.1.0
  model, keeps endpoints required, and the pre-adoption window (no documents in
  the wild) makes a breaking serialization change a one-sitting migration.
  Versioned 2.2.0 — no new functionality, only the serialization changes.
