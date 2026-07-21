---
"@rqml/cli": patch
---

Fix `--spec` being silently ignored by `validate`, `check`, `status`, `lint`,
and `overview`.

Those commands take the spec path positionally and read it only from there, so
`--spec` was dropped and the command fell back to discovery. `rqml validate
--spec broken.rqml` reported `✓ requirements.rqml is valid` and exited 0 —
success for a document it never opened.

`--spec` is now resolved centrally, so it works for every command. Passing both
a positional path and a *different* `--spec` is an error rather than one
silently taking precedence.
