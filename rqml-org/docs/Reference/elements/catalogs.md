---
id: element-catalogs
title: catalogs
description: Shared lists such as glossary terms, actors, constraints, policies, decisions, and risks.
---

## Summary
Optional container for reusable definitions referenced elsewhere.

## Where it appears
- `rqml > catalogs`

## Content model
- `glossary` (0..1) → `term` (0..n)
- `actors` (0..1) → `actor` (0..n)
- `stakeholders` (0..1) → `stakeholder` (0..n)
- `constraints` (0..1) → `constraint` (0..n)
- `policies` (0..1) → `policy` (0..n)
- `decisions` (0..1) → `decision` (0..n)
- `risks` (0..1) → `risk` (0..n)

## Attributes
None.

## Example (minimal)
```xml
<catalogs>
  <glossary/>
</catalogs>
```

## Example (typical)
```xml
<catalogs>
  <glossary>
    <term id="TERM-PCI">
      <name>PCI DSS</name>
      <definition>Payment Card Industry Data Security Standard.</definition>
    </term>
  </glossary>
  <actors>
    <actor id="ACT-USER" name="End User" type="human"/>
  </actors>
  <constraints>
    <constraint id="CON-HTTPS" severity="high">
      <statement>All APIs must enforce TLS 1.2+.</statement>
      <source>Security policy</source>
    </constraint>
  </constraints>
  <decisions>
    <decision id="DEC-IDEMPOTENCY" status="approved">
      <context>Prevent duplicate payments</context>
      <decision>Use Idempotency-Key header</decision>
    </decision>
  </decisions>
</catalogs>
```

## Notes / LLM hints
- Prefer catalog references (`@id`) over re-describing the same term or actor across requirements.
- Keep items concise to make reuse easy; expand detail in linked docs if needed.
