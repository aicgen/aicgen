#!/usr/bin/env python3
import json

context = (
    "AICGEN profile full: read AGENTS.md and .codex/instructions.md before editing. "
    "Use project-local aicgen skills for SDLC work. Treat hooks, MCP, and plugin setup as advanced surfaces "
    "that require explicit user review before expansion."
)

print(json.dumps({
    "continue": True,
    "hookSpecificOutput": {
        "hookEventName": "SessionStart",
        "additionalContext": context
    }
}))
