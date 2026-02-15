// Database Setup Script - Creates required tables in Supabase
// Run: node setup-db.js

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zrhussirvsgsoffmrkxb.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_MERSBCkwCzs880gVcz_J7Q_urxy9azM';

async function setup() {
    console.log('🔧 QuantSignal Database Setup');
    console.log('Supabase URL:', SUPABASE_URL);

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Test connection
    console.log('\n📡 Testing connection...');
    const { data: testData, error: testError } = await supabase
        .from('candles')
        .select('*')
        .limit(1);

    if (testError) {
        if (testError.message.includes('does not exist') || testError.code === '42P01') {
            console.log('⚠️  Table "candles" does not exist yet.');
            console.log('\n📋 Please run the following SQL in your Supabase Dashboard → SQL Editor:\n');
            console.log('='.repeat(70));
            console.log(getCreateTableSQL());
            console.log('='.repeat(70));
            console.log('\n🔗 Dashboard URL: https://supabase.com/dashboard/project/zrhussirvsgsoffmrkxb/sql');
            console.log('\nAfter creating the table, run: node server.js');
        } else {
            console.error('❌ Connection error:', testError.message);
            console.log('\nError details:', testError);
        }
    } else {
        console.log('✅ Table "candles" exists! Connection successful.');
        console.log(`   Found ${testData.length} rows (sampled).`);
        console.log('\n🚀 Ready to start: node server.js');
    }
}

function getCreateTableSQL() {
    return `
-- QuantSignal Database Schema
-- Run this in Supabase SQL Editor

-- Create candles table for historical OHLCV data
CREATE TABLE IF NOT EXISTS candles (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  symbol text NOT NULL,
  timeframe text NOT NULL DEFAULT '4h',
  open_time bigint NOT NULL,
  open double precision NOT NULL,
  high double precision NOT NULL,
  low double precision NOT NULL,
  close double precision NOT NULL,
  volume double precision NOT NULL DEFAULT 0,
  close_time bigint,
  created_at timestamptz DEFAULT now()
);

-- Unique constraint for upsert support
ALTER TABLE candles ADD CONSTRAINT candles_unique_key 
  UNIQUE (symbol, timeframe, open_time);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_candles_symbol_time 
  ON candles (symbol, timeframe, open_time);

CREATE INDEX IF NOT EXISTS idx_candles_open_time 
  ON candles (open_time);

-- Enable Row Level Security (optional for public access)
ALTER TABLE candles ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read/write for development
CREATE POLICY "Allow anonymous select" ON candles 
  FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anonymous insert" ON candles 
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anonymous update" ON candles 
  FOR UPDATE TO anon USING (true);

-- Verify
SELECT 'candles table created successfully!' AS result;
  `.trim();
}

setup().catch(console.error);
