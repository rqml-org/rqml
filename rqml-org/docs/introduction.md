---
id: introduction
title: Introduction to RQML
sidebar_label: Introduction
sidebar_position: 1
---

# RQML Schema Documentation

This documentation covers the RQML XML schema used to capture requirements, goals, scenarios, verification, and traceability data for engineering projects. The current schema version is **2.0.1** and is served from `static/schema/rqml-2.0.1.xsd` (available at `/schema/rqml-2.0.1.xsd` when the site is built).

## What you'll find here
- **Schema reference**: key elements, attributes, and allowed values across meta data, catalogs, goals, requirements, interfaces, verification, trace, and governance.

- **Examples**: minimal document skeletons and snippets you can adapt for new specs.

## Validation
- You can validate RQML documents with many XML tools, for example xmllint on the command line: `xmllint --schema static/schema/rqml-2.0.1.xsd sample.rqml.xml --noout`.
- Minimal skeleton:

```xml
<rqml xmlns="https://rqml.org/schema/2.0.1" version="2.0.1" docId="DOC-001" status="draft">
  <meta>
    <title>System Title</title>
    <system>System Code</system>
  </meta>
  <requirements>
    <req id="REQ-001" type="FR" title="Example requirement">
      <statement>As a user, I can ...</statement>
    </req>
  </requirements>
</rqml>
```
