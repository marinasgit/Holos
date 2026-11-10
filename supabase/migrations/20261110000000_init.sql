-- Holos initial schema
--
-- Catalog (sets, cards) and market prices (price_history) are public and read-only
-- for app users; only the service role (the import/snapshot scripts) writes them.
-- Collections belong to a single user and are protected by row level security.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------

create table public.sets (
  id             text primary key,               -- TCGdex set id, e.g. "sv03.5"
  name           text not null,
  series_id      text,
  series_name    text,
  release_date   date,
  official_count int,                            -- the "/165" printed on cards
  total_count    int,                            -- including secret rares
  logo_url       text,
  symbol_url     text,
  updated_at     timestamptz not null default now()
);

create table public.cards (
  id                text primary key,            -- TCGdex card id, e.g. "sv03.5-006"
  set_id            text not null references public.sets (id) on delete cascade,
  local_id          text not null,               -- number printed on the card, e.g. "006"
  name              text not null,
  image_url         text,                        -- base URL: append "/high.webp" or "/low.webp"
  rarity            text,
  category          text,                        -- Pokemon / Trainer / Energy
  hp                int,
  types             text[],
  illustrator       text,
  variants          text[],                      -- printings that exist: normal, holo, reverse, firstEdition
  details_synced_at timestamptz,
  updated_at        timestamptz not null default now()
);

create index cards_set_id_idx on public.cards (set_id);
create index cards_local_id_idx on public.cards (local_id);
create index cards_name_trgm_idx on public.cards using gin (name extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Prices: one row per card / source / variant / day. Never overwritten across
-- days, so the table *is* the price history.
-- ---------------------------------------------------------------------------

create table public.price_history (
  card_id     text not null references public.cards (id) on delete cascade,
  source      text not null check (source in ('tcgplayer', 'cardmarket')),
  -- tcgplayer: normal, holofoil, reverse-holofoil, 1stEditionHolofoil, ...
  -- cardmarket: default, foil
  variant     text not null,
  currency    text not null,
  market      numeric(12, 2),
  low         numeric(12, 2),
  mid         numeric(12, 2),
  high        numeric(12, 2),
  recorded_on date not null default current_date,
  primary key (card_id, source, variant, recorded_on)
);

create view public.latest_prices
with (security_invoker = true) as
select distinct on (card_id, source, variant) *
from public.price_history
order by card_id, source, variant, recorded_on desc;

-- ---------------------------------------------------------------------------
-- Collections
-- ---------------------------------------------------------------------------

create table public.collection_items (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  card_id        text not null references public.cards (id),
  variant        text not null default 'normal',  -- matches a tcgplayer price variant
  condition      text not null default 'NM' check (condition in ('NM', 'LP', 'MP', 'HP', 'DMG')),
  quantity       int not null default 1 check (quantity > 0),
  purchase_price numeric(12, 2),
  notes          text,
  created_at     timestamptz not null default now()
);

create index collection_items_user_id_idx on public.collection_items (user_id);
create index collection_items_card_id_idx on public.collection_items (card_id);

-- Daily snapshot of each user's total collection value (for the portfolio chart).
create table public.collection_value_history (
  user_id     uuid not null references auth.users (id) on delete cascade,
  recorded_on date not null default current_date,
  total_value numeric(14, 2) not null,
  card_count  int not null,
  primary key (user_id, recorded_on)
);

-- Collection items joined with card info and the latest TCGplayer market price (USD).
-- If the owned variant has no price, falls back to the cheapest priced variant.
create view public.collection_with_prices
with (security_invoker = true) as
select
  ci.*,
  c.name,
  c.local_id,
  c.set_id,
  s.name as set_name,
  s.official_count,
  c.image_url,
  coalesce(exact.market, fallback.market) as unit_price,
  coalesce(exact.market, fallback.market) * ci.quantity as total_price
from public.collection_items ci
join public.cards c on c.id = ci.card_id
join public.sets s on s.id = c.set_id
left join public.latest_prices exact
  on exact.card_id = ci.card_id
 and exact.source = 'tcgplayer'
 and exact.variant = ci.variant
left join lateral (
  select lp.market
  from public.latest_prices lp
  where lp.card_id = ci.card_id
    and lp.source = 'tcgplayer'
    and lp.market is not null
  order by lp.market asc
  limit 1
) fallback on true;

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

-- Search by name (fuzzy) and/or printed collector number ("6", "006", "TG05").
-- set_total narrows by the number after the slash ("/165").
create function public.search_cards(
  q         text default null,
  number    text default null,
  set_total int  default null,
  lim       int  default 30
)
returns table (
  id             text,
  name           text,
  local_id       text,
  set_id         text,
  set_name       text,
  official_count int,
  release_date   date,
  image_url      text,
  rarity         text,
  market_price   numeric
)
language sql
stable
set search_path = public, extensions
as $$
  select
    c.id, c.name, c.local_id, c.set_id, s.name, s.official_count, s.release_date,
    c.image_url, c.rarity,
    (
      select ph.market
      from price_history ph
      where ph.card_id = c.id and ph.source = 'tcgplayer' and ph.market is not null
      order by ph.recorded_on desc, ph.market asc
      limit 1
    ) as market_price
  from cards c
  join sets s on s.id = c.set_id
  where (
      coalesce(trim(q), '') = ''
      or c.name ilike '%' || trim(q) || '%'
      or c.name % trim(q)
    )
    and (
      number is null
      or upper(ltrim(c.local_id, '0')) = upper(ltrim(number, '0'))
    )
    and (set_total is null or s.official_count = set_total)
    and (coalesce(trim(q), '') <> '' or number is not null)
  order by
    (lower(c.name) = lower(trim(coalesce(q, '')))) desc,
    similarity(c.name, coalesce(q, '')) desc,
    s.release_date desc nulls last,
    c.name
  limit least(greatest(lim, 1), 100);
$$;

-- Writes today's total for every user. Called by the nightly price snapshot job
-- (service role only).
create function public.snapshot_collection_values()
returns int
language sql
security definer
set search_path = public
as $$
  with totals as (
    select user_id, coalesce(sum(total_price), 0) as total, sum(quantity)::int as cnt
    from collection_with_prices
    group by user_id
  ), upserted as (
    insert into collection_value_history (user_id, recorded_on, total_value, card_count)
    select user_id, current_date, total, cnt from totals
    on conflict (user_id, recorded_on)
      do update set total_value = excluded.total_value, card_count = excluded.card_count
    returning 1
  )
  select count(*)::int from upserted;
$$;

-- ---------------------------------------------------------------------------
-- Row level security and grants
-- ---------------------------------------------------------------------------

alter table public.sets enable row level security;
alter table public.cards enable row level security;
alter table public.price_history enable row level security;
alter table public.collection_items enable row level security;
alter table public.collection_value_history enable row level security;

create policy "Catalog is public" on public.sets for select using (true);
create policy "Catalog is public" on public.cards for select using (true);
create policy "Prices are public" on public.price_history for select using (true);

create policy "Users read own items" on public.collection_items
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Users add own items" on public.collection_items
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Users update own items" on public.collection_items
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "Users delete own items" on public.collection_items
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "Users read own value history" on public.collection_value_history
  for select to authenticated using (user_id = (select auth.uid()));

grant select on public.sets, public.cards, public.price_history, public.latest_prices
  to anon, authenticated;
grant select, insert, update, delete on public.collection_items to authenticated;
grant select on public.collection_value_history, public.collection_with_prices to authenticated;

grant execute on function public.search_cards(text, text, int, int) to anon, authenticated;
revoke execute on function public.snapshot_collection_values() from public, anon, authenticated;
grant execute on function public.snapshot_collection_values() to service_role;
