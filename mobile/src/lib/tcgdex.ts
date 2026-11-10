// Live prices straight from TCGdex, so a card shows a price even before the nightly
// job has started tracking it. Mirrors extractPriceRows in scripts/src/transform.ts.

import type { PricePoint } from '@/lib/types';

const BASE = 'https://api.tcgdex.net/v2/en';

type Num = number | null | undefined;

interface TcgdexPricing {
  tcgplayer?: Record<string, unknown> & { unit?: string };
  cardmarket?: Record<string, unknown> & { unit?: string };
}

const price = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null;

export async function fetchLivePrices(cardId: string): Promise<PricePoint[]> {
  const res = await fetch(`${BASE}/cards/${encodeURIComponent(cardId)}`);
  if (!res.ok) throw new Error(`TCGdex ${res.status}`);
  const card = (await res.json()) as { pricing?: TcgdexPricing | null };
  const today = new Date().toISOString().slice(0, 10);
  const rows: PricePoint[] = [];

  const tcg = card.pricing?.tcgplayer;
  if (tcg) {
    for (const [variant, value] of Object.entries(tcg)) {
      if (variant === 'unit' || variant === 'updated' || !value || typeof value !== 'object') continue;
      const p = value as Record<string, Num>;
      const row: PricePoint = {
        card_id: cardId,
        source: 'tcgplayer',
        variant,
        currency: tcg.unit ?? 'USD',
        market: price(p.marketPrice),
        low: price(p.lowPrice),
        mid: price(p.midPrice),
        high: price(p.highPrice),
        recorded_on: today,
      };
      if (row.market ?? row.low ?? row.mid ?? row.high) rows.push(row);
    }
  }

  const cm = card.pricing?.cardmarket;
  if (cm) {
    const base = { card_id: cardId, source: 'cardmarket' as const, currency: cm.unit ?? 'EUR', high: null, recorded_on: today };
    const standard: PricePoint = {
      ...base,
      variant: 'default',
      market: price(cm.trend) ?? price(cm.avg),
      low: price(cm.low),
      mid: price(cm.avg),
    };
    const foil: PricePoint = {
      ...base,
      variant: 'foil',
      market: price(cm['trend-holo']) ?? price(cm['avg-holo']),
      low: price(cm['low-holo']),
      mid: price(cm['avg-holo']),
    };
    for (const row of [standard, foil]) if (row.market ?? row.low ?? row.mid) rows.push(row);
  }
  return rows;
}
