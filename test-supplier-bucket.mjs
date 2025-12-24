import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env.local') });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Checking supplier-content bucket...\n');

// Check if bucket exists
const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();

if (listError) {
  console.error('❌ Error listing buckets:', listError);
  process.exit(1);
}

console.log('📦 Existing buckets:', buckets.map(b => b.name).join(', '));

const supplierBucket = buckets.find(b => b.name === 'supplier-content');

if (!supplierBucket) {
  console.log('\n⚠️  supplier-content bucket does not exist');
  console.log('🔨 Creating supplier-content bucket...');

  const { data: newBucket, error: createError } = await supabaseAdmin.storage.createBucket(
    'supplier-content',
    {
      public: true,
      fileSizeLimit: 5242880, // 5MB
      allowedMimeTypes: ['text/markdown', 'text/plain']
    }
  );

  if (createError) {
    console.error('❌ Error creating bucket:', createError);
    process.exit(1);
  }

  console.log('✅ Bucket created successfully!');
} else {
  console.log('\n✅ supplier-content bucket already exists');
}

console.log('\n🧪 Testing bucket access...');

// Test upload
const testContent = '---\nbusinessName: Test Business\nslug: test\nserviceType: appraiser\ncity: Test City\nstate: CA\nemail: test@example.com\n---\n\nTest content';
const testPath = 'suppliers/appraisers/test.md';

const { error: uploadError } = await supabaseAdmin.storage
  .from('supplier-content')
  .upload(testPath, testContent, {
    contentType: 'text/markdown',
    upsert: true
  });

if (uploadError) {
  console.error('❌ Test upload failed:', uploadError);
  process.exit(1);
}

console.log('✅ Test file uploaded successfully');

// Clean up test file
await supabaseAdmin.storage
  .from('supplier-content')
  .remove([testPath]);

console.log('✅ Test file cleaned up');
console.log('\n🎉 Bucket is ready for use!');
