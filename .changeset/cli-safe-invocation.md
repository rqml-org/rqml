---
"@rqml/cli": patch
---

`--help` and unrecognized flags can never rewrite a spec.

`rqml migrate --help` silently migrated the discovered spec in place instead of
printing help: `-h`/`--help` was only recognized in the command position, so the
flag fell through to a command that takes no required positional, which then
discovered a spec and wrote it.

- `-h`/`--help` anywhere in a command's arguments is now intercepted before
  dispatch — prints usage, exits 0, touches no file. This applies to every
  command, not just `migrate` (`rqml check --help` and friends previously ran
  the command).
- `rqml migrate` now rejects unrecognized flags with a usage error rather than
  ignoring them, so a mistyped option cannot fall through to a write.

Bare `rqml migrate` still discovers and migrates — typing the command is
explicit intent; the guards only cover input the CLI does not understand.
