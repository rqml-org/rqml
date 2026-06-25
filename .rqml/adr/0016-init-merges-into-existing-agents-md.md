# ADR-0016: `rqml init` merges a managed block into an existing AGENTS.md

- Status: Accepted
- Date: 2026-06-25
- Classification: discretionary_design_choice
- Related requirements: REQ-CLI-INIT-MERGE, REQ-CLI-COMMANDS, REQ-AGENTS-TEMPLATE
- Related ADRs: ADR-0001 (the spec-enforcement control loop AGENTS.md anchors)
- Affected components: packages/cli/src/commands/init.ts

## Context

`rqml init` scaffolds two files: the starter `requirements.rqml` and the
`AGENTS.md` process contract that points agents at the toolchain
(REQ-AGENTS-TEMPLATE). Its original logic was create-or-skip per file: if
`AGENTS.md` already existed, it printed `skip (exists)` and wrote nothing.

That skip is a silent gap. `AGENTS.md` is the *native* instruction file for
several agents — Codex reads it directly — so a repository adopting RQML very
often already has one. For those projects `rqml init` left the file untouched,
the RQML guidance never landed, and downstream hooks fell back to the default
`standard` strictness with no contract in the file to back it. The one command
whose entire job is "adopt RQML here" quietly did nothing for the projects most
likely to run it.

## Decision drivers

- Adopting RQML must work on a repository that already has an `AGENTS.md`.
- A user's existing guidance is theirs — initialization must never destroy it.
- The injected guidance has to stay refreshable as the template evolves, without
  a second run duplicating it or clobbering local edits.
- A project's chosen strictness is a deliberate setting; a refresh must not reset
  it.

## Options considered

### Option 1: Keep create-or-skip
**Pros**
- Simplest; zero risk to existing files.

**Cons**
- The adoption command is a no-op exactly when the user has an `AGENTS.md`.
  Leaves the documented intent ("create AGENTS.md") unmet. Rejected.

### Option 2: Overwrite the existing file
**Pros**
- Guarantees the canonical template is present and current.

**Cons**
- Destroys hand-written, project-specific guidance. Unacceptable for a file
  teams own and edit. Rejected.

### Option 3: Write a separate file (e.g. `AGENTS.rqml.md`)
**Pros**
- Never touches the user's file.

**Cons**
- Agents read `AGENTS.md`, not a sidecar; the guidance would be ignored. Splits
  the contract across two files. Rejected.

### Option 4: Merge a marker-delimited managed block (chosen)
Wrap the template in `<!-- BEGIN RQML … -->` / `<!-- END RQML -->` markers.
Create the file from the block when absent; append the block when the file
exists without one; refresh the block in place when it exists. Text outside the
markers is never touched, and a strictness level already declared in the file is
carried into the regenerated block.

**Pros**
- Adopts cleanly alongside existing content; idempotent; refreshable as the
  template changes; preserves both user prose and chosen strictness.

**Cons**
- The CLI now owns a region of a user-editable file by convention; edits *inside*
  the block are overwritten on refresh. Mitigated by the marker hint ("edit
  outside this block") and by preserving the strictness line specifically.

## Decision

Adopt Option 4. `rqml init` resolves the `AGENTS.md` content through a pure
`applyAgentsTemplate(existing)` function that returns one of `created`,
`merged`, `refreshed`, or `unchanged`, and the command reports the outcome.
The block is matched loosely (`<!-- BEGIN RQML` … `<!-- END RQML -->`) so the
human-readable marker hint can change without orphaning blocks written by older
CLI versions. Strictness is preserved by reading any declared level from the
file before regenerating the block.

## Consequences

- Adopting RQML in a repository that already has an `AGENTS.md` now lands the
  guidance instead of skipping it, while preserving every byte outside the block.
- Re-running `rqml init` is safe and self-healing: it refreshes a stale block and
  no-ops a current one (`skip (up to date)`), so a template bump propagates with
  one command.
- The managed region is a convention, not a lock: a user who edits inside the
  markers will have those edits replaced on the next refresh. The markers and
  this ADR document that boundary; strictness — the one in-block setting teams
  routinely change — is explicitly exempted from being reset.
