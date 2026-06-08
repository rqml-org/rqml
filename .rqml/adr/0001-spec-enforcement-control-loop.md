# ADR-0001: Enforce spec-first development with a deterministic control loop

- Status: Proposed
- Date: 2026-06-07
- Classification: discretionary_design_choice
- Related requirements: REQ-SPEC-FIRST, REQ-STRICTNESS, REQ-ENFORCE-PRIMITIVES, REQ-ENFORCE-STRICTNESS, REQ-ENFORCE-CERTIFIED, REQ-CLI-CHECK-GATE
- Related ADRs: ADR-0003
- Affected components: cli, mcp, agent integrations (hooks), CI

## Context

Coding agents reliably author good RQML, but over a session they forget that a project is RQML-governed, so the spec drifts from the code. AGENTS.md and the agent skill only nudge; neither makes an agent keep working from the spec. We need an enforcement approach that does not depend on the model remembering.

## Decision drivers

- Drift is the long-run result of relying on model attention and memory.
- Enforcement must hold whether or not the model cooperates on a given turn.
- It should degrade gracefully across agents with different extension surfaces.
- Intensity must scale from prototyping to regulated/safety-critical work.

## Options considered

### Option 1: Context instructions only (AGENTS.md + skill)
Declarative guidance loaded into context. Pros: trivial, portable. Cons: voluntary and decays as context grows; cannot guarantee behaviour — this is the status quo that produces drift.

### Option 2: MCP tools only
Expose validate/check/trace as agent tools. Pros: structured access to the engine. Cons: still optional — the agent must choose to call them; no enforcement.

### Option 3: Deterministic control loop (chosen)
Deterministic checks invoked by the environment rather than the model: in-session agent hooks (per-turn status re-anchor, post-edit drift feedback, a completion gate) plus a VCS/CI gate, all calling `rqml check`. Instructions and the skill remain as capability, not enforcement. Pros: enforcement is independent of the model, reproducible, and auditable. Cons: requires per-agent integration and tooling investment.

## Decision

Enforce spec-first development through a deterministic control loop, not through instructions. The loop runs on two planes: an agent plane (in-session hooks that gate turn completion on `rqml check`) and a VCS/CI plane (pre-commit and CI running the same gate). Enforcement strength on the agent plane is bounded by each agent's extension surface, but the commit/CI gate is a universal backstop regardless of agent or human author. Enforcement intensity is governed by the existing strictness levels (relaxed → certified), with the certified level emitting an append-only audit trail. The per-agent harness (e.g. a Claude Code plugin) is specified and distributed in separate integration repositories; this decision covers only that enforcement is deterministic and externally driven, and that the in-repo toolchain supplies the primitives it consumes.

## Consequences

Positive: the spec stays authoritative for the life of a project without relying on model compliance; one gate serves editors, agents, and CI; the certified audit trail doubles as compliance evidence. Negative: each agent integration is bespoke work; instruction-only agents can be nudged but not bound, leaving the commit gate as their only hard backstop; the completion gate needs a loop guard to avoid block/retry cycles.

## Supersession

None
