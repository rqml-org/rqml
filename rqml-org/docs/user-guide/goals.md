---
id: goals
title: Goals
sidebar_position: 4
description: Document business and quality goals, obstacles, and their links.
---

Use the optional `goals` section to record intended outcomes and relationships between them.

## Elements
- `goal`: High-level objectives with `@id`, `title`, optional `priority` (`must|should|may`), `status`, `ownerRef`, plus `statement` and optional `rationale`.
- `qgoal`: Quality-specific goals with `@id`, `title`, optional `priority/status`, `statement`, and optional `metric`.
- `obstacle`: Risks to goal attainment with `@id`, `title`, optional `likelihood` and `severity`, plus `statement` and optional `mitigation`.
- `goalLink`: Edges connecting goals/obstacles via `@from`, `@to`, `type` (`TraceType`), optional `confidence` (0–1), and `@id`.

## Authoring tips
- Keep `@id` stable; reference goals from `actors` or `requirements` using `refs`.
- Use `goalLink` to model refinement and conflict (e.g., `refines`, `conflictsWith`, `mitigates`) before deriving requirements.
- Add `metric` to `qgoal` when verifiability matters (e.g., response time, availability).

## Example
```xml
<goals>
  <goal id="GOAL-AVAIL" title="High availability" priority="must" status="draft">
    <statement>Maintain payment API availability during peak shopping.</statement>
    <rationale>Protect revenue during events.</rationale>
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

## Code generation examples

LLMs can translate goals into architectural and operational code:

**Quality goal monitoring:**
```typescript
// From QGOAL-LATENCY: p95 latency ≤ 500ms under 200 rps
export class LatencyMonitor {
  private metrics: MetricsClient;

  async recordRequest(duration: number): Promise<void> {
    await this.metrics.histogram('api.latency', duration, {
      goal: 'QGOAL-LATENCY',
      threshold: 500,
    });

    const p95 = await this.metrics.getPercentile('api.latency', 0.95);
    if (p95 > 500) {
      this.metrics.alert('QGOAL-LATENCY violation', { p95 });
    }
  }
}
```

**Availability infrastructure:**
```typescript
// From GOAL-AVAIL: High availability during peak shopping
export const availabilityConfig = {
  replicas: 5, // for GOAL-AVAIL
  healthCheck: {
    path: '/health',
    interval: 10000,
    timeout: 2000,
  },
  autoScaling: {
    minReplicas: 3,
    maxReplicas: 20,
    targetCPU: 70,
  },
};
```

**Obstacle mitigation:**
```typescript
// From OBS-DB: DB contention mitigation via sharding
export class ShardedPaymentRepository {
  private shards: Map<string, DatabaseConnection>;

  getShardForMerchant(merchantId: string): DatabaseConnection {
    const shardKey = this.hashMerchant(merchantId);
    return this.shards.get(shardKey)!;
  }
}
```

## Test generation examples

Goals inform test strategy and performance benchmarks:

1. **Quality goal tests**: Performance/load tests targeting metrics from qgoals (e.g., p95 latency tests)
2. **Availability tests**: Chaos engineering tests, failover scenarios, health check validation
3. **Obstacle scenarios**: Tests that simulate obstacles and verify mitigations work
4. **Goal conflict tests**: Tests that verify trade-offs are handled appropriately
5. **Metric collection tests**: Verify monitoring and alerting for quality goals

## Theory
- Goals represent stakeholder intentions; refining goals into requirements follows KAOS and i* goal-oriented RE practices.
- Quality goals need measurable criteria (ISO/IEC 25010 quality attributes) to avoid vagueness.
- Obstacles and conflicts align with risk/threat modeling; links capture rationale and traceability (IEEE 29148).
- Bibliography: [KAOS](https://www.info.ucl.ac.be/~avl/reqt/kaos.html), [i* Framework](https://en.wikipedia.org/wiki/I-Star_(language)), [ISO/IEC 25010](https://iso25000.com/index.php/en/iso-25000-standards/iso-25010), [IEEE 29148-2018](https://standards.ieee.org/standard/29148-2018.html).
