---
id: element-rqml
title: rqml (root)
description: Root element for RQML documents.
---

## Summary
Root container for an RQML document.

## Where it appears
- Document root.

## Content model
- `meta` (1)
- `catalogs` (0..1)
- `domain` (0..1)
- `goals` (0..1)
- `scenarios` (0..1)
- `requirements` (1)
- `behavior` (0..1)
- `interfaces` (0..1)
- `verification` (0..1)
- `trace` (0..1)
- `governance` (0..1)

## Attributes
| Name | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `version` | `xs:token` | yes | — | Schema version (must match the schema). |
| `docId` | `IdType` | yes | — | Stable document identifier. |
| `status` | `StatusType` (`draft|review|approved|deprecated`) | yes | — | Lifecycle state of the document. |

## Example (minimal)
```xml
<rqml xmlns="https://rqml.org/schema/2.1.0" version="2.1.0" docId="DOC-001" status="draft">
  <meta>
    <title>Example Spec</title>
    <system>Example System</system>
  </meta>
  <requirements/>
</rqml>
```

## Example (typical)
```xml
<rqml xmlns="https://rqml.org/schema/2.1.0" version="2.1.0" docId="PAY-REQS" status="review">
  <meta>...</meta>
  <catalogs>...</catalogs>
  <domain>...</domain>
  <goals>...</goals>
  <scenarios>...</scenarios>
  <requirements>...</requirements>
  <behavior>...</behavior>
  <verification>...</verification>
  <trace>...</trace>
  <governance>...</governance>
</rqml>
```

## Notes / LLM hints
- Set `version` to match the schema version you're using.
- Ensure all child elements respect ordering shown in the content model.
