---
id: element-trace
title: trace
description: Traceability edges between artifacts.
---

## Summary
Optional section to record explicit trace links across the document.

## Where it appears
- `rqml > trace`

## Content model
- `traceEdge` (0..n) → `notes` (0..1)

## Attributes
| Element | Name | Type | Required | Default | Description |
| --- | --- | --- | --- | --- | --- |
| traceEdge | `id` | IdType | yes | — | Edge identifier. |
| traceEdge | `from` | IdType | yes | — | Source element ID (must exist). |
| traceEdge | `to` | IdType | yes | — | Target element ID (must exist). |
| traceEdge | `type` | TraceType | yes | — | Relation (refines, satisfies, dependsOn, conflictsWith, threatens, mitigates, verifiedBy, covers, implements). |
| traceEdge | `confidence` | ConfidenceType (0..1) | no | — | Confidence level. |

## Example (minimal)
```xml
<trace>
  <traceEdge id="TR-1" from="REQ-1" to="GOAL-1" type="satisfies"/>
</trace>
```

## Example (typical)
```xml
<trace>
  <traceEdge id="TR-001" from="REQ-AUTH-001" to="GOAL-AVAIL" type="satisfies" confidence="0.9">
    <notes>Primary requirement fulfilling availability goal for payments.</notes>
  </traceEdge>
  <traceEdge id="TR-002" from="TC-AUTH-001" to="REQ-AUTH-001" type="verifiedBy"/>
</trace>
```

## Notes / LLM hints
- Ensure `from` and `to` reference existing IDs; validation will fail otherwise.
- Pick the most specific relation type; use `notes` for rationale when it is not obvious.
