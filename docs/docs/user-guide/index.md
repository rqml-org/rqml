---
id: user-guide
title: RQML User Guide
sidebar_label: User Guide
sidebar_position: 3
description: Learn how to read, write, and evolve RQML specifications for LLM-friendly software requirements.
---

# RQML User Guide

RQML (Requirements Markup Language) is an XML-based format for writing software requirements in a way that stays readable for humans while remaining highly structured for tools and LLM-driven code generation.

This user guide focuses on **how to author** an RQML document: what goes where, how to keep it consistent, and how to evolve it over time without losing clarity or traceability.

## High-level RQML document structure

At the top level, an RQML document is organized into a fixed sequence of sections. Some are **required** (must appear), others are **optional** (may be omitted when not needed).

In order, the top-level structure is:

1. **`meta`** *(required)* — Document identity and metadata (versioning, authorship, lifecycle, etc.).
2. **`catalogs`** *(optional)* — Shared definitions and reusable lists (e.g., requirement types, severities, tags, vocabularies).
3. **`domain`** *(optional)* — Domain context and terminology: key concepts, constraints, assumptions, and glossary-style information.
4. **`goals`** *(optional)* — The "why": business/product goals, desired outcomes, and success criteria.
5. **`scenarios`** *(optional)* — Narrative descriptions of how the system is used (user journeys, use cases, operational stories).
6. **`requirements`** *(required)* — The "what": normative requirements statements that the system must satisfy.
7. **`behavior`** *(optional)* — State machines: entity lifecycles, workflow states, and valid transitions that formalize requirements.
8. **`interfaces`** *(optional)* — External boundaries: APIs, UIs, integrations, events, data contracts, protocols.
9. **`verification`** *(optional)* — How requirements are validated (tests, acceptance criteria, inspection procedures).
10. **`trace`** *(optional)* — Traceability links between goals, scenarios, requirements, interfaces, and verification.
11. **`governance`** *(optional)* — Ownership, review/approval workflow, change control, and policy for maintaining the spec.

### A minimal skeleton

Here’s a minimal “shape” of an RQML document (showing the required sections plus the most common optional ones):

```xml
<rqml>
  <meta>
    <!-- document metadata -->
  </meta>

  <!-- optional -->
  <domain>
    <!-- domain context -->
  </domain>

  <!-- required -->
  <requirements>
    <!-- normative requirements -->
  </requirements>

  <!-- optional -->
  <verification>
    <!-- how requirements are verified -->
  </verification>
</rqml>
