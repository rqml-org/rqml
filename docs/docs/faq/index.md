---
id: faq
title: Frequently Asked Questions
sidebar_label: FAQ
sidebar_position: 6
---

## Why does RQML use XML (and not JSON or some other thing)?

Requirements are high-stakes documents that require mixed content, strict logical assertions, and clear semantic boundaries for LLM attention. JSON's flat key-value structure is excellent for passing a user's profile to a web app, but it lacks the structural scaffolding needed to maintain the integrity of a complex software specification. Using XML/XSD allows RQML to be a self-validating, human-readable source of truth that LLMs can navigate with precision and purpose.

:::tip Pro-tip
Claude (Anthropic) and other top-tier LLMs specifically recommend using XML tags in prompts because they help the model distinguish between instructions and data. By using XML for the source file, you are essentially "pre-prompting" the model for success.
:::

## What do the Official LLM Providers say about XML?

* **Anthropic (Claude): [Use XML tags to structure your prompts](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/use-xml-tags)**
    * *Why:* Anthropic specifically fine-tunes Claude to recognize XML tags as "semantic fences," improving the model's accuracy in following instructions and distinguishing between different data blocks.

* **Google Cloud (Gemini / Vertex AI): [Structure prompts with XML and other delimiters](https://cloud.google.com/vertex-ai/generative-ai/docs/learn/prompts/structure-prompts#use-xml-and-other-delimiters-to-structure-complex-prompts)**
    * *Why:* Google recommends XML for "Complex Prompts" where it is necessary to help the model distinguish between instructions, examples, and user data within a large context window.

* **AWS Machine Learning Blog (Bedrock/Claude): [Prompt engineering techniques and best practices](https://aws.amazon.com/blogs/machine-learning/prompt-engineering-techniques-and-best-practices-learn-by-doing-with-anthropics-claude-3-on-amazon-bedrock/)**
    * *Why:* This technical guide highlights XML as a core technique for ensuring models do not confuse administrative metadata with the core requirements of a document.

* **Microsoft Azure AI (OpenAI/Prompt Engineering): [Structuring inputs with delimiters](https://learn.microsoft.com/en-us/azure/ai-services/openai/concepts/prompt-engineering#use-delimiters)**
    * *Why:* While they discuss various delimiters, they specifically highlight how structured tags (like XML) provide the strongest "instructional boundaries" for the model.

## Is RQML really 25 years old?

Yes! The original RQML 1.0 was released in 2000 at the [University of York Department of Computer Science](https://www.york.ac.uk/computer-science/) — one of the first XML standards designed to capture software intent in a structured, machine-readable form. It was way ahead of its time. LLMs are the first systems capable of fully using it, which is why RQML 2.x was redesigned from the ground up for LLM-native workflows.

## How do I validate my RQML document?

Use `xmllint` (ships with most systems) or any XSD-capable validator:

```bash
xmllint --schema rqml-2.1.0.xsd my-spec.rqml --noout
```

The schema enforces structure, ID uniqueness, and referential integrity for trace edges. Download it from the [schema page](https://rqml.org/schema/rqml-2.1.0.xsd).

## What changed in version 2.1.0?

The biggest change is the **trace redesign**: `traceEdge` was replaced by `edge` with structured endpoints supporting three locator types — `local` (same document, keyref-validated), `doc` (cross-document with version/git pinning), and `external` (URI-based).

Other changes:
- Five new TraceType values: `consumesInterface`, `providesInterface`, `conformsTo`, `deprecates`, `breaks`
- `RefType`/`RefsType` removed — inline `refs` elements are gone from all element types; use trace edges instead

See the full [Changelog](/changelog) for details.

## How do I link requirements to external systems like Jira or GitHub?

Use `external` locators in trace edges with URI conventions:

```xml
<edge id="TR-JIRA" type="implements">
  <from><locator><local id="REQ-AUTH-001"/></locator></from>
  <to><locator><external uri="jira:PROJ-1234"/></locator></to>
</edge>
```

Common URI schemes: `jira:PROJ-1234`, `github:owner/repo/issues/42`, `git:a1b2c3d`, `file:src/auth.ts#L42`, `urn:gdpr:article:17`.

## Can I reference requirements across multiple RQML documents?

Yes. Use `doc` locators with `uri` and `id` attributes, optionally pinned to a `version` or `git` commit:

```xml
<edge id="TR-CROSS" type="dependsOn">
  <from><locator><local id="REQ-PAY-001"/></locator></from>
  <to><locator><doc uri="auth-spec.rqml" docId="AUTH-001" id="REQ-AUTH-001" version="2.1.0"/></locator></to>
</edge>
```

## What requirement types does RQML support?

Nine types covering the full spectrum of software concerns:

| Type | Meaning | Drives |
|------|---------|--------|
| **FR** | Functional | Application logic, features |
| **NFR** | Non-Functional | Performance, reliability, scalability |
| **IR** | Interface | API contracts, integrations |
| **DR** | Data | Schemas, validation, retention |
| **SR** | Security | Auth, encryption, audit |
| **CR** | Constraint | Platform, technology mandates |
| **PR** | Policy/Compliance | Regulatory obligations |
| **UXR** | User Experience | Accessibility, i18n, UI |
| **OR** | Operational | Monitoring, logging, backups |

## How should I use RQML with LLMs?

Include your `.rqml` file (or relevant sections) in the LLM context. The schema's XML comments are written specifically for LLM consumption — they explain what each section means, how to generate code from it, and what patterns to follow. Key workflows:

1. **Elicitation**: Ask the LLM to help draft requirements from user stories or conversations
2. **Code generation**: Point the LLM at `domain`, `requirements`, and `interfaces` sections
3. **Test generation**: Use `acceptance/criterion` (given/when/then) and `verification` sections
4. **Impact analysis**: Ask the LLM to follow trace edges to find what's affected by a change

## Where do I report issues or contribute?

RQML is developed in the open on [GitHub](https://github.com/gudgeirsson/rqml). File issues, submit pull requests, or start a discussion there.

