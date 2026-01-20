---
id: quick-start
title: Quick-start
sidebar_label: Quick start
sidebar_position: 2
---

# Quick start

- Create a file "requirements.rqml" in the root of your project
- Copy the following scaffold into your requirements.rqml:
```xml
<rqml xmlns="https://rqml.org/schema/2.0.1" version="2.0.1" docId="DOC-HELLO-001" status="draft">
  <meta>
    <title>...</title>
    <system>...</system>
  </meta>
  <requirements>
    <req id="..." type="FR" title="Print greeting" status="draft" priority="must">
      <statement>...</statement>
    </req>
  </requirements>
</rqml>
```
- Tell your LLM of choice that the requirements specification for your project is in requirements.rqml - you can do this through your prompt and/or in AGENTS.md (see below for example AGENTS.md entry)
- Write your requirements in the RQML file, with help of an LLM if you want.
- Ask your LLM to implement the requirements
- Test and repeat.

# Example AGENTS.md entry

```markdown
# Agent Guidance (RQML + Traceability)

This repository uses **RQML (Requirements Markup Language)** as the source of truth for system intent.
When making changes, you MUST preserve traceability between **requirements ⇄ code ⇄ verification**.

## Where requirements live
- Primary requirements file: `requirements.rqml` (or `rqml.xml`)
- Supporting artifacts:
  - Verification: `verification/` (tests, scripts, checklists)
  - Trace outputs (if used): `trace/` or `rqml-trace/`

## Operating rules (mandatory)
1. **Start from RQML**
   - If the user request changes behavior, update RQML first (or propose the minimal RQML delta).
   - Do not implement behavior that is not represented in RQML, unless explicitly marked as a temporary workaround.

2. **Keep requirement IDs stable**
   - Never renumber or reuse IDs.
   - If a requirement is replaced, deprecate it and add a new one; keep the old ID as historical context.

3. **Maintain trace links**
   - For every requirement you implement or modify, produce explicit links to:
     - Code locations (file paths + key symbols/functions)
     - Tests / verification artifacts that demonstrate compliance
   - If the repo supports it, add/refresh `<trace>` entries in the RQML document.

4. **Update verification with implementation**
   - New/changed requirements must have verification updated accordingly (tests preferred).
   - If automated tests are not feasible, add a manual verification step and explain why.

5. **Output format in PR / change summary**
   Provide a short “RQML Trace Summary” with:
   - Requirements touched (IDs + titles)
   - Code changes (file list)
   - Verification changes (tests/scripts)
   - Any gaps / follow-ups

## Minimal “RQML Trace Summary” template
- Requirements:
  - REQ-xxx: <title> (changed/implemented)
- Code:
  - `path/to/file.ext` — <what changed>
- Verification:
  - `path/to/test.ext` — <what verifies it>
- Notes:
  - <assumptions / known limitations / future work>

## If RQML is missing or ambiguous
- Ask for the missing requirement(s) OR propose candidate RQML wording.
- Clearly label assumptions and include them as RQML notes or open items.
```

If you want to be very firm about preventing untraced behavior, add a stricter "no-ghost-features" clause:
```markdown
**No ghost features:** do not introduce new externally-visible behavior unless it is represented in RQML with a stable requirement ID.
```
