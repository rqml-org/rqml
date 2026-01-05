---
id: element-goals
title: goals
description: Goals, quality goals, obstacles, and goal links.
---

## Summary
Optional section for desired outcomes, quality targets, and risks.

## Where it appears
- `rqml > goals`

## Content model
- `goal` (0..n)
- `qgoal` (0..n)
- `obstacle` (0..n)
- `goalLink` (0..n)

`goal` children: `statement` (1), `rationale` (0..1)  
`qgoal` children: `statement` (1), `metric` (0..1)  
`obstacle` children: `statement` (1), `mitigation` (0..1)

## Attributes
| Element | Name | Type | Required | Default | Description |
| --- | --- | --- | --- | --- | --- |
| goal | `id` | IdType | yes | — | Goal identifier. |
| goal | `title` | string | yes | — | Short goal label. |
| goal | `priority` | PriorityType (`must|should|may`) | no | — | Importance. |
| goal | `status` | StatusType | no | — | Lifecycle. |
| goal | `ownerRef` | IdType | no | — | Owner reference. |
| qgoal | `id`, `title`, `priority`, `status` | as above | | | |
| obstacle | `id` | IdType | yes | — | Obstacle identifier. |
| obstacle | `title` | string | yes | — | Obstacle label. |
| obstacle | `likelihood` | token | no | — | Risk likelihood. |
| obstacle | `severity` | token | no | — | Risk severity. |
| goalLink | `id` | IdType | yes | — | Link identifier. |
| goalLink | `from` | IdType | yes | — | Source goal/obstacle ID. |
| goalLink | `to` | IdType | yes | — | Target goal/obstacle ID. |
| goalLink | `type` | TraceType | yes | — | Relation (refines, mitigates, etc.). |
| goalLink | `confidence` | ConfidenceType (0..1) | no | — | Confidence in relation. |

## Example (minimal)
```xml
<goals>
  <goal id="GOAL-1" title="Deliver value">
    <statement>Ship features customers need.</statement>
  </goal>
</goals>
```

## Example (typical)
```xml
<goals>
  <goal id="GOAL-AVAIL" title="High availability" priority="must">
    <statement>Maintain payment API availability during peak shopping.</statement>
  </goal>
  <qgoal id="QGOAL-LATENCY" title="Low latency" priority="should">
    <statement>Keep API latency low for checkout.</statement>
    <metric>p95 latency ≤ 500ms under 200 rps.</metric>
  </qgoal>
  <obstacle id="OBS-DB" title="DB contention" likelihood="medium" severity="high">
    <statement>Single DB cluster could throttle writes.</statement>
    <mitigation>Shard by merchant and add write queue.</mitigation>
  </obstacle>
  <goalLink id="GL-1" from="OBS-DB" to="GOAL-AVAIL" type="threatens" confidence="0.7"/>
</goals>
```

## Notes / LLM hints
- Use measurable `metric` for `qgoal` to keep quality targets testable.
- Model risks as `obstacle` and connect via `goalLink` before deriving requirements.
