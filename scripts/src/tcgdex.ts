// Minimal client for the free TCGdex API (https://tcgdex.dev). No API key needed.

export const TCGDEX_BASE_URL = process.env.TCGDEX_BASE_URL ?? 'https://api.tcgdex.net/v2/en';
export const TCGDEX_CONCURRENCY = Number(process.env.TCGDEX_CONCURRENCY ?? 4);

export interface CardCount {
  official?: number;
  total?: number;
}

export interface TcgdexSetBrief {
  id: string;
  name: string;
  logo?: string;
  symbol?: string;
  cardCount?: CardCount;
}

export interface TcgdexCardBrief {
  id: string;
  localId: string;
  name: string;
  image?: string;
}

export interface TcgdexSet extends TcgdexSetBrief {
  releaseDate?: string;
  serie?: { id: string; name: string };
  cards: TcgdexCardBrief[];
}

export interface TcgplayerVariantPrice {
  productId?: number;
  lowPrice?: number | null;
  midPrice?: number | null;
  highPrice?: number | null;
  marketPrice?: number | null;
  directLowPrice?: number | null;
}

export interface TcgdexPricing {
  tcgplayer?: {
    unit?: string;
    updated?: string;
    [variant: string]: TcgplayerVariantPrice | string | undefined;
  } | null;
  cardmarket?: {
    unit?: string;
    updated?: string;
    avg?: number | null;
    low?: number | null;
    trend?: number | null;
    'avg-holo'?: number | null;
    'low-holo'?: number | null;
    'trend-holo'?: number | null;
    [key: string]: number | string | null | undefined;
  } | null;
}

export interface TcgdexCard extends TcgdexCardBrief {
  category?: string;
  rarity?: string;
  hp?: number;
  types?: string[];
  illustrator?: string;
  set: { id: string; name: string; cardCount?: CardCount };
  variants?: Record<string, boolean>;
  pricing?: TcgdexPricing | null;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** GET a TCGdex path, retrying on rate limits, server errors and network failures. */
export async function tcgdexGet<T>(path: string, attempts = 4): Promise<T> {
  const url = `${TCGDEX_BASE_URL}${path}`;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'holos-scripts/1.0' },
        signal: AbortSignal.timeout(30_000),
      });
      if (res.ok) return (await res.json()) as T;
      if (res.status === 404) throw new NotFoundError(url);
      if (res.status !== 429 && res.status < 500) {
        throw new Error(`TCGdex ${res.status} for ${url}`);
      }
      lastError = new Error(`TCGdex ${res.status} for ${url}`);
    } catch (err) {
      if (err instanceof NotFoundError) throw err;
      lastError = err;
    }
    if (attempt < attempts) await sleep(1000 * 2 ** (attempt - 1));
  }
  throw lastError;
}

export class NotFoundError extends Error {
  constructor(url: string) {
    super(`Not found: ${url}`);
  }
}

export const getSets = () => tcgdexGet<TcgdexSetBrief[]>('/sets');
export const getSet = (id: string) => tcgdexGet<TcgdexSet>(`/sets/${encodeURIComponent(id)}`);
export const getCard = (id: string) => tcgdexGet<TcgdexCard>(`/cards/${encodeURIComponent(id)}`);

/** Run `fn` over `items` with at most `limit` in flight at once (keeps us polite to TCGdex). */
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}
