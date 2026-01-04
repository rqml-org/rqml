---
id: domain
title: Domain
sidebar_position: 3
description: Capture context, entities, and business rules for the solution space.
---

The optional `domain` section captures shared understanding of the problem space: concepts, constraints, and business logic.

## Structure
- `overview`: Free text for scope, assumptions, and operating context.
- `entities`: Collection of `entity` items, each with `@id`, `name`, optional `description`, and zero or more `attr` entries.
- `attr`: Attributes carry `@id`, `name`, `type` (token), optional `required` (boolean), and optional `description`/`constraints`.
- `businessRules`: `rule` entries with `@id`, `statement`, and optional `examples`.

## Authoring tips
- Use `entities` and `attr` to anchor requirement references (e.g., `appliesTo` or narrative text).
- Keep `type` tokens for attributes consistent (e.g., `uuid`, `email`, `ISO8601-timestamp`).
- Place cross-cutting assumptions in `overview`; they can later become `constraints` in `catalogs` or `requirements` as needed.

## Example
```xml
<domain>
  <overview>Online payments for e-commerce merchants.</overview>
  <entities>
    <entity id="ENT-PAYMENT" name="Payment">
      <description>Represents a single authorization and capture.</description>
      <attr id="ATTR-ID" name="paymentId" type="uuid" required="true"/>
      <attr id="ATTR-AMOUNT" name="amount" type="decimal" required="true">
        <constraints>Must be positive and currency-aligned.</constraints>
      </attr>
    </entity>
  </entities>
  <businessRules>
    <rule id="BR-DECLINE">
      <statement>Decline transactions exceeding merchant limit.</statement>
      <examples>Decline any single payment above 10,000 USD.</examples>
    </rule>
  </businessRules>
</domain>
```

## Theory
- Domain modeling clarifies context and reduces misinterpretation—aligned with problem analysis in IEEE 29148 and Context/Problem frames (Michael Jackson).
- Entities/attributes echo data modeling best practices (3NF/DDD) to ground requirements in shared concepts.
- Business rules capture policies separately from functional requirements, as recommended by the Business Rules Manifesto.
- Bibliography: [IEEE 29148-2018](https://standards.ieee.org/standard/29148-2018.html), [Problem Frames](https://en.wikipedia.org/wiki/Problem_frames), [Domain-Driven Design](https://www.domainlanguage.com/ddd/), [Business Rules Manifesto](https://www.businessrulesgroup.org/brmanifesto.htm).
