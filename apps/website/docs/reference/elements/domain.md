---
id: element-domain
title: domain
description: Domain context, entities, attributes, and business rules.
---

## Summary
Optional section to describe domain concepts and rules.

## Where it appears
- `rqml > domain`

## Content model
- `overview` (0..1)
- `entities` (0..1) → `entity` (0..n)
- `businessRules` (0..1) → `rule` (0..n)

`entity` children:
- `description` (0..1)
- `attr` (0..n) with `@id`, `@name`, `@type`, optional `@required`, `description`, `constraints`

`rule` children:
- `statement` (1)
- `examples` (0..1)

## Attributes
None on `domain`. Child attributes:

- `entity`: `id` (IdType, req), `name` (string, req)
- `attr`: `id` (IdType, req), `name` (string, req), `type` (token, req), `required` (boolean, opt)

## Example (minimal)
```xml
<domain>
  <entities/>
</domain>
```

## Example (typical)
```xml
<domain>
  <overview>Online payments for e-commerce merchants.</overview>
  <entities>
    <entity id="ENT-PAYMENT" name="Payment">
      <description>Represents a single authorization and capture.</description>
      <attr id="ATTR-ID" name="paymentId" type="uuid" required="true"/>
      <attr id="ATTR-AMOUNT" name="amount" type="decimal">
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

## Notes / LLM hints
- Use domain IDs in requirements via `appliesTo` or textual references to reduce ambiguity.
- Keep attribute `type` strings consistent (e.g., `uuid`, `iso8601-timestamp`).
