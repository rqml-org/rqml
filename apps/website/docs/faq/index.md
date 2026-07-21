---
id: faq
title: Frequently Asked Questions
sidebar_label: FAQ
sidebar_position: 8
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

Yes — RQML began as a September 2000 MSc thesis at the [University of York](https://www.york.ac.uk/computer-science/): *Using XML for Requirements Markup*, supervised by [Tim Kelly](https://pure.york.ac.uk/portal/en/persons/tim-kelly). The thesis developed a **Requirements Markup Language (RQML)** as an XML DTD — version 0.9 — with elements for requirements, stakeholders, use cases, and traceability, declared under an `http://www.rqml.org/namespaces/rqml` namespace. XML itself was barely two years old.

The idea was ahead of its tooling: a structured, machine-readable requirements format only really pays off once something can read and reason over it at scale. LLMs are that something — so RQML 2.x is a ground-up redesign (now XSD-based) for LLM-native workflows, carrying the same core vocabulary forward 25 years later.

## How do I validate my RQML document?

Use `xmllint` (ships with most systems) or any XSD-capable validator:

```bash
xmllint --schema rqml-2.2.0.xsd my-spec.rqml --noout
```

The schema enforces structure, ID uniqueness, and referential integrity for trace edges. Download it from the [schema page](https://rqml.org/schema/rqml-2.2.0.xsd). Every version stays published at `https://rqml.org/schema/rqml-<version>.xsd`.

## What changed in version 2.2.0?

Trace edges are written in a **compact form**: the endpoints are the `from` and `to` attributes rather than nested `locator` elements. The three endpoint kinds are unchanged in meaning — the kind is now inferred from the value's shape.

```xml
<!-- 2.1.0 -->
<edge id="TR-1" type="satisfies">
  <from><locator><local id="REQ-A"/></locator></from>
  <to><locator><local id="GOAL-B"/></locator></to>
</edge>

<!-- 2.2.0 -->
<edge id="TR-1" type="satisfies" from="REQ-A" to="GOAL-B"/>
```

This is the only change in 2.2.0, and it is breaking: the nested elements are removed. Run `rqml migrate` to upgrade a spec (`--dry-run` previews it).

## What changed in version 2.1.0?

The **trace redesign**: `traceEdge` was replaced by `edge` with structured endpoints supporting three locator types — `local` (same document), `doc` (cross-document with version/git pinning), and `external` (URI-based). 2.2.0 kept these three kinds but changed how they are written.

Other changes:
- Five new TraceType values: `consumesInterface`, `providesInterface`, `conformsTo`, `deprecates`, `breaks`
- `RefType`/`RefsType` removed — inline `refs` elements are gone from all element types; use trace edges instead

See the full [Changelog](/changelog) for details.

## How do I link requirements to external systems like Jira or GitHub?

Use a URI as the endpoint value:

```xml
<edge id="TR-JIRA" type="implements" from="REQ-AUTH-001" to="jira:PROJ-1234"/>
```

Common URI schemes: `jira:PROJ-1234`, `github:owner/repo/issues/42`, `git:a1b2c3d`, `file:src/auth.ts#L42`, `urn:gdpr:article:17`.

## Can I reference requirements across multiple RQML documents?

Yes. Use an `rqml:` endpoint — the other document's URI, `#`, and the target id — optionally pinned to a `version` or `git` commit:

```xml
<edge id="TR-CROSS" type="dependsOn" from="REQ-PAY-001"
      to="rqml:auth-spec.rqml#REQ-AUTH-001;version=1.4;docId=AUTH-001"/>
```

## How does RQML work in a monorepo?

One repository can hold many specs — one per package, app, or service. A spec governs its own directory and everything beneath it, a nested spec takes over its own subtree, and the **nearest** spec to a file wins — the same model as `.editorconfig` or `tsconfig.json`. The `rqml` CLI resolves the governing spec automatically, and `rqml check --workspace` gates every spec in the repository with a single exit code.

See the [**Monorepo guide**](/docs/monorepo) for the full model, the design decisions behind it, and the workspace and `rqml_discover` tooling. To reference a requirement that lives in *another* spec, use the `rqml:` endpoint shown above.

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

