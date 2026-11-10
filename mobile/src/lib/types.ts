// Shapes of the rows returned by Supabase (see supabase/migrations).

export interface SetInfo {
  id: string;
  name: string;
  series_name: string | null;
  release_date: string | null;
  official_count: number | null;
  total_count: number | null;
  logo_url: string | null;
  symbol_url: string | null;
}

export interface Card {
  id: string;
  set_id: string;
  local_id: string;
  name: string;
  image_url: string | null;
  rarity: string | null;
  category: string | null;
  hp: number | null;
  types: string[] | null;
  illustrator: string | null;
  variants: string[] | null;
  set: SetInfo | null;
}

export interface CardSearchResult {
  id: string;
  name: string;
  local_id: string;
  set_id: string;
  set_name: string;
  official_count: number | null;
  release_date: string | null;
  image_url: string | null;
  rarity: string | null;
  market_price: number | null;
}

export type PriceSource = 'tcgplayer' | 'cardmarket';

export interface PricePoint {
  card_id: string;
  source: PriceSource;
  variant: string;
  currency: string;
  market: number | null;
  low: number | null;
  mid: number | null;
  high: number | null;
  recorded_on: string;
}

export const CONDITIONS = ['NM', 'LP', 'MP', 'HP', 'DMG'] as const;
export type Condition = (typeof CONDITIONS)[number];

export interface CollectionItem {
  id: string;
  user_id: string;
  card_id: string;
  variant: string;
  condition: Condition;
  quantity: number;
  purchase_price: number | null;
  notes: string | null;
  created_at: string;
  // Joined in the collection_with_prices view:
  name: string;
  local_id: string;
  set_id: string;
  set_name: string;
  official_count: number | null;
  image_url: string | null;
  unit_price: number | null;
  total_price: number | null;
}

export interface CollectionValuePoint {
  recorded_on: string;
  total_value: number;
  card_count: number;
}
