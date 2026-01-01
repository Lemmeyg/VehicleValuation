# Fix: Netlify Not Showing All Branches

## Problem
Netlify only shows `master` branch when trying to connect to GitHub, but `main`, `staging`, and `dev` branches exist.

## ✅ Verified
All three branches exist on GitHub:
- ✅ `main` - exists at https://github.com/Lemmeyg/VehicleValuation/tree/main
- ✅ `staging` - exists at https://github.com/Lemmeyg/VehicleValuation/tree/staging
- ✅ `dev` - exists at https://github.com/Lemmeyg/VehicleValuation/tree/dev

---

## Solution Options

### Option 1: Disconnect and Reconnect GitHub (Recommended)

1. **Disconnect GitHub** (if already connected):
   - Go to: https://app.netlify.com/sites/vehicle-valuation-production/configuration/deploys
   - Scroll to "Build settings"
   - Click "Link to a different repository" or "Disconnect repository"

2. **Reconnect to GitHub**:
   - Click "Link site to Git"
   - Choose GitHub
   - **IMPORTANT**: Make sure you select the correct repository:
     - ✅ **Lemmeyg/VehicleValuation** (correct)
     - ❌ Lemmeyg/SnapPrompt (wrong - different project)

3. **Select the branch**:
   - Production site: Select `main` branch
   - Staging site: Select `staging` branch
   - Dev site: Select `dev` branch

4. **Configure build settings**:
   ```
   Build command: npm run build
   Publish directory: .next
   ```

### Option 2: Manual Branch Configuration

If GitHub is already connected but showing wrong branches:

1. **Check Repository Connection**:
   - Go to: https://app.netlify.com/sites/vehicle-valuation-production/configuration/deploys
   - Under "Production branch", verify it shows: `Lemmeyg/VehicleValuation`
   - If it shows `Lemmeyg/SnapPrompt`, you connected the wrong repo!

2. **Change Production Branch**:
   - Find "Production branch" dropdown
   - Click to refresh branch list
   - Select the appropriate branch (`main`, `staging`, or `dev`)

3. **Force Refresh**:
   - Sometimes Netlify caches the branch list
   - Try disconnecting and reconnecting the repository

### Option 3: Use Netlify CLI to Link Sites

You can also link each site to the correct branch using the CLI:

```bash
# For Production Site
cd vehicle-valuation-saas
netlify link --name vehicle-valuation-production
netlify env:set PRODUCTION_BRANCH main

# For Staging Site
netlify link --name vehicle-valuation-staging
netlify env:set PRODUCTION_BRANCH staging

# For Dev Site
netlify link --name vehicle-valuation-dev
netlify env:set PRODUCTION_BRANCH dev
```

---

## Troubleshooting

### If you still don't see the branches:

**Check 1: Verify you're looking at the right repository**
```bash
# Run this in your local project
cd vehicle-valuation-saas
git remote -v
```

Should show:
```
origin  https://github.com/Lemmeyg/VehicleValuation.git (fetch)
origin  https://github.com/Lemmeyg/VehicleValuation.git (push)
```

**NOT**:
```
origin  https://github.com/Lemmeyg/SnapPrompt.git ❌
```

**Check 2: Verify branches exist on GitHub**

Visit these URLs directly:
- https://github.com/Lemmeyg/VehicleValuation/tree/main
- https://github.com/Lemmeyg/VehicleValuation/tree/staging
- https://github.com/Lemmeyg/VehicleValuation/tree/dev

**Check 3: Refresh GitHub Connection**

Sometimes Netlify needs to re-authorize:
1. Go to: https://app.netlify.com/user/applications
2. Find GitHub connection
3. Click "Revoke" then reconnect
4. Try connecting the site again

**Check 4: Default Branch Setting**

GitHub might have `master` set as default:
1. Go to: https://github.com/Lemmeyg/VehicleValuation/settings/branches
2. Change default branch to `main`
3. This helps Netlify recognize the correct main branch

---

## Quick Fix Script

Run this to verify everything is correct:

```bash
cd vehicle-valuation-saas

echo "📍 Current repository:"
git remote -v

echo ""
echo "📍 Branches on GitHub:"
git ls-remote --heads origin

echo ""
echo "📍 Local branches:"
git branch -a
```

---

## What's Happening

The most common cause is:

1. **Wrong Repository**: You might have connected Netlify to `SnapPrompt` instead of `VehicleValuation`
2. **Cached Branch List**: Netlify is showing an old cached list
3. **Default Branch Confusion**: GitHub has `master` as default, but your branches are `main`, `staging`, `dev`

**Solution**: Disconnect and reconnect to the **correct repository** (VehicleValuation, not SnapPrompt).

---

## Need More Help?

If none of these work:

1. Check Netlify's site settings show correct repository
2. Verify GitHub permissions for Netlify app
3. Try creating a test deployment manually to force branch detection
4. Contact Netlify support with your site ID

---

**Repository**: https://github.com/Lemmeyg/VehicleValuation
**Branches**: `main`, `staging`, `dev` ✅ All exist
