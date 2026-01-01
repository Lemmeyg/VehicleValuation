#!/bin/bash

# Script to configure GitHub integration for all three Netlify sites
# Run this after creating the sites

echo "🔗 Configuring GitHub integration for Vehicle Valuation sites..."
echo ""

# Site IDs (get from netlify api listSites)
PROD_SITE_ID="b56736b3-2956-4382-a617-44209872e608"
STAGING_SITE_ID="6029676b-4bbc-42e0-a4fb-194dca1fef56"
DEV_SITE_ID="51bc07e7-fd0a-402b-a777-73b46c305957"

# GitHub repo details
REPO_URL="https://github.com/Lemmeyg/VehicleValuation"

echo "📍 Production Site Configuration"
echo "   Site: vehicle-valuation-production"
echo "   Branch: main"
echo "   URL: https://app.netlify.com/sites/vehicle-valuation-production/configuration/deploys"
echo ""

echo "📍 Staging Site Configuration"
echo "   Site: vehicle-valuation-staging"
echo "   Branch: staging"
echo "   URL: https://app.netlify.com/sites/vehicle-valuation-staging/configuration/deploys"
echo ""

echo "📍 Development Site Configuration"
echo "   Site: vehicle-valuation-dev"
echo "   Branch: dev"
echo "   URL: https://app.netlify.com/sites/vehicle-valuation-dev/configuration/deploys"
echo ""

echo "⚙️  Manual Configuration Steps:"
echo ""
echo "For each site above, visit the URL and:"
echo "1. Click 'Link site to Git' or 'Connect to Git repository'"
echo "2. Choose 'GitHub'"
echo "3. Select repository: Lemmeyg/VehicleValuation"
echo "4. Configure build settings:"
echo "   - Production branch: main (for production site)"
echo "   - Branch: staging (for staging site)"
echo "   - Branch: dev (for dev site)"
echo "   - Build command: npm run build"
echo "   - Publish directory: .next"
echo "5. Add environment variables (see DEPLOYMENT.md)"
echo ""

echo "✅ Site URLs:"
echo "   Production: https://vehicle-valuation-production.netlify.app"
echo "   Staging: https://vehicle-valuation-staging.netlify.app"
echo "   Development: https://vehicle-valuation-dev.netlify.app"
echo ""

echo "📖 Next: Configure environment variables for each site"
echo "   See DEPLOYMENT.md section: Environment Variables"
