---
id: governance
title: Governance
sidebar_position: 11
description: Track issues, approvals, and lifecycle controls for the specification.
---

The optional `governance` section captures change control and accountability for the RQML document.

## Elements
- `issue`: Items with `@id`, optional `status` (`draft|review|approved|deprecated`), optional `owner`, plus `statement` and optional `notes`.
- `approval`: Items with `@id`, `role`, optional `status`, and optional `description`.

## Authoring tips
- Use `issue` to log open questions, decisions needed, or deviations; update `status` as they progress.
- Capture sign-offs with `approval`, listing the role (not necessarily a person) responsible for acceptance.
- Keep this section current during reviews to make the document’s governance auditable.

## Example
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

## Theory
- Governance enforces accountability and change control, aligning with configuration management in ISO/IEC/IEEE 12207.
- Issues capture outstanding concerns; approvals provide evidence for audits and regulated contexts (e.g., ISO 9001).
- Clear ownership reduces drift and supports continuous compliance in agile environments.
- Bibliography: [ISO/IEC/IEEE 12207](https://www.iso.org/standard/63712.html), [ISO 9001](https://www.iso.org/standard/62085.html), [CMMI for Development](https://cmmiinstitute.com/cmmi/dev).
