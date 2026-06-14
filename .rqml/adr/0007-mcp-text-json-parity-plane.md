# ADR-0007: Keep the MCP server a text/JSON parity plane; interaction lives in the host

- Status: Accepted
- Date: 2026-06-14
- Classification: discretionary_design_choice
- Related requirements: REQ-MCP-INTERACTION-BOUNDARY, REQ-MCP-PARITY, REQ-MCP-READONLY, REQ-LOOP-APPROVE
- Related ADRs: ADR-0006 (companion surface decision)
- Affected components: mcp, rqml-claude, rqml-codex

## Context

Making RQML development interactive inside agents raises the question of whether
the MCP server should drive the human interaction itself, using newer Model
Context Protocol features: **resources** (subscribable read data), **prompts**,
**elicitation** (server-initiated requests for user input), and **sampling**.
The review→accept workflow is the tempting case — elicitation could ask the
developer to approve a requirement in one round trip.

Two facts cut against that. First, MCP client support for resources and
elicitation is uneven across hosts (Claude Code, Codex and others); a workflow
built on them would silently no-op where unsupported. Second, the CLI has no
equivalent of "elicit," so any capability that depends on these features cannot
be at parity with the CLI — and parity, backed by one engine, is a load-bearing
guarantee of the toolchain (REQ-MCP-PARITY).

## Decision drivers

- Parity (REQ-MCP-PARITY): every capability must have a CLI equivalent.
- Portability: capabilities must work on tools-only hosts.
- Read-mostly contract (REQ-MCP-READONLY); writes only on explicit intent.
- Avoid silent failure on hosts lacking an optional feature.
- Keep the data plane (facts about the spec) separate from the interaction plane
  (asking a human to decide).

## Options considered

### Option 1: Adopt MCP resources + elicitation for overview/matrix/accept
Expose overview and matrix as subscribable resources; drive acceptance via
elicitation.

**Pros**
- Richer, more native UX where the client supports it; single-round-trip accept.

**Cons**
- No CLI equivalent — breaks parity.
- Uneven client support; the accept gate would silently no-op on hosts without
  elicitation, which is worse than no gate.
- Couples a core workflow to the least-portable MCP features.

### Option 2: Keep MCP text/JSON (tools-only); interaction in the host (chosen)
MCP tools return text and JSON only and depend on no optional client feature.
Human interaction (review, accept) is done by the host integration — the Claude
plugin's command, the Codex skill, the VS Code diff-and-accept panel.

**Pros**
- Every capability reachable on tools-only hosts; parity preserved.
- Interaction lives where the human already is.
- `structuredContent` stays available as a purely additive future enhancement
  (the CLI already has `--json`), with no workflow depending on it.

**Cons**
- No server-driven single-round-trip accept.
- Interaction choreography is duplicated per host (already the case).

## Decision

Adopt **Option 2**. The MCP server is a deterministic data plane: text and JSON
tool results, with no dependency on resources, prompts, elicitation, or sampling
for any core workflow (REQ-MCP-INTERACTION-BOUNDARY). Reviewing and accepting
requirements is choreographed by the host integration, calling the same
explicit-intent write the CLI uses (REQ-LOOP-APPROVE, REQ-MCP-READONLY).

## Consequences

### Positive
- Capabilities work identically on any tools-capable host and stay at CLI parity.
- No silent feature-detection failures in the verdict/accept path.

### Negative
- No native server-initiated accept; richer MCP UX is deferred.
- Each host re-implements the accept affordance (a thin shell over one verdict).

## Supersession

None
