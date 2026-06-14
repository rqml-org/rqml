# ADR-0009: Status transitions are a textual core mutation primitive

- Status: Accepted
- Date: 2026-06-14
- Classification: derived_from_requirements
- Related requirements: REQ-CORE-SETSTATUS, REQ-LOOP-APPROVE, REQ-STATUS-ENUM, REQ-LOOP-LINK, REQ-MCP-READONLY
- Related ADRs: ADR-0003 (deterministic checking), ADR-0008 (the accept workflow that consumes it)
- Affected components: core (status-transition edit), cli (approve), mcp (approve tool)

## Context

Approving a requirement today means hand-editing `status="draft"` to
`status="approved"` in the XML. For an interactive review→accept workflow this
transition must instead be mechanical, auditable, and safe: it must preserve the
document's comments and hand formatting (diff-friendliness) and must never
produce an invalid document.

The toolchain already has exactly this shape for trace edges. `edit/link.ts`
(`appendTraceEdge`, `updateTraceEdge`, realizing REQ-LOOP-LINK/RELINK) performs a
*textual* edit — insert or replace a small span — then re-parses and
integrity-checks before returning, so comments and formatting survive and a
broken edit is rejected. A status transition is the same kind of operation on a
single attribute.

## Decision drivers

- Diff-friendliness (QGOAL-DIFF): a status flip must not reformat the file.
- Safety: reject any edit that breaks parse or referential integrity.
- Determinism: same input, same output.
- Reuse the proven link primitive's contract rather than invent a new one.
- Writes are explicit caller intent, consistent with REQ-MCP-READONLY.

## Options considered

### Option 1: Parse → mutate the model → serialize
Round-trip through the typed model and re-serialize the whole document.

**Pros**
- Conceptually simple; reuses the serializer.

**Cons**
- Re-serialization churns whitespace and risks losing or moving comments,
  defeating QGOAL-DIFF and producing noisy PRs.

### Option 2: Textual in-place attribute edit mirroring edit/link.ts (chosen)
Edit the `status` attribute in the document text, then parse-guard → reparse →
integrity-guard → return, rejecting unsafe edits.

**Pros**
- Comments and formatting are byte-preserved outside the changed attribute.
- Safe by construction; reuses a proven, tested pattern.

**Cons**
- Textual editing requires careful matching (mitigated by following the existing
  `link.ts` approach).

### Option 3: Leave it to hand edits / sed
Document the manual flip.

**Pros**
- No code.

**Cons**
- Exactly the high-friction, error-prone manual XML editing the toolchain exists
  to eliminate; not auditable.

## Decision

Adopt **Option 2**. Add a status-transition edit to `@rqml/core` (e.g.
`edit/status.ts` → `setStatus`) that changes a named artifact's `status`
attribute in the document text in place, preserving comments and formatting,
re-parsing and integrity-checking before returning, and rejecting any edit that
would not parse or would introduce an integrity violation (REQ-CORE-SETSTATUS).
The CLI `rqml approve` and an MCP approve tool wrap it as explicit-intent writes,
like `rqml link` (REQ-LOOP-APPROVE, REQ-MCP-READONLY).

## Consequences

### Positive
- Accepting a requirement becomes mechanical, auditable, and diff-clean.
- Reuses a battle-tested mutation pattern; safe by construction.

### Negative
- Adds a second write surface to MCP; the explicit-intent discipline must hold.
- Textual editing is regex-careful, as `link.ts` already is.

## Supersession

None
