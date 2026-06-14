# ADR-0011: Optional, certified-only approval provenance metadata

- Status: Proposed
- Date: 2026-06-14
- Classification: discretionary_design_choice
- Related requirements: REQ-APPROVAL-PROVENANCE, REQ-ENFORCE-CERTIFIED, REQ-STATUS-ENUM, REQ-BACKWARD-COMPAT
- Related ADRs: ADR-0008 (the accept gate that produces the approval event), ADR-0009 (the transition primitive that records it)
- Affected components: schema (XSD), core (validation/coverage under certified), cli, mcp

## Context

Once acceptance is a real workflow (ADR-0008, ADR-0009), the act of accepting is
still ephemeral: flipping a requirement to `status="approved"` records no *who*
and no *when*. The current approval model is role-based — `governance/approval`
carries a role and a status — with no individual approver identity, timestamp,
or conditional sign-off, and trace edges carry `createdBy`/`createdAt` attributes
that are presently unused.

Regulated domains (IEC 62304, ISO 26262), which the certified strictness level
already targets (REQ-ENFORCE-CERTIFIED), need audit-grade provenance for an
approval. Most projects do not, and forcing approver/timestamp metadata on
lightweight users would be hostile to the low-ceremony goal.

This is the one decision in this set held at **Proposed**, because unlike the
others it changes the XSD — a published contract — and warrants explicit sign-off.

## Decision drivers

- Audit-grade evidence under certified strictness (REQ-ENFORCE-CERTIFIED).
- Backward compatibility: minor versions are additive; documents valid under an
  earlier 2.x schema must stay valid (REQ-BACKWARD-COMPAT).
- Do not burden relaxed/standard/strict users with provenance ceremony.
- Reuse the existing strictness ladder and the dormant `createdBy`/`createdAt`
  convention for consistency.

## Options considered

### Option 1: No schema change — status flip only
Leave provenance out of the spec.

**Pros**
- Nothing to change; stays minimal.

**Cons**
- No durable record of who approved an artifact or when; insufficient as
  audit-grade evidence for certified users.

### Option 2: Optional provenance metadata, certified-only (chosen)
Add optional `approvedBy` / `approvedAt` (and possibly `conditions`) metadata,
all attributes optional and additive so older documents validate unchanged;
require and check it only under certified strictness.

**Pros**
- Audit-grade accept records where they are needed; opt-in elsewhere.
- Additive — existing documents remain valid (REQ-BACKWARD-COMPAT).
- Rides the existing strictness ladder.

**Cons**
- A schema change, however additive, is a contract change requiring care.
- Certified-mode validation/coverage must learn the new check; surfaces may want
  to display provenance.

### Option 3: Track provenance entirely outside the spec
Rely on git history or an external approval log.

**Pros**
- No schema change.

**Cons**
- Decouples the evidence from the artifact it certifies; weaker as the
  authoritative record (git remains a useful corroborating source).

## Decision

(Proposed) Adopt **Option 2**: extend the schema with optional,
backward-compatible approval-provenance metadata — approver identity and
timestamp — required and checked only under the certified strictness level, and
absent with no effect under relaxed/standard/strict (REQ-APPROVAL-PROVENANCE).
Hold this ADR at Proposed pending sign-off, since it alters the XSD contract.

## Consequences

### Positive
- Audit-grade approval records for regulated users; opt-in for everyone else.
- Older documents are unaffected.

### Negative
- A schema/contract change requires versioning care.
- Certified validation/coverage gains a new check; overview and matrix may want
  to surface provenance.

## Supersession

None
