---
id: introduction
title: Introduction to RQML
sidebar_label: Introduction
sidebar_position: 1
---

# RQML: Make requirements the thing you build

Most software teams *say* requirements matter — then spend their lives arguing in tickets, guessing intent from scattered docs, and treating code as the only “real” truth.

**RQML flips that.**

With RQML, the **requirements become the primary artifact**: structured, versioned, reviewable, and readable by both humans *and* LLMs. Teams collaborate on intent. LLMs generate the implementation from that intent.

**You maintain the spec.  
The code is derived.**

---

## What you can do with RQML

RQML is designed for a workflow where:

- **Stakeholders and developers collaborate in one place** (the RQML spec).
- **LLMs use the spec as executable intent** to generate code and changes.
- **Validation and structure reduce ambiguity** compared to free-form documents.
- **The spec stays in sync with the system** because it *drives* the system.

If it isn’t in RQML, it isn’t a requirement.  
If it isn’t derived from RQML, it isn’t the system.

---

## Why “requirements as the product” works

Traditional dev workflows treat requirements as input and code as output — but the output quickly becomes the only reliable truth. That makes change expensive, reviews harder, and onboarding slower.

RQML aims to make change cheap again by putting the center of gravity back where it belongs:

- **Intent is explicit**
- **Context is preserved**
- **Decisions are reviewable**
- **Implementation can be regenerated**

Think of it like moving from “hand-crafted binaries” to “source code”… except the new “source code” is your requirements.

---

## What’s in an RQML document (high level)

An RQML document captures system intent in a structured form — typically including things like:

- **Metadata**: versioning, ownership, lifecycle
- **Goals and context**: what the system is for, constraints, scope
- **Scenarios**: how users and systems interact
- **Requirements**: the contractual behaviors and qualities of the system
- **Interfaces & verification**: integration points and how requirements are proven

You don’t need to learn everything up front. The fastest way to understand RQML is to read (and edit) a tiny example.

---

## Philosophy (in one paragraph)

RQML is built for an LLM-native world: humans should own **intent**, not plumbing. The spec should be the **single source of truth**, and implementation should be **generated**, reproducible, and continuously aligned with the current requirements.

If that sounds like the future you want to build—start with the Quick start.

➡️ **Go to:** *Quick start*
