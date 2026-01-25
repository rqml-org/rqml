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

# Example AGENTS.md

Download the <a href="/AGENTS.md" target="_blank">AGENTS.md template</a> and copy it to your project root. Adjust the **Strictness** level to match your project needs.

The template includes:

- **Strictness levels**: `relaxed`, `standard`, `strict`, `certified` — choose based on your project's regulatory and traceability needs
- **Phase-based workflow**: Elicit → Specify → Implement → Verify → Trace
- **Quality checklists** for requirements (testable, unambiguous, traceable)
- **Sync protocol** for when code and spec diverge
- **Summary templates** for PRs, commits, and elicitation questions
- **Quick reference table** comparing strictness levels across all aspects
