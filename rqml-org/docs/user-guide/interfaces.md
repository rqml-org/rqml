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

## Theory
- Interface specs define system boundaries (ISO/IEC/IEEE 42010 emphasizes clear interfaces in architecture descriptions).
- Precise contracts reduce integration risk; aligning with API design guidelines (REST/HTTP semantics) improves interoperability.
- Events document async behaviors; pairing with trace links supports end-to-end observability and impact analysis.
- Bibliography: [ISO/IEC/IEEE 42010](https://www.iso.org/standard/50508.html), [REST Dissertation](https://www.ics.uci.edu/~fielding/pubs/dissertation/fielding_dissertation.pdf), [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110).
