---
id: element-requirements
title: requirements
description: Container for requirement packages and individual requirements.
---

## Summary
Required section holding all normative requirements.

## Where it appears
- `rqml > requirements`

## Content model
- `reqPackage` (0..n) → `description` (0..1), `req` (0..n)
- `req` (0..n)

`req` children:
- `statement` (1)
- `rationale` (0..1)
- `notes` (0..1)
- `acceptance` (0..1) → `criterion` (1..n) each with `given` (0..1), `when` (0..1), `then` (1)
- `refs` (0..1) → `ref` (0..n)

## Attributes
| Element | Name | Type | Required | Default | Description |
| --- | --- | --- | --- | --- | --- |
| reqPackage | `id` | IdType | yes | — | Package identifier. |
| reqPackage | `title` | string | yes | — | Package title. |
| reqPackage | `ownerRef` | IdType | no | — | Owner reference. |
| req | `id` | IdType | yes | — | Requirement identifier. |
| req | `type` | ReqType (`FR|NFR|IR|DR|SR|CR|PR|UXR|OR`) | yes | — | Requirement classification. |
| req | `title` | string | yes | — | Human-readable title. |
| req | `status` | StatusType | no | — | Lifecycle. |
| req | `priority` | PriorityType | no | — | Importance (`must|should|may`). |
| req | `ownerRef` | IdType | no | — | Responsible owner. |
| req | `appliesTo` | token | no | — | Scope or target component. |

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

## Example (minimal)
```xml
<requirements>
  <req id="REQ-1" type="FR" title="Do a thing">
    <statement>The system SHALL perform the thing.</statement>
  </req>
</requirements>
```

## Example (typical)
```xml
<requirements>
  <reqPackage id="PKG-AUTH" title="Authorization" ownerRef="STK-RISK">
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
      <refs>
        <ref ref="GOAL-AVAIL"/>
        <ref ref="SCN-CHECKOUT"/>
      </refs>
    </req>
  </reqPackage>
</requirements>
```

## Notes / LLM hints
- Write `statement` in verifiable, unambiguous language; express behaviors, not design details.
- Use `acceptance` to capture BDD-style tests when possible; ensure each `criterion` has a `then`.
- Keep `id` stable; rely on `status` and `priority` to reflect lifecycle rather than rewriting IDs.
