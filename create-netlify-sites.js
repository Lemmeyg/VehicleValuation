#!/usr/bin/env node

/**
 * Script to create three Netlify sites for dev/staging/production
 * Uses Netlify CLI programmatically
 */

const { execSync } = require('child_process');

const sites = [
  {
    name: 'vehicle-valuation-production',
    branch: 'main',
    env: 'production'
  },
  {
    name: 'vehicle-valuation-staging',
    branch: 'staging',
    env: 'staging'
  },
  {
    name: 'vehicle-valuation-dev',
    branch: 'dev',
    env: 'development'
  }
];

console.log('🚀 Creating Netlify sites for Vehicle Valuation SaaS...\n');

sites.forEach((site, index) => {
  console.log(`\n${index + 1}. Creating ${site.env} site: ${site.name}`);
  console.log(`   Branch: ${site.branch}`);

  try {
    // Switch to the appropriate branch
    console.log(`   → Switching to ${site.branch} branch...`);
    execSync(`git checkout ${site.branch}`, { stdio: 'inherit' });

    // Initialize Netlify site
    console.log(`   → Creating Netlify site...`);
    const command = `netlify sites:create --name ${site.name} --manual`;
    execSync(command, { stdio: 'inherit' });

    // Link the site
    console.log(`   → Linking site to directory...`);
    execSync(`netlify link --name ${site.name}`, { stdio: 'inherit' });

    console.log(`   ✅ ${site.name} created successfully!`);

  } catch (error) {
    console.error(`   ❌ Error creating ${site.name}:`, error.message);
  }
});

console.log('\n✨ All sites created! Next steps:');
console.log('1. Configure environment variables for each site');
console.log('2. Set up continuous deployment from GitHub');
console.log('3. Configure build settings (npm run build, .next)');
