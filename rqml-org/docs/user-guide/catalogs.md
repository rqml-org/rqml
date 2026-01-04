---
id: catalogs
title: Catalogs
sidebar_position: 2
description: Shared lists like glossary, actors, stakeholders, constraints, policies, decisions, and risks.
---

The optional `catalogs` section centralizes reusable definitions and lookup lists to keep requirements terse and consistent.

## Subsections
- `glossary`: `term` entries with `@id`, `name`, `definition`, and optional `synonyms`.
- `actors`: `actor` items with `@id`, `name`, optional `type`, and optional `goals` refs to link motivations.
- `stakeholders`: `stakeholder` items with `@id`, `name`, optional `org`, and `concerns`.
- `constraints`: `constraint` items with `@id`, `statement`, optional `severity` and `source`.
- `policies`: `policy` items with `@id`, `obligation`, and optional `evidence`/`source`.
- `decisions`: `decision` entries with `@id`, `context`, `decision`, optional `alternatives` and `consequences` plus optional `status`.
- `risks`: `risk` entries with `@id`, `statement`, optional `mitigation`, optional `severity`.

## Authoring tips
- Reuse `@id` references from catalogs in downstream sections (e.g., `ownerRef`, `goalLink`, `refs`) to avoid duplication.
- Keep definitions concise; use `TextBlockType` content for structured paragraphs when needed.
- Treat `decisions` and `policies` as living artifacts—update `status` as choices move from draft to approved.

## Example
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
  <stakeholders>
    <stakeholder id="STK-RISK" name="Risk Office" org="Acme Bank">
      <concerns>Compliance and fraud controls.</concerns>
    </stakeholder>
  </stakeholders>
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
      <consequences>Requires persistence of request hashes</consequences>
    </decision>
  </decisions>
  <risks>
    <risk id="RISK-FRAUD" severity="high">
      <statement>Fraudulent card-not-present attempts</statement>
      <mitigation>3DS and velocity checks</mitigation>
    </risk>
  </risks>
</catalogs>
```

## Theory
- Catalogs normalize vocabulary and reusable facts, reducing ambiguity—a core RE principle from IEEE 29148 on consistent terminology.
- Decision and risk logs mirror lightweight ADRs and ISO 31000 risk management practice.
- Stakeholder and actor lists map to stakeholder analysis in BABOK and Volere.
- Bibliography: [IEEE 29148-2018](https://standards.ieee.org/standard/29148-2018.html), [ISO 31000:2018](https://www.iso.org/standard/65694.html), [BABOK v3](https://www.iiba.org/business-analysis-resources/babok/), [Volere Template](http://www.volere.org/template.htm).
