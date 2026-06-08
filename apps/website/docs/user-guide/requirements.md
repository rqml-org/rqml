---
id: requirements
title: Requirements
sidebar_position: 6
description: Author normative requirements, packages, and acceptance criteria.
---

The `requirements` section is required and holds the core normative content.

## Structure
- `reqPackage`: Optional grouping container with `@id`, `title`, optional `ownerRef`, optional `description`, and nested `req` items.
- `req`: Individual requirement with attributes:
  - `@id` (`IdType`, unique within document)
  - `@type` (one of `FR`, `NFR`, `IR`, `DR`, `SR`, `CR`, `PR`, `UXR`, `OR`)
  - `@title` (human-readable)
  - Optional `status`, `priority`, `ownerRef`, `appliesTo`
  - Children: `statement` (required), optional `rationale`, `notes`, `acceptance`.
- `acceptance`: Contains one or more `criterion` entries, each with optional `@id` and `given`/`when`/`then` text blocks.

### Requirement type meanings
- **FR — Functional Requirement**: What the system must do—features, behaviors, business functions.
- **NFR — Non-Functional Requirement**: Quality attributes and constraints on how well it works (performance, reliability, usability, etc.).
- **IR — Interface Requirement**: Contracts with other systems/components (APIs, endpoints, message formats, error semantics).
- **DR — Data Requirement**: Data models, fields, validation rules, retention, lineage, classification (e.g., PII).
- **SR — Security Requirement**: Security controls (authn/authz, encryption, secrets handling, auditing, threat mitigations).
- **CR — Constraint Requirement**: Hard constraints on solution space (mandated tech, platforms, standards, environments).
- **PR — Policy/Compliance Requirement**: Regulatory or internal policy obligations (GDPR, audit rules, retention policies, evidence needs).
- **UXR — User Experience Requirement**: UI/interaction expectations (flows, accessibility, i18n, content rules, user-facing behavior).
- **OR — Operational Requirement**: Run/operate/observe the system (monitoring, logging, alerting, backups, RPO/RTO, runbooks).

## Authoring tips
- Keep `statement` crisp and testable; use `acceptance` to express BDD-style criteria when needed.
- Reuse `@id` references from catalogs, domain entities, and goals via trace edges or `appliesTo`.
- Use `priority` to distinguish `must/should/may` and `status` to track lifecycle (`draft/review/approved/deprecated`).
- Group related requirements into `reqPackage` to clarify ownership and scope.

## Example
```xml
<requirements>
  <reqPackage id="PKG-AUTH" title="Authorization" ownerRef="STK-RISK">
    <description>Payment authorization flow</description>
    <req id="REQ-AUTH-001" type="FR" title="Authorize payment" priority="must">
      <statement>The system SHALL authorize card payments via the acquiring bank.</statement>
      <rationale>Enable online checkout for merchants.</rationale>
      <acceptance>
        <criterion id="CRIT-1">
          <given>An authenticated merchant requests authorization</given>
          <when>The acquirer responds with approval</when>
          <then>The payment is marked authorized with paymentId</then>
        </criterion>
      </acceptance>
    </req>
  </reqPackage>
</requirements>
```

## Code generation examples

LLMs generate different code patterns based on requirement type:

**Functional Requirements (FR) → Application logic:**
```typescript
// From REQ-AUTH-001: Authorize card payments
export class PaymentAuthService {
  async authorizePayment(req: AuthRequest): Promise<Payment> {
    // Implements REQ-AUTH-001
    const authResult = await this.acquirer.authorize({
      amount: req.amount,
      currency: req.currency,
      cardToken: req.cardToken,
    });

    return this.createPayment({
      id: generateId(),
      status: authResult.approved ? 'authorized' : 'declined',
      ...authResult,
    });
  }
}
```

**Security Requirements (SR) → Security middleware:**
```typescript
// From SR requirement: Enforce TLS 1.2+
export function tlsEnforcementMiddleware(req: Request, res: Response, next: NextFunction) {
  const tlsVersion = req.socket.getPeerCertificate()?.version;
  if (!tlsVersion || tlsVersion < 'TLSv1.2') {
    return res.status(426).json({ error: 'TLS 1.2+ required' });
  }
  next();
}
```

**Data Requirements (DR) → Validation schemas:**
```typescript
// From DR requirement: Email validation per RFC 5322
import { z } from 'zod';

export const PaymentRequestSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().length(3),
  email: z.string().email(), // Implements DR-EMAIL-001
});
```

**Operational Requirements (OR) → Observability:**
```typescript
// From OR requirement: Emit structured logs
export class PaymentLogger {
  logAuthorization(payment: Payment): void {
    logger.info('payment.authorized', {
      paymentId: payment.id,
      amount: payment.amount,
      timestamp: new Date().toISOString(),
      requirement: 'OR-LOGGING-001',
    });
  }
}
```

## Test generation examples

Requirements drive test implementation through acceptance criteria:

1. **Given-When-Then tests**: Direct translation from acceptance criteria to test cases
2. **Type-specific tests**: FR → integration tests, SR → security tests, NFR → performance tests
3. **Priority-based suites**: Critical path tests from "must" requirements first
4. **Coverage mapping**: Each requirement gets at least one test
5. **Traceability**: Test names reference requirement IDs for impact analysis

**Example test from acceptance criterion:**
```typescript
describe('REQ-AUTH-001: Authorize payment', () => {
  it('CRIT-1: authorized payment with valid merchant', async () => {
    // Given: authenticated merchant requests authorization
    const merchant = await createAuthenticatedMerchant();

    // When: acquirer responds with approval
    mockAcquirer.authorize.mockResolvedValue({ approved: true });
    const result = await paymentService.authorize(merchant, validRequest);

    // Then: payment marked authorized with paymentId
    expect(result.status).toBe('authorized');
    expect(result.paymentId).toBeDefined();
  });
});
```

## Theory
- Requirements should be necessary, verifiable, unambiguous, and feasible (IEEE 29148 qualities).
- Categorizing by type (FR/NFR/etc.) aligns with classic RE taxonomies; acceptance criteria make requirements testable (BDD/Gherkin influence).
- Packaging requirements aids scoping and ownership, echoing Volere and disciplined backlog management.
- Bibliography: [IEEE 29148-2018](https://standards.ieee.org/standard/29148-2018.html), [Specification by Example](https://www.manning.com/books/specification-by-example), [Volere Template](http://www.volere.org/template.htm).
