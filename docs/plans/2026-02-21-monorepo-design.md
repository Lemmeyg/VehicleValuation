# Monorepo Workspace Design

**Date:** 2026-02-21
**Status:** Approved — pending implementation plan

## Overview

Create a thin workspace repository (`totallosstoolkit-workspace`) that unifies the website and KB Creator under shared Claude Code tooling and business context, without modifying either existing project or their deployment pipelines.

## Goals

- Give Claude Code full ecosystem visibility across both tools in one session
- Scope PostHog and GitHub MCPs to the project
- Use Supabase CLI (already configured) instead of Supabase MCP
- Provide a living `monorepo.md` checklist for manual actions required from the user
- Enable PostHog-driven optimization by making analytics queryable in conversation

## What Is NOT Changing

- `Vehicle Comparison Site` repo — untouched, Vercel deploy stays as-is
- `VV KB Creator` repo — untouched
- Neither project is nested inside the other
- No shared packages or code extracted

---

## Repository Structure

```
Documents/
├── Vehicle Comparison Site/        ← untouched
├── VV KB Creator/                  ← untouched
└── totallosstoolkit-workspace/     ← NEW repo
    ├── totallosstoolkit.code-workspace
    ├── CLAUDE.md
    ├── .mcp.json
    ├── monorepo.md
    └── docs/
        ├── business-context.md
        ├── article-pipeline.md
        └── growth-playbooks.md
```

---

## Files

### `totallosstoolkit.code-workspace`

VS Code multi-root workspace file. Opens all three folders simultaneously so Claude Code sees the full ecosystem in one session.

```json
{
  "folders": [
    { "name": "Website", "path": "../Vehicle Comparison Site" },
    { "name": "KB Creator", "path": "../VV KB Creator" },
    { "name": "Workspace", "path": "." }
  ]
}
```

### `.mcp.json`

Workspace-scoped MCP config. Contains:

- **PostHog MCP** — project API key + project ID (placeholder, user fills in)
- **GitHub MCP** — already globally configured, included here for workspace portability

Supabase is accessed via the existing Supabase CLI — no MCP needed.

### `CLAUDE.md`

Primary context file loaded by Claude Code on every session. Covers:

1. **Ecosystem map** — what each project is, where it lives, how they connect
2. **Business goals & KPIs** — revenue target, conversion funnel, article pipeline targets
3. **How to interact with each system** — dev commands, Supabase CLI usage, Vercel deploy rules
4. **Guiding principles** — never push to Vercel-connected branches without confirmation; KB articles go through review before publishing

### `monorepo.md`

Living checklist of manual actions required from the user. Updated by Claude Code as new tasks are identified. Structured as: Setup Checklist → In Progress → Completed → Growth Playbooks.

### `docs/`

- `business-context.md` — revenue metrics, conversion goals, target audience
- `article-pipeline.md` — how KB Creator Reddit scrape → article → website KB publish flow works
- `growth-playbooks.md` — PostHog-driven optimization strategies (populated over time)

---

## MCP Strategy

| Tool     | Approach          | Reason                                              |
| -------- | ----------------- | --------------------------------------------------- |
| PostHog  | MCP (`.mcp.json`) | Needs to query analytics in conversation            |
| GitHub   | MCP (`.mcp.json`) | PR/issue management across both repos               |
| Supabase | CLI via Bash      | Already installed + authenticated; simpler than MCP |

---

## Key Decisions

- **No submodules** — both projects referenced by path, not embedded
- **Supabase CLI over MCP** — avoids duplicate credential management
- **Option B (not C)** — no automation scripts upfront; add incrementally once workspace is running
- **Separate GitHub repo** — workspace gets its own repo so docs/playbooks are version controlled without affecting Vercel

---

## Next Step

Create implementation plan via `writing-plans` skill.
