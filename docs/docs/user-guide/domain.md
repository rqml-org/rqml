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

## Code generation examples

LLMs can generate domain models and logic from domain definitions:

**Entity classes and types:**
```typescript
// From ENT-PAYMENT
interface Payment {
  paymentId: string; // uuid, required
  amount: number; // decimal, required, positive
  currency: string;
  status: PaymentStatus;
  createdAt: Date;
}

class PaymentEntity implements Payment {
  constructor(
    public paymentId: string,
    public amount: number,
    public currency: string,
    public status: PaymentStatus,
    public createdAt: Date
  ) {
    this.validate();
  }

  private validate(): void {
    if (this.amount <= 0) {
      throw new ValidationError('Amount must be positive per ATTR-AMOUNT');
    }
  }
}
```

**Database schema:**
```sql
-- From ENT-PAYMENT
CREATE TABLE payments (
  payment_id UUID PRIMARY KEY,
  amount DECIMAL(19, 4) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) NOT NULL,
  status VARCHAR(20) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

**Business rule validation:**
```typescript
// From BR-DECLINE: Decline transactions exceeding merchant limit
export function validateTransactionLimit(
  payment: Payment,
  merchantLimit: number
): void {
  if (payment.amount > merchantLimit) {
    throw new BusinessRuleError(
      `Transaction exceeds merchant limit per BR-DECLINE`,
      { amount: payment.amount, limit: merchantLimit }
    );
  }
}
```

## Test generation examples

Domain definitions enable focused testing:

1. **Entity validation tests**: Test attribute constraints and required fields
2. **Business rule tests**: Test each rule with examples from the spec (valid and invalid cases)
3. **Type safety tests**: Verify type coercion and boundaries (e.g., decimal precision, UUID format)
4. **Constraint violation tests**: Ensure validation errors are thrown appropriately
5. **Schema migration tests**: Verify database schema matches entity definitions

## Theory
- Domain modeling clarifies context and reduces misinterpretation—aligned with problem analysis in IEEE 29148 and Context/Problem frames (Michael Jackson).
- Entities/attributes echo data modeling best practices (3NF/DDD) to ground requirements in shared concepts.
- Business rules capture policies separately from functional requirements, as recommended by the Business Rules Manifesto.
- Bibliography: [IEEE 29148-2018](https://standards.ieee.org/standard/29148-2018.html), [Problem Frames](https://en.wikipedia.org/wiki/Problem_frames), [Domain-Driven Design](https://www.domainlanguage.com/ddd/), [Business Rules Manifesto](https://www.businessrulesgroup.org/brmanifesto.htm).
