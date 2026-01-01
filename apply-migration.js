const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://noijdbkcwcivewzwznru.supabase.co';
const supabaseServiceKey = 'Nk0DKEZzdbTLJXBr';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('Applying MarketCheck migration...\n');

  try {
    // Add columns
    const { error: alterError } = await supabase.rpc('exec_sql', {
      query: `
        ALTER TABLE reports
          ADD COLUMN IF NOT EXISTS mileage INTEGER,
          ADD COLUMN IF NOT EXISTS zip_code VARCHAR(10),
          ADD COLUMN IF NOT EXISTS dealer_type VARCHAR(20),
          ADD COLUMN IF NOT EXISTS marketcheck_valuation JSONB;
      `
    });

    if (alterError) {
      console.error('Error adding columns:', alterError);
      process.exit(1);
    }

    console.log('✓ Columns added successfully');

    // Add indexes
    const { error: indexError } = await supabase.rpc('exec_sql', {
      query: `
        CREATE INDEX IF NOT EXISTS idx_reports_zip_code ON reports(zip_code);
        CREATE INDEX IF NOT EXISTS idx_reports_dealer_type ON reports(dealer_type);
      `
    });

    if (indexError) {
      console.error('Error adding indexes:', indexError);
      process.exit(1);
    }

    console.log('✓ Indexes added successfully');
    console.log('\nMigration completed! ✓\n');
  } catch (error) {
    console.error('Unexpected error:', error);
    process.exit(1);
  }
}

applyMigration();
