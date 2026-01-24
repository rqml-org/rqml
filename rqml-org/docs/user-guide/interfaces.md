---
id: interfaces
title: Interfaces
sidebar_position: 8
description: Describe APIs, events, and other external touchpoints.
---

The optional `interfaces` section captures system boundaries and contracts.

## Elements
- `api`: API surface with `@id`, `name`, optional `protocol` and `auth`, optional `description`, and zero or more `endpoint` children.
  - `endpoint`: Each has `@id`, `method`, `path`, and optional `summary`, `request`, `response`, `errors`.
- `event`: Event-based interfaces with `@id`, `name`, optional `description`, and optional `payload`.

## Authoring tips
- Use consistent HTTP verbs and templated paths in `endpoint@path` (e.g., `/users/{id}`).
- Document authentication/authorization requirements via `auth` or in `request`/`payload` notes.
- Link endpoints/events to requirements via `refs` elsewhere and trace them in the `trace` section when needed.

## Example
```xml
<interfaces>
  <api id="API-PAYMENTS" name="Payments API" protocol="https" auth="oauth2">
    <endpoint id="EP-AUTH" method="POST" path="/payments">
      <summary>Create a payment and request authorization.</summary>
      <request>Body includes amount, currency, source token.</request>
      <response>Returns paymentId and status (authorized|declined|pending).</response>
      <errors>422 for validation, 502 for upstream decline.</errors>
    </endpoint>
  </api>
  <event id="EVT-PAYMENT-UPDATED" name="PaymentUpdated">
    <description>Emitted when a payment status changes.</description>
    <payload>paymentId, status, updatedAt</payload>
  </event>
</interfaces>
```

## Code generation examples

LLMs can generate complete API implementations and event infrastructure:

**API endpoint handlers:**
```typescript
// From EP-AUTH: POST /payments
@Post('/payments')
@Auth('oauth2')
async createPayment(
  @Body() body: CreatePaymentRequest
): Promise<CreatePaymentResponse> {
  // Implements EP-AUTH
  const payment = await this.paymentService.authorize({
    amount: body.amount,
    currency: body.currency,
    sourceToken: body.sourceToken,
  });

  return {
    paymentId: payment.id,
    status: payment.status, // authorized|declined|pending per EP-AUTH
  };
}

@ErrorHandler()
handlePaymentError(error: Error): HttpResponse {
  if (error instanceof ValidationError) {
    return { status: 422, body: { error: error.message } }; // per EP-AUTH errors
  }
  if (error instanceof AcquirerError) {
    return { status: 502, body: { error: 'upstream decline' } };
  }
  throw error;
}
```

**Event emitters and handlers:**
```typescript
// From EVT-PAYMENT-UPDATED
export interface PaymentUpdatedEvent {
  paymentId: string;
  status: string;
  updatedAt: string;
}

export class PaymentEventEmitter {
  async emitPaymentUpdated(payment: Payment): Promise<void> {
    await this.eventBus.publish('PaymentUpdated', {
      paymentId: payment.id,
      status: payment.status,
      updatedAt: new Date().toISOString(),
    });
  }
}

export class PaymentEventHandler {
  @Subscribe('PaymentUpdated')
  async handlePaymentUpdated(event: PaymentUpdatedEvent): Promise<void> {
    await this.notificationService.notifyMerchant(event.paymentId);
    await this.analyticsService.trackPaymentStatus(event);
  }
}
```

**OpenAPI specification generation:**
```yaml
# From API-PAYMENTS endpoints
openapi: 3.0.0
paths:
  /payments:
    post:
      summary: Create a payment and request authorization
      security:
        - oauth2: []
      requestBody:
        content:
          application/json:
            schema:
              properties:
                amount: { type: number }
                currency: { type: string }
                sourceToken: { type: string }
      responses:
        '201':
          description: Payment created
          content:
            application/json:
              schema:
                properties:
                  paymentId: { type: string }
                  status: { enum: [authorized, declined, pending] }
        '422':
          description: Validation error
        '502':
          description: Upstream decline
```

## Test generation examples

Interface definitions drive contract and integration testing:

1. **API endpoint tests**: HTTP tests for each method/path combination
2. **Contract tests**: Verify request/response schemas match specifications
3. **Error scenario tests**: Test all documented error responses
4. **Authentication tests**: Verify auth requirements are enforced
5. **Event integration tests**: Test event emission and consumption
6. **Performance tests**: Load test API endpoints per any stated SLAs

## Theory
- Interface specs define system boundaries (ISO/IEC/IEEE 42010 emphasizes clear interfaces in architecture descriptions).
- Precise contracts reduce integration risk; aligning with API design guidelines (REST/HTTP semantics) improves interoperability.
- Events document async behaviors; pairing with trace links supports end-to-end observability and impact analysis.
- Bibliography: [ISO/IEC/IEEE 42010](https://www.iso.org/standard/50508.html), [REST Dissertation](https://www.ics.uci.edu/~fielding/pubs/dissertation/fielding_dissertation.pdf), [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110).
