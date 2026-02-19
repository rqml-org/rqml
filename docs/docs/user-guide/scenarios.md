---
id: scenarios
title: Scenarios
sidebar_position: 5
description: Capture user journeys, misuse cases, and edge cases.
---

Scenarios provide narrative context. The section is optional but useful for grounding requirements and tests.

## Elements
- `scenario`: Standard use cases with `@id`, `title`, optional `actorRef`, and required `narrative`.
- `misuseCase`: Negative stories (abuse/threat scenarios) with the same structure as `scenario`.
- `edgeCase`: Exceptional or boundary stories with the same structure.

## Authoring tips
- Reference `actors` via `actorRef` when applicable to link motivation and behavior.
- Keep `narrative` concise but actionable; include main flow and notable branches.
- Use trace edges to connect scenarios to goals or requirements, enabling traceability and test planning.

## Example
```xml
<scenarios>
  <scenario id="SCN-CHECKOUT" title="User pays with card" actorRef="ACT-USER">
    <narrative>The user submits card details, receives confirmation within 2 seconds.</narrative>
  </scenario>
  <misuseCase id="SCN-FRAUD" title="Stolen card attempt">
    <narrative>Attacker replays stolen card numbers rapidly to test validity.</narrative>
  </misuseCase>
</scenarios>
```

## Code generation examples

LLMs can generate end-to-end flows and security controls from scenarios:

**User journey implementation:**
```typescript
// From SCN-CHECKOUT: User pays with card
export class CheckoutController {
  async processPayment(req: CheckoutRequest): Promise<CheckoutResponse> {
    // Step 1: User submits card details
    const cardToken = await this.tokenizeCard(req.cardDetails);

    // Step 2: Request authorization
    const payment = await this.paymentService.authorize({
      amount: req.amount,
      currency: req.currency,
      cardToken,
    });

    // Step 3: Return confirmation within 2 seconds (per SCN-CHECKOUT)
    return {
      paymentId: payment.id,
      status: payment.status,
      message: 'Payment authorized',
    };
  }
}
```

**Misuse case prevention:**
```typescript
// From SCN-FRAUD: Prevent rapid card testing
export class VelocityLimiter {
  private redis: RedisClient;

  async checkCardVelocity(cardToken: string): Promise<void> {
    const key = `card:velocity:${cardToken}`;
    const attempts = await this.redis.incr(key);
    await this.redis.expire(key, 60); // 1-minute window

    if (attempts > 3) {
      // Block rapid replay per SCN-FRAUD mitigation
      throw new SecurityError('Card velocity limit exceeded', {
        scenario: 'SCN-FRAUD',
      });
    }
  }
}
```

**Edge case handling:**
```typescript
// Edge case: Network timeout during authorization
export async function handleAuthTimeout(payment: Payment): Promise<void> {
  // Query authorizer for final status
  const status = await queryAuthStatus(payment.id);

  if (!status) {
    // Unknown state - mark for manual review
    await flagForReconciliation(payment.id);
  }
}
```

## Test generation examples

Scenarios directly translate to acceptance and security tests:

1. **Scenario acceptance tests**: End-to-end tests following the narrative exactly as written
2. **Misuse case security tests**: Penetration tests and abuse scenario validation
3. **Edge case tests**: Boundary and error condition tests
4. **Actor-based tests**: Role-based access tests based on actorRef
5. **Performance tests**: Verify timing constraints mentioned in narratives (e.g., "within 2 seconds")

## Theory
- Scenarios (use cases, misuse/abuse cases) elicit behavioral expectations and threats; they help uncover missing requirements (Cockburn use cases, Sindre & Opdahl misuse cases).
- Edge cases improve robustness by challenging assumptions; they inform tests and quality attributes.
- Linking scenarios to requirements supports coverage analysis and acceptance test planning (IEEE 29148).
- Bibliography: [Writing Effective Use Cases](https://alistair.cockburn.us/writing-effective-use-cases/), [Eliciting Security Requirements with Misuse Cases](https://www.researchgate.net/publication/2471655_Eliciting_Security_Requirements_with_Misuse_Cases), [IEEE 29148-2018](https://standards.ieee.org/standard/29148-2018.html).
