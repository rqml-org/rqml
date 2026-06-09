# RQML hero demo — renders `rqml init` + `rqml check` into demo.gif.
#
# Generate it:
#   1. Install VHS:  https://github.com/charmbracelet/vhs  (brew install vhs)
#   2. From this folder (apps/website/static/img):  vhs demo.tape
#   3. Uncomment the <img src="/img/demo.gif"> block in src/pages/index.mdx
#
# The hidden setup installs the CLI and runs in a throwaway directory, so the
# recording is clean and repeatable and doesn't touch your working tree.

Output demo.gif

Set Shell "bash"
Set FontSize 18
Set Width 1200
Set Height 600
Set Padding 24
Set Theme "Catppuccin Mocha"

Hide
Type "npm install -g @rqml/cli >/dev/null 2>&1 && cd $(mktemp -d) && clear" Enter
Sleep 6s
Show

Type "rqml init" Sleep 600ms Enter
Sleep 2500ms

Type "rqml check" Sleep 600ms Enter
Sleep 3s
