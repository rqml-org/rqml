---
"@rqml/cli": patch
"@rqml/mcp": patch
---

Docs: sync the published `@rqml/cli` and `@rqml/mcp` package READMEs with the
shipped surface. The CLI README now lists the `rqml lint` command, the
`--workspace`/`--all` and `--ignore` flags, and the nearest-wins spec resolution;
the MCP README lists the `rqml_discover` tool and the `file` input. (The READMEs
are what npm displays; they had drifted behind the 0.6.0/0.7.0 features.)
