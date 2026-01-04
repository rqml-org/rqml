---
id: meta
title: Meta
sidebar_position: 1
description: How to capture document identity and conventions in the meta section.
---

The `meta` section defines the identity of the RQML document and its lifecycle. It is required and must appear first.

## Required elements
- `title`: Human-readable document title.
- `system`: Name or code of the system the specification covers.

## Optional elements
- `summary`: Free-form overview using mixed content for rich text.
- `authors`: One or more `author` entries (each with `name`, optional `role`, `org`, `contact`).
- `dates`: `created`, `updated`, and optional `targetRelease` markers.
- `conventions`: Guidance on normative keywords or ID patterns.
- `profiles`: Zero or more `profile` entries with `@id` and `@type` plus optional description to declare tailoring or domain-specific overlays.

## Attributes
On the root `rqml` element (not inside `meta`):
- `version` (required, fixed `2.0.1`), `docId` (required, `IdType`), `status` (required; `draft|review|approved|deprecated`).

## Authoring tips
- Keep `docId` stable across revisions; track lifecycle via `status` and `dates/updated`.
- Use `conventions` to lock ID formats (e.g., `REQ-<AREA>-NNN`) and normative keywords (MUST/SHOULD).
- When using profiles, document their intent clearly to guide downstream validation and rendering.

## Example
```xml
<rqml xmlns="https://rqml.org/schema/2.0.1" version="2.0.1" docId="PAY-REQS" status="review">
  <meta>
    <title>Payments Service Requirements</title>
    <system>Payments</system>
    <summary>Requirements for the payments API and reconciliation workflows.</summary>
    <authors>
      <author>
        <name>Avery Kim</name>
        <role>Product</role>
        <org>Acme</org>
        <contact>avery@example.com</contact>
      </author>
    </authors>
    <dates>
      <created>2024-10-01</created>
      <updated>2025-01-15</updated>
    </dates>
    <conventions>
      <idConventions>REQ-<area>-NNN, GOAL-<area>-NNN</idConventions>
    </conventions>
  </meta>
  <!-- other sections -->
</rqml>
```

## Theory
- Good meta data underpins change control and provenance—aligns with IEEE 29148 emphasis on traceable requirements specs.
- Status and dating enable configuration management (see ISO/IEC/IEEE 12207 lifecycle processes).
- Profiles express viewpoints or tailoring, similar to viewpoints in ISO/IEC/IEEE 42010 architecture descriptions.
- Bibliography: [IEEE 29148-2018](https://standards.ieee.org/standard/29148-2018.html), [ISO/IEC/IEEE 12207](https://www.iso.org/standard/63712.html), [ISO/IEC/IEEE 42010](https://www.iso.org/standard/50508.html).
