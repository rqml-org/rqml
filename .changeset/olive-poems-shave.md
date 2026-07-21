---
"@rqml/schema": patch
"@rqml/cli": patch
---

Stop `rqml init` seeding new projects with the previous schema generation.

The scaffolded `requirements.rqml` hardcoded `2.1.0` and the bundled `AGENTS.md`
template hardcoded `rqml-2.1.0.xsd`, so every project created after the 2.2.0
release started on the superseded schema — with an `AGENTS.md` that pointed its
agent at the wrong XSD. Both now derive from `DEFAULT_SCHEMA_VERSION`, and the
scaffolded spec carries an `xsi:schemaLocation`.

The template also documents `rqml migrate` and describes `rqml link` as recording
any trace type rather than only `implements`/`verifiedBy`.

Tests assert that the scaffolded spec is XSD-valid at the default version and
that the template's schema URL agrees with it, so neither can fall behind a
future schema release.
