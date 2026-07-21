---
"@rqml/schema": patch
---

Migrate the seven bundled example specs to RQML 2.2.0.

They were still 2.1.0 and none of them validated against the current schema,
so the documents shipped as "what a real RQML spec looks like" taught the
endpoint form 2.2.0 removed. Rewritten with `rqml migrate`; content is
otherwise unchanged.
