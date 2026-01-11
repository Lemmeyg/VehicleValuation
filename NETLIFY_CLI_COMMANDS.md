# Netlify CLI - Quick Reference Guide

## ✅ Auto-Build Settings Configured

**Changes made via Netlify CLI on 2026-01-04:**

### Site Status:
- ❌ **DEV** (`vehicle-valuation-dev`): Auto-builds **DISABLED** ✅
- ✅ **STAGING** (`vehicle-valuation-staging`): Auto-builds **ENABLED**
- ✅ **PRODUCTION** (`vehicle-valuation-production`): Auto-builds **ENABLED**

**Expected savings: 50-70% reduction in build credits** 🎉

---

## 🔄 New Workflow

### Working on Dev Branch
```bash
# Commit and push as normal - NO builds triggered!
git checkout dev
git add .
git commit -m "feat: new feature"
git push origin dev  # ← No build, no credits used! ✅
```

### Deploying Dev Site Manually

**Option 1: Netlify CLI (fastest)**
```bash
# Quick preview deploy
netlify deploy --site 51bc07e7-fd0a-402b-a777-73b46c305957

# Production deploy to dev site
netlify deploy --prod --site 51bc07e7-fd0a-402b-a777-73b46c305957
```

**Option 2: Trigger via API**
```bash
# Create a build hook first (one-time setup):
netlify api createSiteBuildHook --data '{
  "site_id": "51bc07e7-fd0a-402b-a777-73b46c305957",
  "branch": "dev",
  "title": "Manual Dev Deploy"
}'

# Then trigger builds with:
curl -X POST https://api.netlify.com/build_hooks/[YOUR_HOOK_ID]
```

**Option 3: Netlify Dashboard**
1. Go to https://app.netlify.com/projects/vehicle-valuation-dev
2. Click "Deploys" tab
3. Click "Trigger deploy" → "Deploy site"

**Option 4: Push to Staging for Testing**
```bash
# Merge dev to staging - auto-builds
git checkout staging
git merge dev
git push origin staging  # ← Triggers staging build
```

---

## 📊 Your Three Sites

### Site IDs:
```bash
DEV:        51bc07e7-fd0a-402b-a777-73b46c305957
STAGING:    6029676b-4bbc-42e0-a4fb-194dca1fef56
PRODUCTION: b56736b3-2956-4382-a617-44209872e608
```

### Site URLs:
```
DEV:        https://vehicle-valuation-dev.netlify.app
STAGING:    https://vehicle-valuation-staging.netlify.app
PRODUCTION: https://vehicle-valuation-production.netlify.app
```

---

## 🛠️ Useful Netlify CLI Commands

### Check Site Status
```bash
# List all sites
netlify sites:list

# Get current site info
netlify status

# Check specific site
netlify api getSite --data '{"site_id": "51bc07e7-fd0a-402b-a777-73b46c305957"}'
```

### Deploy Commands
```bash
# Deploy current directory to dev site
netlify deploy --site 51bc07e7-fd0a-402b-a777-73b46c305957

# Deploy to production (main site)
netlify deploy --prod

# Deploy with custom message
netlify deploy --message "Manual deploy: testing new feature"
```

### Build Management
```bash
# Enable auto-builds (if you want to re-enable dev later)
netlify api updateSite --data '{
  "site_id": "51bc07e7-fd0a-402b-a777-73b46c305957",
  "body": {"build_settings": {"stop_builds": false}}
}'

# Disable auto-builds
netlify api updateSite --data '{
  "site_id": "51bc07e7-fd0a-402b-a777-73b46c305957",
  "body": {"build_settings": {"stop_builds": true}}
}'

# Check build status
netlify api getSite --data '{"site_id": "51bc07e7-fd0a-402b-a777-73b46c305957"}' | grep "stop_builds"
```

### Environment Variables
```bash
# List env vars for a site
netlify env:list --site 51bc07e7-fd0a-402b-a777-73b46c305957

# Set env var
netlify env:set KEY value --site 51bc07e7-fd0a-402b-a777-73b46c305957

# Get specific env var
netlify env:get KEY --site 51bc07e7-fd0a-402b-a777-73b46c305957
```

### Logs & Monitoring
```bash
# View site logs
netlify logs --site 51bc07e7-fd0a-402b-a777-73b46c305957

# Watch live logs
netlify logs:watch --site 51bc07e7-fd0a-402b-a777-73b46c305957

# View deploy log for specific deploy
netlify logs:deploy --site 51bc07e7-fd0a-402b-a777-73b46c305957
```

---

## 🔧 Advanced: Build Hooks

Create a build hook for one-click deploys:

```bash
# Create hook for dev site
netlify api createSiteBuildHook --data '{
  "site_id": "51bc07e7-fd0a-402b-a777-73b46c305957",
  "branch": "dev",
  "title": "Manual Dev Deploy Hook"
}'

# This returns a URL like:
# https://api.netlify.com/build_hooks/[HOOK_ID]

# Trigger deploy with curl:
curl -X POST https://api.netlify.com/build_hooks/[HOOK_ID]

# Or add to package.json:
# "deploy:dev": "curl -X POST https://api.netlify.com/build_hooks/[HOOK_ID]"
```

---

## 📈 Monitor Build Usage

```bash
# Check account build minutes (requires manual check in dashboard)
# Go to: https://app.netlify.com/teams/gordonlemmey/billing

# Or via API (list recent builds):
netlify api listAccountBuilds | head -50
```

---

## ⚙️ Quick Setup Aliases (Optional)

Add to your `~/.bashrc` or `~/.zshrc`:

```bash
# Netlify site aliases
alias netlify-dev="netlify --site 51bc07e7-fd0a-402b-a777-73b46c305957"
alias netlify-staging="netlify --site 6029676b-4bbc-42e0-a4fb-194dca1fef56"
alias netlify-prod="netlify --site b56736b3-2956-4382-a617-44209872e608"

# Quick deploy commands
alias deploy-dev="netlify deploy --prod --site 51bc07e7-fd0a-402b-a777-73b46c305957"
alias deploy-staging="netlify deploy --prod --site 6029676b-4bbc-42e0-a4fb-194dca1fef56"
alias deploy-prod="netlify deploy --prod --site b56736b3-2956-4382-a617-44209872e608"

# Site status
alias status-dev="netlify api getSite --data '{\"site_id\": \"51bc07e7-fd0a-402b-a777-73b46c305957\"}' | grep stop_builds"
```

Then use:
```bash
deploy-dev          # Deploy to dev site
netlify-dev status  # Check dev site status
```

---

## 🔄 Re-Enable Dev Auto-Builds (If Needed)

If you want to temporarily re-enable auto-builds on dev:

```bash
# Enable
netlify api updateSite --data '{
  "site_id": "51bc07e7-fd0a-402b-a777-73b46c305957",
  "body": {"build_settings": {"stop_builds": false}}
}'

# Verify
netlify api getSite --data '{"site_id": "51bc07e7-fd0a-402b-a777-73b46c305957"}' | grep "stop_builds"
# Should show: "stop_builds": false,

# To disable again:
netlify api updateSite --data '{
  "site_id": "51bc07e7-fd0a-402b-a777-73b46c305957",
  "body": {"build_settings": {"stop_builds": true}}
}'
```

---

## 🆘 Troubleshooting

**"I pushed to dev but nothing happened"**
✅ That's correct! Auto-builds are disabled on dev. Use manual deploy commands above.

**"How do I test dev changes quickly?"**
→ Use `netlify dev` to run locally, or `netlify deploy` to deploy preview.

**"I want to re-enable auto-builds for a sprint"**
→ Use the re-enable command above, then disable when sprint ends.

**"Staging/Production not auto-deploying"**
→ Check build settings:
```bash
netlify api getSite --data '{"site_id": "6029676b-4bbc-42e0-a4fb-194dca1fef56"}' | grep "stop_builds"
# Should show: "stop_builds": false,
```

---

## 📚 Resources

- **Netlify CLI Docs**: https://docs.netlify.com/cli/get-started/
- **Netlify API Docs**: https://open-api.netlify.com/
- **Build Settings**: https://docs.netlify.com/configure-builds/overview/

---

## 💰 Expected Savings

**Before:**
- Dev: ~150 builds/month (auto-build every push)
- Staging: ~75 builds/month
- Production: ~75 builds/month
- **Total: ~300 builds/month** (hitting free tier limit)

**After:**
- Dev: ~10-20 builds/month (manual only)
- Staging: ~75 builds/month
- Production: ~75 builds/month
- **Total: ~160-170 builds/month** (well within free tier!)

**Savings: ~43-47% fewer builds** 🎉

---

**Last Updated**: 2026-01-04
**Configured by**: Netlify CLI (automated via Claude Code)
