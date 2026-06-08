# @rqml/schema

The **single canonical source** of every RQML schema version, the example
documents, and the `AGENTS.md` template.

- `versions/<version>/rqml-<version>.xsd` — the canonical XSDs. The documentation
  site publishes these to the stable `https://rqml.org/schema/<version>/` URLs,
  and `@rqml/core` inlines them for offline validation. There is exactly one copy
  (`REQ-SCHEMA-CANONICAL`); no consumer keeps its own.
- `examples/*.rqml` — canonical valid documents, used as fixtures across the
  toolchain.
- `templates/AGENTS.md` — the default agent-guidance template, published at
  `https://rqml.org/AGENTS.md`.

## API

```ts
import {
  SCHEMA_VERSIONS,
  DEFAULT_SCHEMA_VERSION,
  resolveSchema,      // (version) => XSD text | undefined
  supportedSchemaVersions,
  isSchemaVersion,
  schemaNamespace,    // (version) => "https://rqml.org/schema/<v>"
  schemaUrl,          // (version) => canonical XSD URL
  AGENTS_TEMPLATE,    // the AGENTS.md template text
} from "@rqml/schema";
```

Schema text is inlined into the build, so importing this package needs no
filesystem or network access. The RQML *language* version is independent of this
package's npm version (`REQ-VERSION-DECOUPLE`).
