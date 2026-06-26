# Remove Pricing Hint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the "• Reports from $19" text from the homepage report submission form.

**Architecture:** Single-line deletion in `components/Hero.tsx`. The conditional expression `{emailCaptureEnabled && ' • Reports from $19'}` is removed from the paragraph below the submit button. No logic, flag, or other file changes required.

**Tech Stack:** Next.js / React / TypeScript

## Global Constraints

- Do NOT touch `pricing/layout.tsx` or `pricing/page.tsx` — those belong to the pricing page, not the homepage.
- Do NOT change the `emailCaptureEnabled` flag or any surrounding logic.
- Branch from a clean, up-to-date `main`.

---

### Task 1: Align repos and create feature branch

**Files:**

- No file changes — git operations only

- [ ] **Step 1: Switch to main and pull latest**

```bash
cd "C:\Users\Gordo\Documents\Vehicle Comparison Site"
git checkout main
git pull origin main
```

Expected: Branch switches to `main`, pulls commit `0bbde47` (PR #55 merge). Working tree clean.

- [ ] **Step 2: Create feature branch**

```bash
git checkout -b feat/remove-pricing-hint
```

Expected: `Switched to a new branch 'feat/remove-pricing-hint'`

---

### Task 2: Remove the pricing hint text

**Files:**

- Modify: `components/Hero.tsx:469-472`

- [ ] **Step 1: Open `components/Hero.tsx` and locate the paragraph (around line 469)**

The current code reads:

```tsx
<p className="text-base text-slate-600">
  Takes 60 seconds • Instant results
  {emailCaptureEnabled && ' • Reports from $19'}
</p>
```

- [ ] **Step 2: Delete the conditional expression on line 471**

After the change the paragraph must read exactly:

```tsx
<p className="text-base text-slate-600">Takes 60 seconds • Instant results</p>
```

- [ ] **Step 3: Run type-check to confirm no type errors**

```bash
cd "C:\Users\Gordo\Documents\Vehicle Comparison Site"
npm run type-check
```

Expected: exits 0, no errors.

- [ ] **Step 4: Run full test suite**

```bash
npm run test:ci
```

Expected: all tests pass (no test references the "$19" string in Hero context).

- [ ] **Step 5: Commit the change**

```bash
git add components/Hero.tsx
git commit -m "fix: remove \$19 pricing hint from homepage form"
```

---

### Task 3: Push branch and open PR

**Files:**

- No file changes — git/GitHub operations only

- [ ] **Step 1: Push the feature branch**

```bash
git push -u origin feat/remove-pricing-hint
```

- [ ] **Step 2: Open a pull request**

```bash
gh pr create \
  --title "fix: remove \$19 pricing hint from homepage form" \
  --body "$(cat <<'EOF'
## Summary
- Removes the "• Reports from $19" text that appeared below the submit button on the homepage report submission form.
- Single-line deletion in `components/Hero.tsx` — no logic or flag changes.

## Test plan
- [ ] `npm run type-check` passes
- [ ] `npm run test:ci` passes
- [ ] Verify Vercel Preview: homepage form shows "Takes 60 seconds • Instant results" with no pricing text
- [ ] Pricing page unaffected

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL printed to terminal.
