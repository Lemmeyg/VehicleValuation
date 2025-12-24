import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

console.log('🔍 Checking suppliers in database...\n');

const { data: suppliers, error } = await supabase
  .from('suppliers')
  .select('*')
  .order('created_at', { ascending: false });

if (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}

const count = suppliers ? suppliers.length : 0;
console.log(`✅ Found ${count} suppliers\n`);

if (suppliers && suppliers.length > 0) {
  suppliers.forEach(s => {
    console.log(`📍 ${s.business_name}`);
    console.log(`   Slug: ${s.slug}`);
    console.log(`   Type: ${s.service_type}`);
    console.log(`   Location: ${s.city}, ${s.state}`);
    console.log(`   Published: ${s.published}`);
    console.log(`   URL: http://localhost:3000/directory/${s.slug}`);
    console.log('');
  });
}
