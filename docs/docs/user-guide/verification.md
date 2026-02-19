---
id: verification
title: Verification
sidebar_position: 9
description: Capture how requirements are tested and inspected.
---

The optional `verification` section records planned and executed checks against requirements.

## Elements
- `testSuite`: Collection with `@id`, `title`, and optional `description`.
- `testCase`: Individual verification item with `@id`, `title`, `type` (`acceptance|integration|unit|security|performance|inspection`), optional `purpose`, `steps`, `expected`.

## Authoring tips
- Use trace edges to connect test cases to the requirements or scenarios they cover.
- Keep `expected` observable and unambiguous; add `steps` for reproducibility.
- Group related cases into `testSuite` for releases or capabilities, then trace to requirements using the `trace` section.

## Example
```xml
<verification>
  <testSuite id="TS-PAYMENT" title="Payment Flow">
    <description>End-to-end payment authorization and capture tests.</description>
  </testSuite>
  <testCase id="TC-AUTH-001" type="integration" title="Authorize payment success">
    <purpose>Verify successful authorization path.</purpose>
    <steps>Submit POST /payments with valid token and amount.</steps>
    <expected>Response status 201 with paymentId and status=authorized.</expected>
  </testCase>
</verification>
```

## Code generation examples

LLMs generate test implementations from verification specifications:

**Test suite organization:**
```typescript
// From TS-PAYMENT: Payment Flow
describe('TS-PAYMENT: Payment Flow', () => {
  let paymentService: PaymentService;
  let testContext: TestContext;

  beforeAll(async () => {
    testContext = await setupTestEnvironment();
    paymentService = testContext.getService('payment');
  });

  // Individual test cases in the suite
  include('./tests/TC-AUTH-001.test');
  include('./tests/TC-AUTH-002.test');
  include('./tests/TC-REFUND-001.test');

  afterAll(async () => {
    await testContext.teardown();
  });
});
```

**Integration test from test case:**
```typescript
// From TC-AUTH-001: Authorize payment success
describe('TC-AUTH-001: Authorize payment success', () => {
  it('should return 201 with paymentId and status=authorized', async () => {
    // Step: Submit POST /payments with valid token and amount
    const response = await request(app)
      .post('/payments')
      .send({
        amount: 100.00,
        currency: 'USD',
        sourceToken: 'tok_valid_12345',
      })
      .set('Authorization', 'Bearer valid-token');

    // Expected: Response status 201 with paymentId and status=authorized
    expect(response.status).toBe(201);
    expect(response.body.paymentId).toBeDefined();
    expect(response.body.status).toBe('authorized');

    // Trace: REQ-AUTH-001, SCN-CHECKOUT
  });
});
```

**Performance test specification:**
```typescript
// From test case with type="performance"
import { check } from 'k6';
import http from 'k6/http';

export const options = {
  stages: [
    { duration: '2m', target: 200 }, // Ramp to 200 rps
    { duration: '5m', target: 200 }, // Hold at 200 rps
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // p95 latency requirement
  },
};

export default function() {
  const response = http.post('https://api/payments', {
    amount: 100,
    currency: 'USD',
    sourceToken: 'tok_test',
  });

  check(response, {
    'status is 201': (r) => r.status === 201,
    'has paymentId': (r) => r.json('paymentId') !== undefined,
  });
}
```

## Test generation examples

Verification section drives comprehensive test automation:

1. **Test scaffolding**: Generate test files, describe blocks, and setup/teardown from test suites
2. **Test implementation**: Convert steps and expected outcomes into executable test code
3. **Test data**: Generate fixtures and mocks based on requirements referenced in trace edges
4. **Type-specific tests**: Use appropriate frameworks (Jest for unit, Cypress for acceptance, k6 for performance)
5. **Traceability**: Embed requirement IDs in test metadata for coverage reporting
6. **CI/CD integration**: Group tests by suite for parallel execution and failure isolation

## Theory
- Verification ties requirements to evidence; IEEE 29148 stresses testability and traceability to demonstrate conformance.
- Test types (acceptance, integration, unit, etc.) mirror V-model layering and standard QA practices.
- Suites help organize regression scope and release readiness.
- Bibliography: [IEEE 29148-2018](https://standards.ieee.org/standard/29148-2018.html), [ISTQB Foundation Syllabus](https://www.istqb.org/certifications/foundation-level/), [V-Model](https://www.iso.org/standard/63712.html) (ISO/IEC/IEEE 12207 context).
