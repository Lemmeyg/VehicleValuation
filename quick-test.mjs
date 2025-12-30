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

console.log('Checking articles...');
const { data, error } = await supabase
  .from('articles')
  .select('*');

if (error) {
  console.error('Error:', error);
} else {
  const count = data ? data.length : 0;
  console.log(`Found ${count} articles`);
  if (data) {
    data.forEach(a => console.log(`- ${a.title} (${a.slug}, published: ${a.published})`));
  }
}
