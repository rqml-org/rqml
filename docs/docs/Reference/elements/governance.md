---
id: element-governance
title: governance
description: Issues and approvals governing the specification.
---

## Summary
Optional section for change control, issues, and approvals.

## Where it appears
- `rqml > governance`

## Content model
- `issue` (0..n) → `statement` (1), `notes` (0..1)
- `approval` (0..n) → `description` (0..1)

## Attributes
| Element | Name | Type | Required | Default | Description |
| --- | --- | --- | --- | --- | --- |
| issue | `id` | IdType | yes | — | Issue identifier. |
| issue | `status` | StatusType | no | — | Issue state. |
| issue | `owner` | string | no | — | Responsible party. |
| approval | `id` | IdType | yes | — | Approval identifier. |
| approval | `role` | string | yes | — | Approving role. |
| approval | `status` | StatusType | no | — | Approval state. |

## Example (minimal)
```xml
<governance>
  <issue id="ISS-1">
    <statement>Clarify payment token scope.</statement>
  </issue>
</governance>
```

## Example (typical)
```xml
<governance>
  <issue id="ISS-PCI" status="review" owner="Compliance">
    <statement>Confirm PCI scope for stored tokens.</statement>
    <notes>Pending decision on vault provider.</notes>
  </issue>
  <approval id="APR-SEC" role="Security Lead" status="draft">
    <description>Security sign-off required before launch.</description>
  </approval>
</governance>
```

## Notes / LLM hints
- Use `issue` to log open questions or deviations and track them with `status`.
- Capture sign-offs with `approval` entries for auditability.
