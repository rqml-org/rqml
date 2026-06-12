---
"@rqml/cli": patch
"@rqml/mcp": patch
---

`rqml --version` (and the MCP server's declared version) now report the real
installed package version instead of a hardcoded constant that went stale on
release: 0.2.0 shipped while `--version` still printed 0.1.0.
