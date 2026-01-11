# Netlify Build Credits Optimization Guide

## Current Setup
- **3 environments**: Production (main), Staging (staging), Dev (dev)
- **Auto-deploys**: Currently enabled for all branches
- **Problem**: High build credit consumption

---

## ✅ Changes Already Applied

### 1. Build Ignore Rules Added
The `netlify.toml` now skips builds when only these files change:
- Documentation (`*.md`, `*.txt`, `docs/`, `Resources/`)
- GitHub workflows (`.github/`)
- Test files (`*.test.*`, `*.spec.*`)
- Test configs (`playwright.config.*`, `jest.config.*`)

**Expected savings**: 10-20% reduction

---

## 🎯 Recommended Actions (Choose Your Strategy)

### **Strategy 1: Disable Auto-Deploy for Dev** ⭐ RECOMMENDED
**Savings: 50-70%** (if dev is your most active branch)

#### Steps:
1. Go to Netlify Dashboard → Your Site → Site Settings
2. Navigate to **Build & Deploy** → **Continuous Deployment**
3. Scroll to **Branch deploys** section
4. Click **Configure** next to "Deploy only these branches"
5. **Only enable**: `staging` and `main`
6. Save changes

#### When you need dev deploys:
```bash
# Option A: Manual trigger in Netlify UI
# Go to Deploys → Trigger deploy → Deploy site

# Option B: Push to staging instead
git checkout staging
git merge dev
git push origin staging

# Option C: Use Netlify CLI
netlify deploy --prod  # For production
netlify deploy         # For preview
```

---

### **Strategy 2: Deploy Only on Pull Requests**
**Savings: 40-60%**

This prevents builds on every intermediate commit during development.

#### Steps:
1. In Netlify Dashboard → Site Settings → Build & Deploy
2. Under **Deploy contexts**, disable:
   - ❌ Branch deploys
   - ✅ Production branch only (main)
3. Enable **Deploy previews** for pull requests
4. Set **Deploy only pull requests for these branches**: `staging, dev`

#### Workflow:
```bash
# Work on dev branch normally
git checkout dev
git commit -m "WIP: feature development"
git push  # ← No build triggered

# When ready to test, create a PR
# Netlify builds a preview automatically
# Review → Merge → Auto-deploy to staging
```

---

### **Strategy 3: Scheduled Deploys (Advanced)**
**Savings: 60-80%** for low-urgency projects

Deploy only at specific times (e.g., daily at 9am).

#### Setup:
1. Disable all auto-deploys except production
2. Use GitHub Actions to trigger deploys:

Create `.github/workflows/netlify-scheduled.yml`:
```yaml
name: Scheduled Netlify Deploy
on:
  schedule:
    - cron: '0 9 * * *'  # 9am UTC daily
  workflow_dispatch:  # Manual trigger option

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Netlify Deploy
        run: |
          curl -X POST -d {} https://api.netlify.com/build_hooks/${{ secrets.NETLIFY_BUILD_HOOK }}
```

3. Get build hook URL from Netlify:
   - Settings → Build & Deploy → Build Hooks → Add build hook
   - Add to GitHub Secrets as `NETLIFY_BUILD_HOOK`

---

### **Strategy 4: Local Development + Manual Deploy**
**Savings: 70-90%** (most aggressive)

Use `netlify dev` for local testing, only deploy for staging/production.

#### Setup:
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Link to your site
netlify link

# Run locally (mimics Netlify environment)
netlify dev

# When ready to deploy
netlify deploy --prod  # Production
netlify deploy         # Draft/preview
```

#### Disable auto-deploys:
- Only enable production branch (main)
- Disable staging and dev auto-deploys
- Use CLI for manual deploys

---

## 📊 Comparison Table

| Strategy | Savings | Dev Experience | Setup Effort |
|----------|---------|----------------|--------------|
| Ignore rules only | 10-20% | No change | ✅ Done |
| Disable dev auto-deploy | 50-70% | Manual triggers | Easy (5 min) |
| PR-based deploys | 40-60% | Requires PRs | Medium (10 min) |
| Scheduled deploys | 60-80% | Delayed feedback | Advanced (30 min) |
| Manual CLI deploys | 70-90% | More control needed | Medium (15 min) |

---

## 🔧 Additional Optimizations

### 5. Enable Build Plugins Caching
Already enabled with `@netlify/plugin-nextjs`, but verify:
```toml
# In netlify.toml (already present)
[[plugins]]
  package = "@netlify/plugin-nextjs"
```

### 6. Reduce Build Frequency During Development

Create a `.netlify-ignore.txt` in your repo root:
```bash
#!/bin/bash

# Exit 0 to build, exit 1 to skip build

# Skip if commit message contains [skip-deploy]
if git log -1 --pretty=%B | grep -q "\[skip-deploy\]"; then
  echo "Skipping deploy - [skip-deploy] in commit message"
  exit 1
fi

# Skip if only specific paths changed
if git diff --quiet $CACHED_COMMIT_REF $COMMIT_REF -- '*.md' 'docs/' 'Resources/'; then
  echo "Only docs changed, skipping build"
  exit 1
fi

exit 0
```

Then commit with `[skip-deploy]` to skip:
```bash
git commit -m "docs: update README [skip-deploy]"
```

### 7. Monitor Your Build Usage

Check current usage:
1. Netlify Dashboard → Your Site → Team Settings → Billing
2. Review "Build Minutes" usage
3. Set up usage alerts

---

## 💰 Netlify Pricing Reference

**Free Tier:**
- 300 build minutes/month
- ~300 builds @ 1 min each
- ~10 deploys/day across all branches

**Pro Tier ($19/month):**
- 1000 build minutes/month
- Better for active development

**Cost per extra minute:** $7/500 minutes

---

## 🎯 My Recommendation

**For your use case (3 environments, frequent updates):**

1. ✅ **Keep the ignore rules** (already applied)
2. ✅ **Disable auto-deploy for `dev` branch**
   - Saves 50-70% immediately
   - Still have staging + production auto-deploy
   - Manual trigger dev when needed
3. ✅ **Use commit message skips** for docs/minor changes
   - Add `[skip-deploy]` to commit messages
4. ✅ **Optional**: Set up Netlify CLI for quick dev previews locally

**Expected total savings: 60-80% reduction in build credits**

---

## 📝 Implementation Checklist

- [x] Add build ignore rules to `netlify.toml`
- [ ] Go to Netlify Dashboard
- [ ] Disable auto-deploy for `dev` branch
- [ ] Keep auto-deploy for `staging` and `main`
- [ ] Install Netlify CLI: `npm install -g netlify-cli`
- [ ] Test manual deploy: `netlify deploy`
- [ ] Monitor build usage over next week
- [ ] Adjust strategy if needed

---

## 🚀 Quick Commands

```bash
# Check Netlify status
netlify status

# Deploy dev manually
netlify deploy

# Deploy to production
netlify deploy --prod

# View site logs
netlify logs

# Check build usage
netlify api listAccountBuilds
```

---

## ❓ FAQ

**Q: Will this affect my production deploys?**
A: No, production (main) will still auto-deploy on every push.

**Q: How do I test dev changes?**
A: Use `netlify dev` locally or manually trigger a deploy in Netlify UI.

**Q: What if I need urgent dev deploy?**
A: Either:
1. Manual trigger in Netlify UI (30 seconds)
2. Use Netlify CLI: `netlify deploy`
3. Push to staging instead temporarily

**Q: Can I revert these changes?**
A: Yes, just re-enable branch deploys in Netlify UI. The ignore rules can be removed from `netlify.toml`.

---

**Last Updated**: January 2026
**Cost Savings Goal**: 60-80% reduction in build credits
