# Pictallion Roocode Pack

This pack adds a **lean always-on prompt** and moves bulky docs into **on-demand refs** so Roo Code stays under token limits while remaining fully autonomous.

## What’s inside
- `.roo/rules/00-core-rules.md` → tiny, always included
- `.roo/rules-{mode}/` → short, mode-specific guardrails
- `.roo/refs/` → big docs (build/run, testing, architecture, troubleshooting, prioritized files, and your uploaded README)
- `.roomodes` → custom modes for Orchestrator, Architect, Coder, QA
- `.vscode/cline_mcp_settings.template.json` → MCP template
- `scripts/estimate_tokens.py` → heuristic token sizer

## Install
Copy the contents into the root of your Pictallion repo.

Then in Roo Code:
1. Select a custom **Mode** (e.g., Orchestrator).
2. Keep `.roo/rules/00-core-rules.md` small; edit refs as needed.
3. (Optional) Configure MCP using the template (copy to your VS Code Roo settings path).

## Workflow
1. Ask Roo in **Orchestrator**: “Ship feature X.”
2. It drafts a plan (Architect), assigns tasks (Coder/QA), and runs `just` commands.
3. Use refs instead of pasting large files; Roo should **open** files and summarize.

## Token Budgeting
Run:
```bash
python3 scripts/estimate_tokens.py .roo/rules .roo/refs
```
Keep **always-on** rules under ~2k tokens. Put everything else in refs.
