---
id: quick-start
title: Quick-start
sidebar_label: Quick start
sidebar_position: 2
---

# Quick start

- Create **one `.rqml` file** in the root of your repository (by convention `requirements.rqml`, or a descriptive name like `myapp.rqml`)
- Copy the following scaffold into your `.rqml` file:
```xml
<rqml xmlns="https://rqml.org/schema/2.1.0"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:schemaLocation="https://rqml.org/schema/2.1.0 https://rqml.org/schema/rqml-2.1.0.xsd"
      version="2.1.0" docId="DOC-HELLO-001" status="draft">
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
- Tell your LLM of choice that the requirements specification for your project is in the `.rqml` file - you can do this through your prompt and/or in AGENTS.md (see below for example AGENTS.md entry)
- Write your requirements in the RQML file, with help of an LLM if you want.
- Ask your LLM to implement the requirements
- Test and repeat.

# Recommended tooling

Two optional add-ons that make working with RQML noticeably smoother:

- **[Install the RQML VS Code extension](https://marketplace.visualstudio.com/items?itemName=rqml.rqml-vscode)** — adds first-class editor support for `.rqml` files in VS Code, so writing and reviewing specs feels native.
- **[Install the RQML Agent Skill](https://github.com/rqml-org/rqml-skill)** — drop it into Claude Code or any other skill-compatible coding agent, and your agent will understand RQML and the spec-first workflow out of the box, with no extra prompting required.

# Example AGENTS.md

Download the <a href="/AGENTS.md" target="_blank">AGENTS.md template</a> and copy it to your project root. Adjust the **Strictness** level to match your project needs.

The template includes:

- **Strictness levels**: `relaxed`, `standard`, `strict`, `certified` — choose based on your project's needs
- **Spec-first workflow**: Elicit → Specify → Implement → Verify → Trace
- **Sync protocol** for when code and spec diverge
- **Change summary template** for PRs and commits
