# ADR-0004: Enforce referential integrity in code, not via XSD identity constraints

- **Status**: Accepted
- **Date**: 2026-05-29
- **Classification**: `discretionary_design_choice`
- **Related requirements**: `REQ-XSD-VALIDATE`, `REQ-VERSION-DISPATCH`, `REQ-TRACE-RESOLVE`, `REQ-ORPHAN`
- **Related ADRs**: `ADR-0001` (version dispatch), `ADR-0002` (WASM-free core entry)
- **Affected components**: `src/analyze/integrity.ts`, `src/index.ts`, `src/validate/schemas/rqml-2.1.0.xsd`, `src/validate/schemas/rqml-2.0.1.xsd`

## Context

The canonical RQML schemas declare identity constraints — `xs:key allIds` for
document-wide id uniqueness and `xs:keyref` constraints (`traceFromRef`,
`traceToRef`, `smInitialRef`, `transitionFromRef`/`transitionToRef`) for trace
and state-machine references. We expected `validate()` to catch duplicate ids
and dangling trace references through these constraints. It does not.

Root cause, verified by systematic probing: the schemas have a target namespace
with `elementFormDefault="qualified"`, but the identity-constraint selectors use
**unprefixed** element names (`.//req`, `.//edge/from/locator/local`). Per XPath
1.0 an unprefixed name matches the null namespace, so against a namespaced,
qualified document the selectors match nothing and the constraints silently
never fire. The libxml2 WASM engine itself is not at fault — the same runtime
*does* enforce a constraint whose selector is correctly prefixed, and
`use="required"`, value, and enum constraints all work. The flaw is in the
schema's selectors, and it affects both `rqml-2.0.1.xsd` and `rqml-2.1.0.xsd`.

This left duplicate-id and dangling-trace-ref detection — checks the editor
previously performed with hand-rolled logic — silently unenforced once
validation was delegated to rqml-core.

## Decision drivers

- These checks are required behavior: trace resolution (`REQ-TRACE-RESOLVE`) and
  orphan detection (`REQ-ORPHAN`) depend on knowing which ids exist and whether
  references resolve.
- The fix must not regress the lazy-WASM boundary (`ADR-0002`): integrity
  checking should be available to consumers that do not load the validation
  engine.
- The two natural fixes — patch the canonical XSD selectors, or add the checks
  in code — have very different ownership and blast radius.

## Options considered

1. **Fix the XSD selectors.** Declare a prefix bound to the target namespace
   (e.g. `xmlns:r="https://rqml.org/schema/2.1.0"`) and prefix every selector
   and field step (`.//r:req`, `.//r:edge/r:from/r:locator/r:local`). This is
   the "correct" schema fix, but the bundled XSDs are byte-checked against the
   canonical schemas published at rqml.org (`REQ-PROVENANCE`); changing them
   here forks the standard and the change properly belongs upstream. It would
   also only help consumers that load the WASM validation engine. Explicitly NOT
   taken without owner sign-off.
2. **Add the checks in rqml-core code.** Implement duplicate-id and
   dangling-trace-ref detection as a WASM-free function over the parsed tree,
   exported from the core entry. Independent of the schema, available without
   loading WASM, and covers both the `2.1.0` nested `<edge>` and `2.0.1` flat
   `<traceEdge>` trace forms. Chosen (user decision, 2026-05-29).

## Decision

Referential integrity is enforced in code by `checkIntegrity(xml)` in
`src/analyze/integrity.ts`, exported from the WASM-free `.` entry. It walks the
whole parsed tree — every section, not just requirements — so a trace edge that
points at a goal resolves correctly rather than being falsely reported as
dangling. It emits a `duplicate-id` diagnostic (source `validate`) for each
redeclaration after the first, and an `unresolved-local-ref` diagnostic (source
`trace`) for each trace endpoint that does not resolve to a declared id,
handling both the nested `2.1.0` and flat `2.0.1` trace forms.

The bundled XSDs are deliberately left as-is: the code path is the chosen source
of truth for these constraints. The canonical selectors must not be "fixed"
without checking with the owner first, because that change forks the byte-checked
schemas and belongs upstream.

## Consequences

**Positive**
- Duplicate ids and dangling trace references are caught again, with source line
  numbers, after delegation to rqml-core.
- Available to every consumer of the core entry without loading the WASM engine.
- Cross-section coverage (ids and references resolve against goals, catalogs,
  etc.), which the requirement-only trace index does not provide.

**Negative**
- Two mechanisms nominally cover the same constraints — the dormant XSD identity
  constraints and the code path — which can mislead a future reader into
  thinking the schema enforces them. Mitigated by documenting the namespace bug
  in `integrity.ts` and in the consuming editor service.
- If the schema is later split into more reference kinds (e.g. `goalLink`,
  transition refs the schema also leaves unenforced), those checks must be added
  to `checkIntegrity` rather than relying on the XSD.
- Detection logic must track schema shape changes that affect ids and references
  across versions.

## Supersession

None. This ADR is current. It would be superseded if the canonical schemas fix
their identity-constraint selectors upstream and rqml-core adopts those schemas.
