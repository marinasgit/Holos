import { existsSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Load scripts/.env when present (GitHub Actions passes real env vars instead).
if (existsSync('.env')) process.loadEnvFile('.env');

/** Supabase client using the service role key, which bypasses row level security. */
export function createServiceClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (copy scripts/.env.example to scripts/.env), ' +
        'or pass --dry-run to test without a database.',
    );
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Upsert rows in batches so large imports stay under request size limits. */
export async function upsertInBatches(
  db: SupabaseClient,
  table: string,
  rows: readonly object[],
  onConflict: string,
  batchSize = 500,
): Promise<void> {
  for (let i = 0; i < rows.length; i += batchSize) {
    const { error } = await db
      .from(table)
      .upsert(rows.slice(i, i + batchSize), { onConflict });
    if (error) throw new Error(`Upsert into ${table} failed: ${error.message}`);
  }
}

export function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

/** Values for a repeatable flag: `--set a --set b` or `--set a,b`. */
export function flagValues(name: string): string[] {
  const values: string[] = [];
  process.argv.forEach((arg, i) => {
    if (arg === `--${name}` && process.argv[i + 1]) values.push(...process.argv[i + 1].split(','));
    else if (arg.startsWith(`--${name}=`)) values.push(...arg.slice(name.length + 3).split(','));
  });
  return values.map((v) => v.trim()).filter(Boolean);
}
