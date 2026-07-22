---
title: Why XML
description: Why RQML uses XML — and why that choice fits how LLMs read, and how requirements documents actually work.
---

# Why RQML uses XML

_Full disclosure: RQML is a 25-year-old technology. It started life in 1999 as a student project at the University of York, England, became a startup, but mostly failed. This is why the current iteration of RQML is version 2.x.x and not 1.x.x. The second generation came to life because it is the right solution for an LLM-enabled world — one where LLMs can both write and consume it, and the benefits of the structure come to life._

A natural follow-up question is whether the XML choice — made in 1999, at the height of XML's hype cycle — has aged well. It would be easy to assume the answer is no, and that any sensible modernization would swap it for JSON, YAML, or something newer. I (the author, see [About](/about)) kept XML deliberately. This page explains why.

> XML didn't die. It stopped being trendy in domains where it was the wrong tool, and remained standard in domains where it was the right one. Requirements documents are one of the latter — and, as the LLM era is making clear, so is anything an AI needs to read carefully.

---

## 1) LLMs read XML more reliably than any alternative

This is the most important — and most often overlooked — reason. RQML is designed to be read by coding agents, not just humans, and the format you choose has measurable consequences for how well those agents understand it.

Anthropic's own prompting guidance explicitly recommends XML-style tags for delimiting structure in prompts. The public system prompts of major coding agents are full of them. There are good reasons for this:

- Tag pairs are explicit. Closing tags make it harder for the model to drop fields, lose track of nesting, or hallucinate structure that isn't there.
- Tag names carry semantic weight. An element called `<verification>` tells the model what kind of content it contains; a JSON key named `"verification"` carries the same information but with weaker structural cues.
- Training corpora include enormous amounts of XML — HTML, OOXML, SVG, RSS, Atom — so the format is deeply familiar territory for any modern foundation model.

For a format whose explicit job is to be the durable context an LLM works against, choosing the format LLMs read most reliably is not nostalgia. It's calibration.

---

## 2) Requirements are documents, not data

The deeper technical argument is about what kind of artifact a requirements spec actually is.

JSON, YAML, and TOML are designed for **data**: records with typed fields, intended to be round-tripped between systems. They optimize for terseness and parsing speed.

Requirements specs are **documents**: long-form natural language with structured metadata, cross-references, scenarios, embedded measurements, and rationale. They sit much closer to a Word document than to a database row.

The clearest expression of this difference is **mixed content** — natural language interrupted by structured elements:

```xml
<statement>
  The system SHALL respond within
  <duration value="500" unit="ms"/>
  of receiving
  <ref id="REQ-014"/>.
</statement>
```

XML was designed for exactly this. JSON and YAML cannot model it cleanly — you have to either escape everything into a string (losing the structure) or split the sentence into adjacent fields (losing the prose). Neither is acceptable for a format whose whole point is preserving intent.

This is not a minor preference. It's the same category distinction that put DocBook, DITA, TEI, OOXML (the format behind every `.docx`, `.xlsx`, and `.pptx`), and ePub into XML and kept them there for decades. Choosing JSON for a requirements spec would be the same category error as choosing JSON for a Word document.

---

## 3) The XML you already use without noticing

The "XML is old" instinct comes from a narrow slice of XML's history — SOAP, J2EE, configuration-by-tag. It ignores the much larger surface where XML is alive, current, and unremarkable:

- **SVG** — every modern icon, illustration, and data visualization on the web.
- **OOXML** — every `.docx`, `.xlsx`, and `.pptx` file on your machine.
- **ePub** — the standard format for e-books.
- **Atom** and **RSS** — the feed formats still powering podcasts, blogs, and news syndication.
- **Android layouts** — UI for billions of devices.
- **MathML**, **MusicXML**, **KML**, **GPX**, **TEI**, **DocBook**, **DITA** — each the dominant format in its respective domain.

XML didn't disappear. It stopped being noisy where it was wrong, and continued being correct where it was right. RQML belongs to the second list.

---

## 4) The boring wins that compound

Beyond the LLM and document arguments, XML brings a set of unglamorous-but-real advantages that matter once a spec is real-sized:

- **Schema validation that actually constrains structure.** XSD is more expressive than JSON Schema for document-oriented content — particularly around `ID`/`IDREF` constraints, content models, and substitution groups. This is what lets RQML enforce invariants like "every requirement must have a unique ID, and every traceability link must resolve to one."
- **Namespaces.** Third parties can extend RQML — adding company-specific elements, domain attributes, or specialized verification types — without forking the standard. JSON has no native equivalent.
- **Comments.** Authors can annotate specs with non-content notes. JSON, notoriously, doesn't allow this.
- **Diff stability.** XML diffs cleanly in pull requests. YAML's whitespace sensitivity actively sabotages code review at scale: reordering keys or fixing indentation produces noisy diffs that obscure real changes.

None of these alone is decisive. Together, they compound into the difference between a format that works at one-page scale and a format that works at multi-thousand-requirement scale.

---

## Honest trade-offs

There are real costs to XML, and pretending otherwise would be dishonest:

- It is **more verbose than YAML or TOML** for small examples. A five-line "hello world" will always look heavier in XML.
- Closing tags double the token count for short fields.
- The attribute-versus-element distinction adds an authoring decision that flatter formats don't require.

These costs are real, but they are paid up front and amortized over the life of the artifact. By the time a spec contains two dozen requirements with cross-references, scenarios, verification criteria, and traceability, the closing tags are doing real work — and the verbosity is paying for itself in clarity and validatability.

Authoring tooling — including the [RQML VS Code extension](https://rqml.dev) — reduces the friction further. Most of the cost of XML in 2026 is conceptual, not mechanical.

---

## Practical summary

If you've been thinking of XML as old, try a different axis: **documents versus data, mixed-content versus flat-records, validatable versus free-form.** On those axes, XML is exactly where it should be — and where it's stayed, quietly, while the noisy parts of the ecosystem moved on.

RQML uses XML because:

1. LLMs read it most reliably.
2. Requirements are documents, and XML is the format for documents.
3. The XML you use every day, without noticing, vastly outweighs the XML that retired.
4. Schema validation, namespaces, comments, and clean diffs compound into real value at real scale.

The choice isn't nostalgia. It's the result of asking what kind of artifact a requirements spec actually is, and choosing the format built for that kind of artifact.

---

## Where to go next

- Read the broader rationale: [Why RQML](/why-rqml)
- Start writing your first spec: [Quick start](/docs/quick-start)
- Browse the schema: [RQML 2.2.0 XSD](/schema/rqml-2.2.0.xsd)
