// Record today's market prices, then each user's collection value.
// Meant to run once a day (see .github/workflows/snapshot-prices.yml).
//
//   npm run snapshot-prices                         # every card that is in someone's collection
//   npm run snapshot-prices -- --set sv03.5         # every card in a set
//   npm run snapshot-prices -- --card sv03.5-006    # specific cards
//   npm run snapshot-prices -- --all                # the whole catalog (~20k requests, slow)
//   npm run snapshot-prices -- --card base1-4 --dry-run   # print rows, no database
//
// Re-running on the same day overwrites that day's rows, so it is safe to retry.

import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient, flagValues, hasFlag, upsertInBatches } from './supabase.js';
import { getCard, getSet, mapLimit, NotFoundError, TCGDEX_CONCURRENCY } from './tcgdex.js';
import {
  extractPriceRows,
  todayUtc,
  toCardDetailsRow,
  type CardDetailsRow,
  type PriceRow,
} from './transform.js';

const FLUSH_EVERY = 100;

/** Read one column of a table, paging past PostgREST's 1000-row response limit. */
async function selectAllIds(
  db: SupabaseClient,
  table: string,
  column: string,
  filter?: { column: string; values: string[] },
): Promise<string[]> {
  const ids = new Set<string>();
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    let query = db.from(table).select(column).order(column).range(from, from + pageSize - 1);
    if (filter) query = query.in(filter.column, filter.values);
    const { data, error } = await query;
    if (error) throw new Error(`Reading ${table}.${column} failed: ${error.message}`);
    const rows = (data ?? []) as unknown as Record<string, string>[];
    for (const row of rows) ids.add(row[column]);
    if (rows.length < pageSize) break;
  }
  return [...ids];
}

async function resolveCardIds(db: SupabaseClient | null): Promise<string[]> {
  const cards = flagValues('card');
  const sets = flagValues('set');
  if (cards.length > 0) return cards;
  if (sets.length > 0) {
    if (db) return selectAllIds(db, 'cards', 'id', { column: 'set_id', values: sets });
    const fetched = await Promise.all(sets.map((id) => getSet(id)));
    return fetched.flatMap((s) => s.cards.map((c) => c.id));
  }
  if (!db) throw new Error('--dry-run needs --card or --set.');
  if (hasFlag('all')) return selectAllIds(db, 'cards', 'id');
  return selectAllIds(db, 'collection_items', 'card_id');
}

async function main() {
  const dryRun = hasFlag('dry-run');
  const db = dryRun ? null : createServiceClient();
  const recordedOn = todayUtc();
  const cardIds = await resolveCardIds(db);
  console.log(`Snapshotting prices for ${cardIds.length} card(s) on ${recordedOn}${dryRun ? ' (dry run)' : ''}...`);

  let pendingCards: CardDetailsRow[] = [];
  let pendingPrices: PriceRow[] = [];
  let priceRowCount = 0;
  let unpriced = 0;
  const failures: string[] = [];
  let flushing = Promise.resolve();

  const flush = () => {
    const cards = pendingCards;
    const prices = pendingPrices;
    pendingCards = [];
    pendingPrices = [];
    // Chain flushes so batches are written one at a time, in order.
    flushing = flushing.then(async () => {
      if (!db) return;
      if (cards.length) await upsertInBatches(db, 'cards', cards, 'id');
      if (prices.length) await upsertInBatches(db, 'price_history', prices, 'card_id,source,variant,recorded_on');
    });
    return flushing;
  };

  await mapLimit(cardIds, TCGDEX_CONCURRENCY, async (id, i) => {
    try {
      const card = await getCard(id);
      const rows = extractPriceRows(card, recordedOn);
      pendingCards.push(toCardDetailsRow(card));
      pendingPrices.push(...rows);
      priceRowCount += rows.length;
      if (rows.length === 0) unpriced++;
      if (dryRun) {
        console.log(`${card.id} ${card.name}`);
        for (const r of rows) {
          console.log(`  ${r.source.padEnd(10)} ${r.variant.padEnd(20)} ${r.currency} market=${r.market} low=${r.low} high=${r.high}`);
        }
      }
    } catch (err) {
      failures.push(id);
      const reason = err instanceof NotFoundError ? 'not found on TCGdex' : (err as Error).message;
      console.error(`${id}: ${reason}`);
    }
    if (pendingCards.length >= FLUSH_EVERY) await flush();
    if ((i + 1) % 500 === 0) console.log(`  ...${i + 1}/${cardIds.length}`);
  });
  await flush();

  console.log(`Saved ${priceRowCount} price rows (${unpriced} card(s) had no price data, ${failures.length} failed).`);

  if (db) {
    const { data, error } = await db.rpc('snapshot_collection_values');
    if (error) throw new Error(`snapshot_collection_values failed: ${error.message}`);
    console.log(`Updated collection value for ${data} user(s).`);
  }
  if (failures.length > 0 && failures.length === cardIds.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
