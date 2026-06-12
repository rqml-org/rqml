---
"@rqml/core": minor
"@rqml/cli": minor
"@rqml/mcp": minor
---

Trace links are now maintainable, not just creatable: `rqml link --update`
repoints an existing edge's external locator (refreshing its drift baseline),
and `rqml link --refresh <edge-id>` re-records the baseline to bless an
intentional implementation change — no more hand-editing trace XML or
baseline.json. The MCP `rqml_link` tool gains the same `update` and `refresh`
modes, and @rqml/core exports the new `updateTraceEdge` primitive.
