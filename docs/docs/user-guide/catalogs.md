---
id: catalogs
title: Catalogs
sidebar_position: 2
description: Shared lists like glossary, actors, stakeholders, constraints, policies, decisions, and risks.
---

The optional `catalogs` section centralizes reusable definitions and lookup lists to keep requirements terse and consistent.

## Subsections
- `glossary`: `term` entries with `@id`, `name`, `definition`, and optional `synonyms`.
- `actors`: `actor` items with `@id`, `name`, and optional `type`.
- `stakeholders`: `stakeholder` items with `@id`, `name`, optional `org`, and `concerns`.
- `constraints`: `constraint` items with `@id`, `statement`, optional `severity` and `source`.
- `policies`: `policy` items with `@id`, `obligation`, and optional `evidence`/`source`.
- `decisions`: `decision` entries with `@id`, `context`, `decision`, optional `alternatives` and `consequences` plus optional `status`.
- `risks`: `risk` entries with `@id`, `statement`, optional `mitigation`, optional `severity`.

## Authoring tips
- Reuse `@id` references from catalogs in downstream sections (e.g., `ownerRef`, `goalLink`) to avoid duplication.
- Keep definitions concise; use `TextBlockType` content for structured paragraphs when needed.
- Treat `decisions` and `policies` as living artifacts—update `status` as choices move from draft to approved.

## Example
```xml
<catalogs>
  <glossary>
    <term id="TERM-PCI">
      <name>PCI DSS</name>
      <definition>Payment Card Industry Data Security Standard.</definition>
    </term>
  </glossary>
  <actors>
    <actor id="ACT-USER" name="End User" type="human"/>
  </actors>
  <stakeholders>
    <stakeholder id="STK-RISK" name="Risk Office" org="Acme Bank">
      <concerns>Compliance and fraud controls.</concerns>
    </stakeholder>
  </stakeholders>
  <constraints>
    <constraint id="CON-HTTPS" severity="high">
      <statement>All APIs must enforce TLS 1.2+.</statement>
      <source>Security policy</source>
    </constraint>
  </constraints>
  <decisions>
    <decision id="DEC-IDEMPOTENCY" status="approved">
      <context>Prevent duplicate payments</context>
      <decision>Use Idempotency-Key header</decision>
      <consequences>Requires persistence of request hashes</consequences>
    </decision>
  </decisions>
  <risks>
    <risk id="RISK-FRAUD" severity="high">
      <statement>Fraudulent card-not-present attempts</statement>
      <mitigation>3DS and velocity checks</mitigation>
    </risk>
  </risks>
</catalogs>
```

## Code generation examples

LLMs can generate implementation artifacts from catalog definitions:

**Actor enums and types:**
```typescript
enum ActorType {
  EndUser = 'human',
  PaymentGateway = 'system',
  AdminUser = 'human',
}

interface Actor {
  id: string;
  name: string;
  type: ActorType;
}
```

**Constraint validation:**
```typescript
// From CON-HTTPS: All APIs must enforce TLS 1.2+
export function validateTLSVersion(req: Request): void {
  const tlsVersion = req.socket.getPeerCertificate()?.version;
  if (!tlsVersion || tlsVersion < 'TLSv1.2') {
    throw new SecurityError('TLS 1.2+ required per CON-HTTPS');
  }
}
```

**Decision-based configuration:**
```typescript
// From DEC-IDEMPOTENCY: Use Idempotency-Key header
export const idempotencyConfig = {
  headerName: 'Idempotency-Key',
  ttlSeconds: 86400, // 24 hours
  storage: 'redis',
};
```

**Risk mitigation middleware:**
```typescript
// From RISK-FRAUD: 3DS and velocity checks
async function fraudCheckMiddleware(req: PaymentRequest): Promise<void> {
  await velocityCheck(req.cardToken, req.amount);
  if (await shouldRequire3DS(req)) {
    await initiate3DSChallenge(req);
  }
}
```

## Test generation examples

Catalogs drive specific verification approaches:

1. **Constraint compliance tests**: Verify all API endpoints enforce declared constraints
2. **Policy evidence tests**: Ensure required audit trails and evidence collection for policies
3. **Decision validation**: Test that approved decisions are actually implemented
4. **Risk coverage**: Verify each high-severity risk has active mitigation in place
5. **Actor authorization**: Test that each actor can only perform their authorized operations

## Theory
- Catalogs normalize vocabulary and reusable facts, reducing ambiguity—a core RE principle from IEEE 29148 on consistent terminology.
- Decision and risk logs mirror lightweight ADRs and ISO 31000 risk management practice.
- Stakeholder and actor lists map to stakeholder analysis in BABOK and Volere.
- Bibliography: [IEEE 29148-2018](https://standards.ieee.org/standard/29148-2018.html), [ISO 31000:2018](https://www.iso.org/standard/65694.html), [BABOK v3](https://www.iiba.org/business-analysis-resources/babok/), [Volere Template](http://www.volere.org/template.htm).
