---
id: why-rqml
---

# Why RQML Exists: Requirements Engineering for LLM-Assisted Software Development

Software rarely fails because teams cannot write code. It fails because teams build the wrong thing, build the right thing in the wrong way, or build the right thing but cannot explain, evolve, or verify it as the context changes.

Requirements Engineering (RE) exists to reduce these failures. It gives us a disciplined way to move from *intent* (what stakeholders need) to *specification* (what the system must do) to *verification* (how we know it does it). Yet in practice, many teams shortcut RE—especially when time is tight—because traditional requirements work can feel heavyweight, ambiguous, and difficult to keep up to date.

LLM-assisted development changes the economics of software creation, but it does **not** remove the need for RE. It amplifies it.

This page explains the rationale for RQML: an XML standard designed to make *good requirements* lower-effort for humans, while making *project context* far more legible to LLMs.

---

## 1) Requirements Engineering is rational — but often too expensive in practice

RE is, at its core, an attempt to create shared understanding:

- **Elicitation:** discovering needs, constraints, and assumptions  
- **Analysis:** resolving ambiguity and conflicts; defining scope  
- **Specification:** stating requirements precisely enough to build and test  
- **Validation:** checking the requirements reflect stakeholder intent  
- **Management:** keeping requirements coherent as systems and environments change  

Most teams agree these activities are sensible. The friction is that “doing it properly” can feel like producing a parallel artifact that drifts out of sync with reality:

- documentation becomes stale,
- terminology diverges across teams,
- decisions are buried in chat logs,
- and requirements degenerate into informal lists without clear structure.

So shortcuts happen—not because RE is misguided, but because the cost of maintaining high-quality requirements is perceived as higher than the benefit.

---

## 2) LLM-first coding makes weak RE even more costly

When humans write most of the code, they also carry much of the context implicitly:
domain knowledge, “why” decisions were made, how constraints trade off, what is out of scope, and what would be unacceptable even if it “works.”

LLMs do not reliably infer this context. They can appear fluent while quietly making incorrect assumptions:

- inventing constraints you never agreed to,
- optimizing for the *most likely* interpretation rather than the *intended* one,
- missing non-functional requirements (security, performance, safety, compliance),
- or producing locally-correct code that is globally inconsistent with the system.

In other words: **LLMs accelerate implementation, but they do not automatically improve understanding.**  
If the specification is thin, the model fills gaps with guesswork.

This is not a flaw unique to LLMs—ambiguity harms human teams too—but LLMs scale the problem because they can generate a large volume of plausible output very quickly. Poor inputs yield poor outputs faster.

---

## 3) RQML: make shared understanding cheap, and make context legible to LLMs

RQML is designed around a simple thesis:

> If requirements are represented in a structured, explicit, and machine-checkable form, then both humans and LLMs can work with them more effectively.

Using RQML changes two things at once.

### (a) Requirements become higher-quality with lower ongoing effort

RQML is intentionally structured (and schema-validatable), which nudges authors toward clarity:

- terms can be defined once and reused consistently,
- requirements can be classified (functional vs. non-functional, constraints, assumptions),
- rationales can be recorded alongside decisions,
- and traceability becomes practical instead of aspirational.

Crucially, LLMs can help create and maintain this artifact:
drafting initial requirements, normalizing language, finding ambiguities, suggesting missing constraints, and keeping cross-references consistent.

That makes “good RE” cheaper—because a large portion of the editorial and consistency work is delegated to tools.

### (b) LLM-generated code improves because the model has better context

LLMs perform best when the task environment is explicit:
definitions, boundaries, scenarios, acceptance criteria, interfaces, and constraints.

RQML is a vehicle for packaging that context so that generation is not “code from a prompt,” but “code from a project specification.” That typically leads to:

- fewer invented assumptions,
- more consistent architecture and naming,
- better coverage of edge cases (because scenarios are explicit),
- and more testable outputs (because verification criteria exist in the same artifact).

---

## How RQML aligns with Requirements Engineering theory

RQML is not “requirements, but in XML” for its own sake. Its structure is meant to reflect recurring RE concerns:

- **Unambiguous specification:** structured fields reduce interpretive latitude  
- **Verification thinking:** requirements are easier to test when they include explicit criteria  
- **Traceability:** requirements → design elements → tests → outcomes (where teams want that discipline)  
- **Change management:** structured artifacts are easier to diff, review, and evolve deliberately  
- **Shared vocabulary:** domain concepts and terms become first-class elements  

In short: RQML aims to *operationalize* good RE practices in a format that both humans and LLM tools can reliably process.

---

## What RQML is (and what it is not)

:::info
**RQML is a requirements specification standard** intended to be readable by humans, friendly to tooling, and highly legible to LLMs.
:::

- It is **not** a replacement for stakeholder conversations.
- It is **not** a guarantee of correctness.
- It is a way to make intent explicit, structured, reviewable, and evolvable—so that LLM-assisted implementation is grounded in something more stable than a chat thread.

---

## Where to go next

- Start writing your first document: **[Quick start](/docs/quick-start)**  
- Learn the structure and best practices: **[User guide](/docs/user-guide)**  
- See working examples: **[Examples](/docs/examples)**  
- Browse the complete tag and attribute index: **[Reference](/docs/reference)**  
- Common questions (and honest trade-offs): **[FAQ](/docs/faq)**  

---

## A practical summary

If you already believe that “clear requirements prevent expensive mistakes,” then the only remaining question is economic:

- Can we make good requirements *cheap enough* to be worth doing?
- Can we make them *useful enough* that they materially improve LLM-assisted development?

RQML is an attempt to answer “yes” to both—by making the requirements artifact structured, maintainable, and directly usable as the context that guides generation, testing, and evolution.
