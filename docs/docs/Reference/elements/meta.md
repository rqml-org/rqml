---
id: element-meta
title: meta
description: Document identity and lifecycle metadata.
---

## Summary
Captures document identity, ownership, and conventions. Required in every RQML file.

## Where it appears
- `rqml > meta`

## Content model
- `title` (1)
- `system` (1)
- `summary` (0..1)
- `authors` (0..1) → `author` (1..n)
- `dates` (0..1)
- `conventions` (0..1)
- `profiles` (0..1) → `profile` (0..n)

## Attributes
None.

## Example (minimal)
```xml
<meta>
  <title>Example Spec</title>
  <system>Example System</system>
</meta>
```

## Example (typical)
```xml
<meta>
  <title>Payments Service Requirements</title>
  <system>Payments</system>
  <summary>Requirements for the payments API and reconciliation workflows.</summary>
  <authors>
    <author>
      <name>Avery Kim</name>
      <role>Product</role>
      <contact>avery@example.com</contact>
    </author>
  </authors>
  <dates>
    <created>2024-10-01</created>
    <updated>2025-01-15</updated>
  </dates>
  <conventions>
    <idConventions>REQ-<area>-NNN</idConventions>
  </conventions>
  <profiles>
    <profile id="PROF-PCI" type="compliance">
      <description>PCI tailoring for card data.</description>
    </profile>
  </profiles>
</meta>
```

## Notes / LLM hints
- Keep `title` and `system` concise and stable.
- `conventions` is a good place to encode ID patterns and normative keyword usage for consistent generation.
