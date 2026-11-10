import { supabase } from '@/lib/supabase';
import type {
  Card,
  CardSearchResult,
  CollectionItem,
  CollectionValuePoint,
  Condition,
  PricePoint,
} from '@/lib/types';

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

export async function searchCards(params: {
  q?: string | null;
  number?: string | null;
  setTotal?: number | null;
  limit?: number;
}): Promise<CardSearchResult[]> {
  return unwrap(
    await supabase.rpc('search_cards', {
      q: params.q ?? null,
      number: params.number ?? null,
      set_total: params.setTotal ?? null,
      lim: params.limit ?? 30,
    }),
  );
}

export async function getCard(id: string): Promise<Card> {
  return unwrap(await supabase.from('cards').select('*, set:sets(*)').eq('id', id).single());
}

export async function getPriceHistory(cardId: string, days = 365): Promise<PricePoint[]> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  return unwrap(
    await supabase
      .from('price_history')
      .select('*')
      .eq('card_id', cardId)
      .gte('recorded_on', since)
      .order('recorded_on'),
  );
}

export async function getCollection(): Promise<CollectionItem[]> {
  return unwrap(
    await supabase.from('collection_with_prices').select('*').order('created_at', { ascending: false }),
  );
}

export async function getCollectionForCard(cardId: string): Promise<CollectionItem[]> {
  return unwrap(
    await supabase.from('collection_with_prices').select('*').eq('card_id', cardId).order('created_at'),
  );
}

export async function getCollectionValueHistory(days = 365): Promise<CollectionValuePoint[]> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  return unwrap(
    await supabase
      .from('collection_value_history')
      .select('recorded_on, total_value, card_count')
      .gte('recorded_on', since)
      .order('recorded_on'),
  );
}

export async function addToCollection(item: {
  card_id: string;
  variant: string;
  condition: Condition;
  quantity: number;
}): Promise<void> {
  unwrap(await supabase.from('collection_items').insert(item));
}

export async function updateQuantity(id: string, quantity: number): Promise<void> {
  if (quantity < 1) return removeFromCollection(id);
  unwrap(await supabase.from('collection_items').update({ quantity }).eq('id', id));
}

export async function removeFromCollection(id: string): Promise<void> {
  unwrap(await supabase.from('collection_items').delete().eq('id', id));
}
