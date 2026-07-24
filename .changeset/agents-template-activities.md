---
"@rqml/schema": patch
"@rqml/cli": patch
"@rqml/mcp": patch
---

Name the requirements-engineering activity, and the finding rather than the gate

The AGENTS.md template told agents to "use as much of the RQML tagset as is
necessary" and left it there. That supplies no occasion for reaching: the
element families with a CLI writer and a gate read-back get used, and the ones
without get replaced by prose in `<notes>`, where `check`, `matrix` and `impact`
cannot see it.

The template's workflow section now names the ISO/IEC/IEEE 29148 activities each
of the five stages carries, and its schema guidance replaces the tagset line
with observable triggers — a boundary number wants `<rule>`/`<examples>`, a
lifecycle noun wants a `<stateMachine>`, two goals in tension want a
`conflictsWith` goalLink, a SHALL sitting in a note wants promoting — framed as
signs to watch for rather than sections to fill. It states plainly that analysis
raises no finding at all, so a passing check is not read as evidence the
activity happened.

Agent-facing text now reports each finding by the artifact it names — the goal
no requirement satisfies, the requirement with no verification edge, the file
that changed after its edge was recorded — rather than by the state of the gate,
and describes drift as a suspect link to re-read rather than a defect. The same
distinction reaches `rqml validate`'s and `rqml check`'s help text and the
`rqml_validate` / `rqml_check` MCP descriptions: `rqml validate` performs
*document* validation, and requirements validation in the 29148 sense is what a
person records by approving a requirement — so no passing check attests it.

Strings only. Command names, JSON keys, rule codes, exit codes and every enum
are unchanged.
