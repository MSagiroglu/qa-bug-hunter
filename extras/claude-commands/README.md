# Optional shortcut commands for Claude Code

The skill itself is invoked as `/senior-qa-explorer` (the skill name). These two
files add short custom slash commands:

- `/qa-session "<charter>"` runs Session mode.
- `/qa-explore <module>` runs a Sweep.

Install (copy; re-copy after updating the repo):

    # Windows (cmd.exe)
    mkdir "%USERPROFILE%\.claude\commands" 2>nul & copy extras\claude-commands\qa-*.md "%USERPROFILE%\.claude\commands\"

    # Windows (PowerShell)
    New-Item -ItemType Directory -Force "$env:USERPROFILE\.claude\commands" | Out-Null; Copy-Item extras\claude-commands\qa-*.md "$env:USERPROFILE\.claude\commands\"

    # macOS / Linux
    mkdir -p ~/.claude/commands && cp extras/claude-commands/qa-*.md ~/.claude/commands/

Start a new Claude Code session afterwards. For one project only, copy them to
`<project>/.claude/commands/` instead. Remove them by deleting the two files.
They only work together with the linked skill (see the main README).
