---
id: element-scenarios
title: scenarios
description: Scenarios, misuse cases, and edge cases.
---

## Summary
Optional narratives that describe usage, threats, and boundary conditions.

## Where it appears
- `rqml > scenarios`

## Content model
- `scenario` (0..n)
- `misuseCase` (0..n)
- `edgeCase` (0..n)

Each scenario-like element has:
- `narrative` (1)
- `refs` (0..1) → `ref` (0..n)

## Attributes
| Element | Name | Type | Required | Default | Description |
| --- | --- | --- | --- | --- | --- |
| scenario/misuseCase/edgeCase | `id` | IdType | yes | — | Scenario identifier. |
| scenario/misuseCase/edgeCase | `title` | string | yes | — | Scenario title. |
| scenario/misuseCase/edgeCase | `actorRef` | IdType | no | — | Reference to an `actor` (if applicable). |

## Example (minimal)
```xml
<scenarios>
  <scenario id="SCN-1" title="User logs in">
    <narrative>User submits credentials and sees dashboard.</narrative>
  </scenario>
</scenarios>
```

## Example (typical)
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
  </misuseCase>
</scenarios>
```

## Notes / LLM hints
- Keep `narrative` concise; add `refs` to tie scenarios to goals and requirements.
- Use `misuseCase` and `edgeCase` to surface risks and robustness concerns early.
