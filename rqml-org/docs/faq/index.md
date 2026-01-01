---
id: faq
title: Frequently Asked Questions
sidebar_label: FAQ
sidebar_position: 6
---


## How to Use This FAQ

- Skim the section headers to find the domain you are interested in (general guidance, schema usage, docs authoring, etc.).
- Expand the question closest to your problem; each answer links to the relevant deep-dive doc when available.
- Still stuck? Scroll to the "Need More Help" section for support options.

## General Guidance

### What is RQML and why does it matter?

Provide a succinct description of the RQML schema mission, the types of XML payloads it validates, and who typically consumes it.

### How stable are the published schemas?

Outline the versioning policy (e.g., semantic versioning), release cadence expectations, and where to watch for deprecation notices.

### Where do I report issues or ask for clarifications?

Describe the preferred support channels (GitHub issues, community forums, email) and the information maintainers need when triaging reports.

## Working With the Schema

### How do I validate my XML against RQML?

Document the recommended tools or CLI commands, include sample invocations, and highlight any project-specific helpers found in this repo.

### Can I extend the schema for custom fields?

Clarify whether extension points exist, the constraints they must respect, and how to communicate custom additions to downstream integrators.

### What changed between versions?

List the upgrade guides or changelogs, plus guidance on running diff tools between the `static/schema` versions shipped here.

## Documentation Site

### How do I preview documentation changes locally?

Reference `npm install` followed by `npm run start`, mention Node version requirements, and link to the quick start doc for more detail.

### How do I contribute a new FAQ entry?

Summarize the process for editing this file, running `npm run build`/`npm run typecheck`, and submitting a pull request.

## Need More Help

- Point readers to the maintainer contact list or issue tracker template.
- Remind contributors to include schema version, toolchain details, and sample payloads when seeking support.

