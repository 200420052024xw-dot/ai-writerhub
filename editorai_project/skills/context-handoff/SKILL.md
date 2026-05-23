---
name: context-handoff
description: Create compact, actionable handoff Markdown files for future Codex sessions when the user asks to preserve context, compress a long project conversation, write a continuation note, prepare for a new chat, record current decisions, or make tomorrow's session able to resume work quickly.
---

# Context Handoff

## Goal

Create a small Markdown handoff that lets a fresh Codex session continue the work without reading the full conversation. Preserve decisions, current state, unfinished work, verification facts, and next actions. Remove narrative, speculation, and stale details.

## Workflow

1. Identify the continuation target: a project, feature, bug, plan, or interrupted implementation.
2. Inspect local files only when needed to confirm current state. Prefer `git status`, relevant `package.json` / config files, recent docs, and files changed in the current task.
3. Write one handoff Markdown file in the project's docs/logs directory. If none exists, create a clearly named file in the repo such as `docs/next_context.md` or `<project_docs>/next_context_<topic>.md`.
4. Keep it optimized for the next agent: concrete paths, commands, decisions, constraints, and next steps.
5. Include a ready-to-use prompt the user can paste into a new conversation.
6. Verify the file exists and, when practical, briefly read it back for obvious omissions.

## What To Preserve

Always include:

- Absolute project path and key subdirectories.
- Current objective and product or feature decision.
- Relevant architecture and stack choices.
- Files already changed or intended to change next.
- Commands that passed, failed, or were interrupted.
- Dependencies installed, partially installed, or planned.
- User preferences and hard constraints.
- Known pitfalls, cached state, ports, environment files, and process assumptions.
- Exact next steps in execution order.
- Suggested first prompt for the next conversation.

Include only if relevant:

- API keys or secrets status, never the secret value.
- Running local URLs and ports.
- Test accounts, model provider names, or env variable names.
- Design references or asset paths.
- Validation standards and acceptance criteria.

## What To Drop

Do not preserve:

- Chatty progress narration.
- Apologies, justifications, or emotional commentary.
- Repeated history that no longer affects next work.
- Large diffs or full source files.
- Secrets, tokens, private keys, or full credentials.
- Unverified assumptions presented as facts.

## Method Refinements

Use these rules to improve handoff quality:

- Prefer current truth over conversation history. If a file disagrees with memory, inspect and record the file state.
- Mark uncertainty explicitly with `Need verify:` instead of guessing.
- Separate "done", "decided", "in progress", and "next".
- Record interrupted commands distinctly from failed commands.
- If dependency installation was interrupted, inspect `package.json` and lock files before stating the dependency state.
- Make paths copyable. Use absolute Windows paths when the workspace is on Windows.
- Keep the handoff readable under context pressure. Aim for 100-250 lines unless the project truly needs more.
- Put the next-session prompt near the end so the user can find it quickly.

## Recommended Structure

Use this template unless the project needs a different shape:

```markdown
# <Project / Feature> Handoff

## Resume Prompt

<One short prompt the user can paste into a new conversation.>

## Project Paths

- Root:
- Frontend:
- Backend:
- Docs/logs:

## Current Objective

<What the next session should continue doing.>

## Decisions

- <Decision and rationale if needed.>

## Current State

- <What is implemented now.>
- <What was verified.>
- <What is partially done or interrupted.>

## Important Files

- `<path>`: <why it matters>

## Constraints

- <User preferences, product constraints, technical constraints.>

## Next Steps

1. <First command or inspection.>
2. <First code change.>
3. <Validation.>

## Validation / Acceptance

- <What must pass or be visible.>

## Pitfalls

- <Known issue, cache, encoding, process, dependency, or design trap.>
```

## File Naming

Use names that make continuation obvious:

- `next_context.md`
- `next_context_<feature>.md`
- `<feature>_handoff.md`
- `<date>_<topic>_handoff.md`

For this project, prefer:

```text
editorai_project/next_context_<topic>.md
```

## Final Response

After writing the handoff, respond with:

- The path to the file.
- A one-sentence summary of what it contains.
- The exact prompt to use in the next conversation.

Keep the response short.
