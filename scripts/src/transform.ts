// Pure functions that turn TCGdex responses into rows for our database.

import type { TcgdexCard, TcgdexCardBrief, TcgdexSet, TcgplayerVariantPrice } from './tcgdex.js';

export interface SetRow {
  id: string;
  name: string;
  series_id: string | null;
  series_name: string | null;
  release_date: string | null;
  official_count: number | null;
  total_count: number | null;
  logo_url: string | null;
  symbol_url: string | null;
  updated_at: string;
}

export interface CardRow {
  id: string;
  set_id: string;
  local_id: string;
  name: string;
  image_url: string | null;
  updated_at: string;
}

export interface CardDetailsRow extends CardRow {
  rarity: string | null;
  category: string | null;
  hp: number | null;
  types: string[] | null;
  illustrator: string | null;
  variants: string[] | null;
  details_synced_at: string;
}

export interface PriceRow {
  card_id: string;
  source: 'tcgplayer' | 'cardmarket';
  variant: string;
  currency: string;
  market: number | null;
  low: number | null;
  mid: number | null;
  high: number | null;
  recorded_on: string;
}

const now = () => new Date().toISOString();

export function toSetRow(set: TcgdexSet): SetRow {
  return {
    id: set.id,
    name: set.name,
    series_id: set.serie?.id ?? null,
    series_name: set.serie?.name ?? null,
    release_date: set.releaseDate ?? null,
    official_count: set.cardCount?.official ?? null,
    total_count: set.cardCount?.total ?? null,
    logo_url: set.logo ?? null,
    symbol_url: set.symbol ?? null,
    updated_at: now(),
  };
}

export function toCardRow(card: TcgdexCardBrief, setId: string): CardRow {
  return {
    id: card.id,
    set_id: setId,
    local_id: card.localId,
    name: card.name,
    image_url: card.image ?? null,
    updated_at: now(),
  };
}

export function toCardDetailsRow(card: TcgdexCard): CardDetailsRow {
  const variants = card.variants
    ? Object.entries(card.variants)
        .filter(([, has]) => has)
        .map(([name]) => name)
    : null;
  return {
    ...toCardRow(card, card.set.id),
    rarity: card.rarity ?? null,
    category: card.category ?? null,
    hp: typeof card.hp === 'number' ? card.hp : null,
    types: card.types ?? null,
    illustrator: card.illustrator ?? null,
    variants,
    details_synced_at: now(),
  };
}

/** A price of 0 or a missing value means "no data", not "free". */
function price(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.round(value * 100) / 100
    : null;
}

/**
 * Flatten a card's `pricing` block into one row per source + variant.
 *
 * TCGplayer (USD) reports each printing separately: normal, holofoil, reverse-holofoil,
 * 1stEditionHolofoil, ... Cardmarket (EUR) reports a default price and a "-holo" (foil) price.
 */
export function extractPriceRows(card: TcgdexCard, recordedOn: string): PriceRow[] {
  const rows: PriceRow[] = [];
  const tcgplayer = card.pricing?.tcgplayer;
  if (tcgplayer) {
    for (const [variant, value] of Object.entries(tcgplayer)) {
      if (variant === 'unit' || variant === 'updated' || !value || typeof value !== 'object') continue;
      const p = value as TcgplayerVariantPrice;
      const row: PriceRow = {
        card_id: card.id,
        source: 'tcgplayer',
        variant,
        currency: tcgplayer.unit ?? 'USD',
        market: price(p.marketPrice),
        low: price(p.lowPrice),
        mid: price(p.midPrice),
        high: price(p.highPrice),
        recorded_on: recordedOn,
      };
      if (row.market ?? row.low ?? row.mid ?? row.high) rows.push(row);
    }
  }

  const cardmarket = card.pricing?.cardmarket;
  if (cardmarket) {
    const currency = cardmarket.unit ?? 'EUR';
    const standard: PriceRow = {
      card_id: card.id,
      source: 'cardmarket',
      variant: 'default',
      currency,
      market: price(cardmarket.trend) ?? price(cardmarket.avg),
      low: price(cardmarket.low),
      mid: price(cardmarket.avg),
      high: null,
      recorded_on: recordedOn,
    };
    if (standard.market ?? standard.low ?? standard.mid) rows.push(standard);

    const foil: PriceRow = {
      ...standard,
      variant: 'foil',
      market: price(cardmarket['trend-holo']) ?? price(cardmarket['avg-holo']),
      low: price(cardmarket['low-holo']),
      mid: price(cardmarket['avg-holo']),
    };
    if (foil.market ?? foil.low ?? foil.mid) rows.push(foil);
  }
  return rows;
}

/** Today's date in UTC as YYYY-MM-DD. */
export function todayUtc(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
