# Monorepo Workspace Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create `totallosstoolkit-workspace` — a thin control-center repo that unifies the website and KB Creator under shared Claude Code tooling, MCP config, and business context without modifying either existing project.

**Architecture:** A new standalone directory at `C:\Users\Gordo\Documents\totallosstoolkit-workspace\` containing a VS Code multi-root workspace file, a `.mcp.json` for PostHog + GitHub MCPs, a `CLAUDE.md` with full ecosystem context, and a `monorepo.md` living checklist. Both existing projects stay untouched.

**Tech Stack:** VS Code workspace, Claude Code CLAUDE.md, MCP JSON config, GitHub CLI, Markdown docs

---

## Pre-Flight Check (You Execute These First)

Before starting, complete these manual actions and check them off in `monorepo.md`:

1. **PostHog API key** — go to https://app.posthog.com/project/settings → "Personal API Keys" → create a key with read access. Note the key and your Project ID (visible in the URL: `app.posthog.com/project/XXXXX`).
2. **GitHub CLI authenticated** — run `gh auth status` in terminal. If not logged in, run `gh auth login`.
3. **Supabase CLI** — run `npm install -g supabase` then `supabase login` (uses browser OAuth).

---

## Task 1: Create Workspace Directory and Initialize Git

**Files:**

- Create: `C:\Users\Gordo\Documents\totallosstoolkit-workspace\` (directory)

**Step 1: Create the directory**

```bash
mkdir -p "/c/Users/Gordo/Documents/totallosstoolkit-workspace"
cd "/c/Users/Gordo/Documents/totallosstoolkit-workspace"
```

**Step 2: Initialize git**

```bash
git init
git checkout -b main
```

**Step 3: Create `.gitignore`**

Create file `.gitignore`:

```
.env
.env.local
*.local
.DS_Store
```

**Step 4: Initial commit**

```bash
git add .gitignore
git commit -m "chore: initialize totallosstoolkit-workspace repo"
```

Expected: `[main (root-commit) xxxxxxx] chore: initialize totallosstoolkit-workspace repo`

---

## Task 2: Create VS Code Multi-Root Workspace File

**Files:**

- Create: `totallosstoolkit.code-workspace`

**Step 1: Create the workspace file**

Create `totallosstoolkit.code-workspace`:

```json
{
  "folders": [
    {
      "name": "Website (totallosstoolkit.com)",
      "path": "../Vehicle Comparison Site"
    },
    {
      "name": "KB Creator",
      "path": "../VV KB Creator"
    },
    {
      "name": "Workspace",
      "path": "."
    }
  ],
  "settings": {
    "files.exclude": {
      "**/node_modules": true,
      "**/__pycache__": true,
      "**/.next": true
    }
  }
}
```

**Step 2: Verify paths resolve**

```bash
ls "/c/Users/Gordo/Documents/Vehicle Comparison Site/package.json" && echo "Website: OK"
ls "/c/Users/Gordo/Documents/VV KB Creator/requirements.txt" && echo "KB Creator: OK"
```

Expected: Both print "OK"

**Step 3: Commit**

```bash
git add totallosstoolkit.code-workspace
git commit -m "chore: add VS Code multi-root workspace config"
```

---

## Task 3: Create `.mcp.json` for PostHog and GitHub MCPs

**Files:**

- Create: `.mcp.json`

**Step 1: Look up the PostHog MCP package**

```bash
npm show posthog-mcp version 2>/dev/null || npm show @posthog/mcp version 2>/dev/null || echo "check https://github.com/PostHog/posthog-mcp"
```

If neither resolves, check https://posthog.com/docs/cdp/mcp for the official package name. The placeholder below assumes `posthog-mcp` — update the `args` array if the package name differs.

**Step 2: Create `.mcp.json` with placeholders**

Create `.mcp.json`:

```json
{
  "mcpServers": {
    "posthog": {
      "command": "npx",
      "args": ["-y", "posthog-mcp"],
      "env": {
        "POSTHOG_PERSONAL_API_KEY": "PASTE_YOUR_POSTHOG_PERSONAL_API_KEY_HERE",
        "POSTHOG_PROJECT_ID": "PASTE_YOUR_POSTHOG_PROJECT_ID_HERE",
        "POSTHOG_HOST": "https://app.posthog.com"
      }
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "PASTE_YOUR_GITHUB_TOKEN_HERE"
      }
    }
  }
}
```

**Step 3: Add `.mcp.json` to `.gitignore` (contains credentials)**

Edit `.gitignore` and add:

```
.mcp.json
```

**Step 4: Create `.mcp.json.example` for documentation (safe to commit)**

Create `.mcp.json.example`:

```json
{
  "mcpServers": {
    "posthog": {
      "command": "npx",
      "args": ["-y", "posthog-mcp"],
      "env": {
        "POSTHOG_PERSONAL_API_KEY": "phc_your_key_here",
        "POSTHOG_PROJECT_ID": "12345",
        "POSTHOG_HOST": "https://app.posthog.com"
      }
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_your_token_here"
      }
    }
  }
}
```

**Step 5: Fill in your credentials**

Open `.mcp.json` and replace:

- `PASTE_YOUR_POSTHOG_PERSONAL_API_KEY_HERE` → your PostHog personal API key (from Pre-Flight step 1)
- `PASTE_YOUR_POSTHOG_PROJECT_ID_HERE` → your PostHog project ID number
- `PASTE_YOUR_GITHUB_TOKEN_HERE` → run `gh auth token` in terminal to get your token

**Step 6: Commit (only the example file, not .mcp.json)**

```bash
git add .gitignore .mcp.json.example
git commit -m "chore: add MCP config template for PostHog and GitHub"
```

---

## Task 4: Create `CLAUDE.md` — Ecosystem Context

**Files:**

- Create: `CLAUDE.md`

**Step 1: Create `CLAUDE.md`**

Create `CLAUDE.md`:

````markdown
# TotalLossToolkit — Claude Code Workspace Context

This workspace contains two tools that together build and grow totallosstoolkit.com.
Always read this file before starting any task.

---

## Ecosystem Map

### 1. Website (`../Vehicle Comparison Site/`)

- **What:** Next.js 16 / React 19 SaaS at totallosstoolkit.com
- **Backend:** Supabase (Postgres), LemonSqueezy payments, PostHog analytics
- **Deploy:** Vercel — auto-deploys from `master` branch on GitHub
- **Features:** Paid vehicle valuation reports · Free knowledge base articles · Professional directory
- **Key env vars:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_POSTHOG_KEY`

### 2. KB Creator (`../VV KB Creator/`)

- **What:** Python 3.13 tool that scrapes Reddit → generates SEO articles for the website KB
- **Stack:** Python, PRAW (Reddit API), Supabase client, Claude Code Skills
- **How it runs:** Claude Code conversation in VS Code — not a standalone server
- **Output:** Markdown articles published to the website's `/knowledge-base/` section
- **Key files:** `config/search_terms.yaml`, `config/article_generation.yaml`, `WORKFLOW.md`

### 3. This Workspace (`./`)

- **What:** Control center — shared MCP config, business context, growth playbooks
- **MCPs active:** PostHog (analytics queries), GitHub (PR/issue management)
- **Supabase:** Use CLI — `supabase db execute --project-ref <ref> --sql "SELECT ..."`

---

## How the Two Tools Connect

1. KB Creator scrapes Reddit for total loss claim discussions
2. Claude Code analyzes posts and generates SEO-optimized articles
3. Articles are published to the website's Supabase `articles` table
4. Website serves them at `/knowledge-base/[slug]`
5. Organic traffic lands on KB articles → converts to paid valuation reports

---

## Business Goals

- **Primary revenue:** Paid vehicle valuation reports (LemonSqueezy one-time purchase)
- **Growth flywheel:** SEO traffic via KB articles → free value → report purchase conversion
- **Key funnel:** Landing page → pricing → report purchase → report delivery
- **PostHog events to monitor:** `report_purchased`, `pricing_page_viewed`, `report_started`

---

## Interacting With Each System

### Website

```bash
# Dev server
cd "../Vehicle Comparison Site" && npm run dev

# Type check
npm run type-check

# Tests
npm run test:ci
```
````

### KB Creator

```bash
# Install deps (first time)
cd "../VV KB Creator" && pip install -r requirements.txt

# Run via Claude Code Skills in conversation — see WORKFLOW.md
```

### Supabase (CLI)

```bash
# Install CLI (once)
npm install -g supabase

# Login (once — browser OAuth)
supabase login

# Run a query
supabase db execute --project-ref <YOUR_PROJECT_REF> --sql "SELECT count(*) FROM articles;"

# Project ref is the subdomain from your Supabase URL:
# https://XXXXXXXXXXXX.supabase.co → ref is XXXXXXXXXXXX
```

### GitHub

```bash
# GitHub MCP is active — use it for PR/issue queries in conversation
# For CLI:
gh pr list
gh issue list
```

---

## Guiding Principles

- **NEVER push to `master`** (website) without explicit user confirmation — it triggers a Vercel deploy
- **KB articles go through review** before being published to the website Supabase DB
- **Don't modify `.env.local`** in either project — credentials are already configured
- **Check `monorepo.md`** for pending manual actions before starting new work
- **PostHog MCP** is the primary tool for analytics questions — prefer it over writing custom queries

````

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add CLAUDE.md ecosystem context for Claude Code"
````

---

## Task 5: Create `monorepo.md` — Living Checklist

**Files:**

- Create: `monorepo.md`

**Step 1: Create `monorepo.md`**

Create `monorepo.md`:

```markdown
# TotalLossToolkit Workspace — Living Instructions

This file tracks manual actions required to set up and operate the workspace.
Claude Code updates this file as new tasks are identified.

---

## Setup Checklist

### Pre-Flight (Do These Before Running the Plan)

- [ ] Get PostHog personal API key from https://app.posthog.com/project/settings
- [ ] Note PostHog Project ID (number in URL: app.posthog.com/project/XXXXX)
- [ ] Verify GitHub CLI authenticated: `gh auth status`
- [ ] Install Supabase CLI: `npm install -g supabase`
- [ ] Log in to Supabase CLI: `supabase login`

### Workspace Setup

- [ ] Task 1: Create directory and init git ✓ (Claude executes)
- [ ] Task 2: Create `.code-workspace` file ✓ (Claude executes)
- [ ] Task 3: Fill in credentials in `.mcp.json` (YOU execute — paste API keys)
- [ ] Task 4: Create `CLAUDE.md` ✓ (Claude executes)
- [ ] Task 5: This file ✓ (Claude executes)
- [ ] Task 6: Create `docs/` context files ✓ (Claude executes)
- [ ] Task 7: Create GitHub repo and push (YOU execute — see Task 7)
- [ ] Task 8: Open workspace in VS Code and verify (YOU verify)
- [ ] Add Supabase project ref to `CLAUDE.md` (YOUR Supabase project ref from dashboard)

---

## In Progress

_(nothing currently in progress)_

---

## Completed

_(moved here as items are done)_

---

## Growth Playbooks

_(PostHog-driven optimization tasks added here over time as we analyze site data)_
```

**Step 2: Commit**

```bash
git add monorepo.md
git commit -m "docs: add monorepo.md living checklist"
```

---

## Task 6: Create `docs/` Business Context Files

**Files:**

- Create: `docs/business-context.md`
- Create: `docs/article-pipeline.md`
- Create: `docs/growth-playbooks.md`

**Step 1: Create `docs/business-context.md`**

Create `docs/business-context.md`:

```markdown
# Business Context — TotalLossToolkit.com

## What It Is

A SaaS for vehicle owners who have been in a total loss accident and need help
understanding their vehicle's value and navigating the insurance claim process.

## Revenue Model

- **Primary:** One-time paid vehicle valuation reports (LemonSqueezy)
- **Secondary (future):** Professional directory listings

## Target Audience

Vehicle owners who have received a total loss settlement offer from their insurer
and want an independent valuation to negotiate or dispute the offer.

## Conversion Funnel
```

Organic search (KB articles)
→ Landing page / Knowledge base
→ Pricing page
→ Report purchase (LemonSqueezy)
→ Report generation
→ Report delivery (PDF)

```

## Key Metrics to Track in PostHog
- `pricing_page_viewed` — top of purchase funnel
- `report_started` — intent confirmed
- `report_purchased` — conversion
- Funnel drop-off between pricing → purchase
- KB article traffic by slug (which articles drive conversions)

## Competitive Advantage
- Free knowledge base builds trust and SEO before asking for money
- Automated article pipeline keeps content fresh with minimal effort
- Independent valuation (not affiliated with insurers)
```

**Step 2: Create `docs/article-pipeline.md`**

Create `docs/article-pipeline.md`:

```markdown
# Article Pipeline — KB Creator → Website

## Overview

The KB Creator tool scrapes Reddit for real user discussions about total loss
claims, analyzes them with Claude Code, and generates SEO-optimized articles
that are published to the website's knowledge base.

## Flow

1. **Configure search terms** — edit `VV KB Creator/config/search_terms.yaml`
2. **Run Reddit scraper** — Claude Code uses the `reddit-search` skill in a KB Creator session
3. **Analyze posts** — Claude Code uses the `analyze-posts` skill to extract pain points
4. **Generate article** — Claude Code uses the `create-article` skill with SEO guidance
5. **Review** — human reviews the generated markdown article
6. **Publish** — approved article is inserted into Supabase `articles` table
7. **Live on site** — available at `totallosstoolkit.com/knowledge-base/[slug]`

## Where Articles Live

- **Supabase table:** `articles` (in website project DB)
- **Website route:** `app/knowledge-base/[slug]/page.tsx`
- **Content format:** Markdown with frontmatter (title, excerpt, tags, reading_time)

## Running the Pipeline

Open VS Code in the `VV KB Creator/` folder and start a Claude Code session.
Follow the prompts in `WORKFLOW.md` — the Skills handle each stage.

## Cadence

Aim for 2-4 new articles per week. Quality > quantity for SEO.
```

**Step 3: Create `docs/growth-playbooks.md`**

Create `docs/growth-playbooks.md`:

```markdown
# Growth Playbooks

Strategies for growing traffic and revenue, informed by PostHog analytics.
Add new playbooks here as patterns emerge from the data.

---

## Playbook 1: Article-to-Conversion Optimization

**Signal:** PostHog shows which KB articles drive the most pricing page views.

**Action:**

1. Query PostHog: "Which knowledge base articles have the highest pricing page click-through rate?"
2. Identify top 3 converting articles
3. Add stronger CTA or contextual upsell to those articles
4. Monitor conversion rate change over 2 weeks

---

## Playbook 2: Funnel Drop-Off Recovery

**Signal:** PostHog funnel shows drop-off between pricing page and purchase.

**Action:**

1. Query PostHog: "What is the drop-off rate between pricing_page_viewed and report_purchased?"
2. If > 70% drop-off: test pricing page copy changes, add social proof, reduce friction
3. A/B test via PostHog feature flags

---

## Playbook 3: Article Gap Analysis

**Signal:** Search Console or PostHog shows impressions with low clicks for certain queries.

**Action:**

1. Identify queries where site ranks page 2-3 but not page 1
2. Use KB Creator to generate a better article targeting that query
3. Internally link from existing high-traffic articles to the new one

---

_(Add new playbooks here as data reveals opportunities)_
```

**Step 4: Commit**

```bash
git add docs/
git commit -m "docs: add business context, article pipeline, and growth playbooks"
```

---

## Task 7: Create GitHub Repo and Push

**YOU execute this task manually.**

**Step 1: Create the GitHub repo**

```bash
cd "/c/Users/Gordo/Documents/totallosstoolkit-workspace"
gh repo create totallosstoolkit-workspace --private --source=. --remote=origin --push
```

Expected output:

```
✓ Created repository YourUsername/totallosstoolkit-workspace on GitHub
✓ Added remote origin
✓ Pushed commits to origin/main
```

**Step 2: Verify on GitHub**

Open: https://github.com/YOUR_USERNAME/totallosstoolkit-workspace

Confirm these files are visible:

- `totallosstoolkit.code-workspace`
- `CLAUDE.md`
- `monorepo.md`
- `.mcp.json.example`
- `docs/` folder

Note: `.mcp.json` should NOT be visible (it's gitignored).

**Step 3: Update `monorepo.md` checklist**

Check off "Task 7: Create GitHub repo and push" in `monorepo.md`.

```bash
git add monorepo.md
git commit -m "docs: mark GitHub repo creation complete in checklist"
git push
```

---

## Task 8: Verify Workspace Opens Correctly

**YOU execute this task manually.**

**Step 1: Open the workspace in VS Code**

```bash
code "/c/Users/Gordo/Documents/totallosstoolkit-workspace/totallosstoolkit.code-workspace"
```

Or: File → Open Workspace from File → navigate to `totallosstoolkit.code-workspace`

**Step 2: Verify multi-root workspace**

In the VS Code Explorer, confirm you see three roots:

- `WEBSITE (TOTALLOSSTOOLKIT.COM)`
- `KB CREATOR`
- `WORKSPACE`

**Step 3: Verify Claude Code sees all three**

Start a Claude Code session in VS Code. Ask:

> "What projects are in this workspace?"

Expected: Claude Code should describe the website, KB Creator, and workspace correctly based on `CLAUDE.md`.

**Step 4: Verify MCPs load**

In Claude Code, run `/mcp` and confirm:

- `posthog` — connected
- `github` — connected

If PostHog shows an error, verify:

1. The package name in `.mcp.json` args is correct (check Step 1 of Task 3)
2. Your API key is pasted correctly (no extra spaces)

**Step 5: Add Supabase project ref to `CLAUDE.md`**

Find your Supabase project ref (the subdomain from your Supabase URL).
Edit `CLAUDE.md` and replace `<YOUR_PROJECT_REF>` with your actual ref.

```bash
git add CLAUDE.md
git commit -m "docs: add Supabase project ref to CLAUDE.md"
git push
```

**Step 6: Mark setup complete**

Move all Setup Checklist items to "Completed" in `monorepo.md`.

---

## You're Done When...

- VS Code shows all three workspace roots
- `/mcp` in Claude Code shows PostHog and GitHub connected
- Claude Code correctly describes the ecosystem when asked
- `monorepo.md` setup checklist is fully checked off
- GitHub repo exists at `github.com/YOUR_USERNAME/totallosstoolkit-workspace`
