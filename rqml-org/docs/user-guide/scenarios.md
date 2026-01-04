---
id: scenarios
title: Scenarios
sidebar_position: 5
description: Capture user journeys, misuse cases, and edge cases.
---

Scenarios provide narrative context. The section is optional but useful for grounding requirements and tests.

## Elements
- `scenario`: Standard use cases with `@id`, `title`, optional `actorRef`, required `narrative`, and optional `refs`.
- `misuseCase`: Negative stories (abuse/threat scenarios) with the same structure as `scenario`.
- `edgeCase`: Exceptional or boundary stories with the same structure.

## Authoring tips
- Reference `actors` via `actorRef` when applicable to link motivation and behavior.
- Keep `narrative` concise but actionable; include main flow and notable branches.
- Use `refs` to connect scenarios to goals or requirements, enabling traceability and test planning.

## Example
```xml
<scenarios>
  <scenario id="SCN-CHECKOUT" title="User pays with card" actorRef="ACT-USER">
    <narrative>The user submits card details, receives confirmation within 2 seconds.</narrative>
    <refs>
      <ref ref="GOAL-AVAIL"/>
      <ref ref="REQ-AUTH-001"/>
    </refs>
  </scenario>
  <misuseCase id="SCN-FRAUD" title="Stolen card attempt">
    <narrative>Attacker replays stolen card numbers rapidly to test validity.</narrative>
    <refs>
      <ref ref="RISK-FRAUD"/>
    </refs>
  </misuseCase>
</scenarios>
```

## Theory
- Scenarios (use cases, misuse/abuse cases) elicit behavioral expectations and threats; they help uncover missing requirements (Cockburn use cases, Sindre & Opdahl misuse cases).
- Edge cases improve robustness by challenging assumptions; they inform tests and quality attributes.
- Linking scenarios to requirements supports coverage analysis and acceptance test planning (IEEE 29148).
- Bibliography: [Writing Effective Use Cases](https://alistair.cockburn.us/writing-effective-use-cases/), [Eliciting Security Requirements with Misuse Cases](https://www.researchgate.net/publication/2471655_Eliciting_Security_Requirements_with_Misuse_Cases), [IEEE 29148-2018](https://standards.ieee.org/standard/29148-2018.html).
