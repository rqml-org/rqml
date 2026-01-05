---
id: element-interfaces
title: interfaces
description: APIs, endpoints, and events exposed by the system.
---

## Summary
Optional section to describe external interfaces (HTTP APIs, events, etc.).

## Where it appears
- `rqml > interfaces`

## Content model
- `api` (0..n)
- `event` (0..n)

`api` children: `description` (0..1), `endpoint` (0..n)  
`endpoint` children: `summary` (0..1), `request` (0..1), `response` (0..1), `errors` (0..1)  
`event` children: `description` (0..1), `payload` (0..1)

## Attributes
| Element | Name | Type | Required | Default | Description |
| --- | --- | --- | --- | --- | --- |
| api | `id` | IdType | yes | — | API identifier. |
| api | `name` | string | yes | — | API name. |
| api | `protocol` | token | no | — | Protocol (e.g., https). |
| api | `auth` | token | no | — | Auth mechanism hint. |
| endpoint | `id` | IdType | yes | — | Endpoint identifier. |
| endpoint | `method` | token | yes | — | HTTP verb or method. |
| endpoint | `path` | string | yes | — | Endpoint path. |
| event | `id` | IdType | yes | — | Event identifier. |
| event | `name` | string | yes | — | Event name. |

## Example (minimal)
```xml
<interfaces>
  <api id="API-1" name="Example API"/>
</interfaces>
```

## Example (typical)
```xml
<interfaces>
  <api id="API-PAYMENTS" name="Payments API" protocol="https" auth="oauth2">
    <endpoint id="EP-AUTH" method="POST" path="/payments">
      <summary>Create a payment and request authorization.</summary>
      <request>Body includes amount, currency, source token.</request>
      <response>Returns paymentId and status.</response>
      <errors>422 for validation, 502 for upstream decline.</errors>
    </endpoint>
  </api>
  <event id="EVT-PAYMENT-UPDATED" name="PaymentUpdated">
    <description>Emitted when a payment status changes.</description>
    <payload>paymentId, status, updatedAt</payload>
  </event>
</interfaces>
```

## Notes / LLM hints
- Use consistent HTTP verbs and templated paths; document auth expectations in `auth` or request text.
- Link interfaces to requirements and trace edges for coverage.
