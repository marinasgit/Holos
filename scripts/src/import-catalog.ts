// Import every Pokémon TCG set and card from TCGdex into Supabase.
//
//   npm run import-catalog                    # all sets (about 220 requests)
//   npm run import-catalog -- --set sv03.5    # one or more sets
//   npm run import-catalog -- --dry-run       # fetch only, print counts, no database
//
// Safe to re-run: rows are upserted, and card details/prices written by the
// snapshot job are left untouched.

import { createServiceClient, flagValues, hasFlag, upsertInBatches } from './supabase.js';
import { getSet, getSets, mapLimit, TCGDEX_CONCURRENCY } from './tcgdex.js';
import { toCardRow, toSetRow, type CardRow } from './transform.js';

async function main() {
  const dryRun = hasFlag('dry-run');
  const only = new Set(flagValues('set'));
  const db = dryRun ? null : createServiceClient();

  const briefs = (await getSets()).filter((s) => only.size === 0 || only.has(s.id));
  if (only.size > 0 && briefs.length === 0) throw new Error(`No TCGdex sets match: ${[...only].join(', ')}`);
  console.log(`Importing ${briefs.length} set(s) from TCGdex${dryRun ? ' (dry run)' : ''}...`);

  let cardTotal = 0;
  const failures: string[] = [];

  await mapLimit(briefs, TCGDEX_CONCURRENCY, async (brief, i) => {
    try {
      const set = await getSet(brief.id);
      const setRow = toSetRow(set);
      // De-duplicate: upserting the same id twice in one statement is an error.
      const cards = new Map<string, CardRow>();
      for (const card of set.cards ?? []) cards.set(card.id, toCardRow(card, set.id));

      if (db) {
        await upsertInBatches(db, 'sets', [setRow], 'id');
        await upsertInBatches(db, 'cards', [...cards.values()], 'id');
      }
      cardTotal += cards.size;
      console.log(
        `[${i + 1}/${briefs.length}] ${set.id.padEnd(12)} ${set.name} — ${cards.size} cards` +
          (setRow.release_date ? ` (${setRow.release_date})` : ''),
      );
    } catch (err) {
      failures.push(brief.id);
      console.error(`[${i + 1}/${briefs.length}] ${brief.id} failed: ${(err as Error).message}`);
    }
  });

  console.log(`Done: ${briefs.length - failures.length} sets, ${cardTotal} cards.`);
  if (failures.length > 0) {
    console.error(`Failed sets (re-run with --set ${failures.join(',')}).`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
