---
id: trace
title: Trace
sidebar_position: 10
description: Connect goals, scenarios, requirements, interfaces, and tests.
---

The optional `trace` section encodes explicit relationships between artifacts to support impact analysis and coverage.

## Elements
- `traceEdge`: Each edge has `@id`, `from`, `to`, `type`, and optional `confidence` (0.0–1.0) with optional `notes`.
- `type` uses `TraceType` enumeration: `refines`, `satisfies`, `dependsOn`, `conflictsWith`, `threatens`, `mitigates`, `verifiedBy`, `covers`, `implements`.

## Authoring tips
- Ensure `@from` and `@to` reference existing IDs; the schema enforces this via keyrefs.
- Choose the most specific relation type; prefer `satisfies` for requirement coverage and `mitigates` for risk handling.
- Keep `notes` concise to explain rationale or scope boundaries for the link.

## Example
```xml
<trace>
  <traceEdge id="TR-001" from="REQ-AUTH-001" to="GOAL-AVAIL" type="satisfies" confidence="0.9">
    <notes>Primary requirement fulfilling availability goal for payments.</notes>
  </traceEdge>
  <traceEdge id="TR-002" from="TC-AUTH-001" to="REQ-AUTH-001" type="verifiedBy"/>
  <traceEdge id="TR-003" from="OBS-DB" to="GOAL-AVAIL" type="threatens"/>
</trace>
```

## Theory
- Traceability supports impact analysis, coverage, and compliance—core to IEEE 29148 and safety standards like IEC 61508/ISO 26262.
- Relation types encode rationale (satisfies/refines/mitigates) and help tools visualize coverage graphs.
- Confidence values express uncertainty, enabling risk-aware decisions during change.
- Bibliography: [IEEE 29148-2018](https://standards.ieee.org/standard/29148-2018.html), [IEC 61508](https://webstore.iec.ch/publication/5510), [ISO 26262](https://www.iso.org/standard/68383.html), [An Analysis of Traceability](https://dl.acm.org/doi/10.1145/167088.167111).
