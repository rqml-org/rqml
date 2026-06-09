---
"@rqml/cli": patch
---

Fix path-less `rqml check`/`validate`/`status` mistaking the `.rqml/` directory for
the spec file, which threw `EISDIR: illegal operation on a directory, read`.
Auto-detection now considers only regular files, so the `.rqml/` governance
directory is ignored, and an explicit directory path is rejected with a clear
message instead of `EISDIR`.
