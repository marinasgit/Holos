# Holos

A Pokémon card collection app: scan a card with your phone camera, look it up, add it to your
collection, and watch its market value change over time.

| Part | What it is | Where |
|---|---|---|
| Mobile app | React Native + Expo (iOS and Android): Search, Scan, Collection and card pages | [`mobile/`](mobile) |
| Database | Supabase (Postgres, sign-in, row level security) | [`supabase/migrations/`](supabase/migrations) |
| Data jobs | Node scripts: import the card catalog and record daily prices from [TCGdex](https://tcgdex.dev) | [`scripts/`](scripts) |
| Schedules | GitHub Actions: nightly price snapshot, weekly catalog import, CI | [`.github/workflows/`](.github/workflows) |

## How it works

```
TCGdex API ──(weekly)── import-catalog ──► sets, cards
          └─(nightly)── snapshot-prices ─► price_history ──► collection_value_history
                                                │
Phone: Search / Scan ──► search_cards() ────────┤
       Card page ──────► cards + price_history (+ live price from TCGdex)
       Collection ─────► collection_with_prices (your cards × latest price)
```

- **Catalog**: about 220 sets and 24,000 cards, with names, numbers and images, loaded from TCGdex.
- **Prices**: every night the job saves one row per card, printing (normal, holofoil, reverse
  holo, …) and source into `price_history`. Rows are never overwritten across days, so this table
  *is* the price history behind each chart. It tracks every card that's in someone's collection.
  Card pages also fetch the live price, so a card you've never added still shows its price.
- **Collection value** = the latest TCGplayer market price × quantity, summed. It's saved daily for
  the portfolio chart.
- **Scanning**: the camera takes a photo, then on-device text recognition (Apple Vision or Google
  ML Kit) reads the text. [`card-text.ts`](mobile/src/lib/card-text.ts) pulls out the collector
  number (`006/165`) and the card name, and `search_cards()` finds matches. The search starts strict
  and loosens until something matches.

## Setup

You'll need Node 20+ and a free [Supabase](https://supabase.com) account.

### 1. Create the database

1. Create a new Supabase project.
2. Apply the schema, using either of these:
   - **Dashboard:** open *SQL Editor*, paste in
     [`supabase/migrations/20261110000000_init.sql`](supabase/migrations/20261110000000_init.sql),
     and run it.
   - **CLI:** run `npx supabase login`, then `npx supabase link --project-ref <your-ref>`, then
     `npx supabase db push`.
3. For easy testing: go to *Authentication → Sign In / Providers → Email* and turn off
   "Confirm email". Otherwise new accounts must click an emailed link before they can sign in.

### 2. Load the card catalog

```bash
cd scripts
cp .env.example .env      # paste SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (Project Settings → API)
npm install
npm run import-catalog    # about 220 requests, takes a few minutes
```

Useful variations:

```bash
npm run import-catalog -- --set sv03.5               # just one set
npm run snapshot-prices                              # record today's prices for collected cards
npm run snapshot-prices -- --set sv03.5              # prices for a whole set
npm run snapshot-prices -- --card base1-4 --dry-run  # print prices without touching the database
```

### 3. Run the app

```bash
cd mobile
cp .env.example .env.local   # paste EXPO_PUBLIC_SUPABASE_URL and the anon/publishable key
npm install
npx expo start
```

Open it in **Expo Go** on your phone by scanning the QR code. Search, card pages, sign-in and the
collection all work in Expo Go.

**The Scan tab needs a development build.** Expo Go doesn't include the text recognition module.
Build your own copy of the app once, using either:

- `npx expo run:ios` (needs a Mac with Xcode) or `npx expo run:android` (needs Android Studio), or
- [EAS Build](https://docs.expo.dev/develop/development-builds/create-a-build/) in the cloud:
  `npx eas-cli@latest build --profile development`.

After that, `npx expo start` loads your code into the development build the same way it loads
into Expo Go.

### 4. Turn on nightly prices

In GitHub, open *Settings → Secrets and variables → Actions* and add two repository secrets:
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. After that:

- **Snapshot prices** runs every day at 02:17 UTC.
- **Import catalog** runs every Monday to pick up new sets.

You can run either one by hand from the *Actions* tab.

## Development

| | Command |
|---|---|
| Mobile typecheck / lint / tests | `cd mobile && npm run typecheck && npm run lint && npm test` |
| Script typecheck / tests | `cd scripts && npm run typecheck && npm test` |

The service role key bypasses all security rules. Only ever put it in `scripts/.env` and GitHub
secrets. The app uses the anon (publishable) key and can only read the catalog and the signed-in
user's own collection.

## Data sources and limits

- **TCGdex** is free and needs no key. It gives TCGplayer prices (USD) and Cardmarket prices (EUR)
  per card. Some cards get matched to the wrong marketplace listing, so a few prices may be off.
- **TCGplayer** no longer gives API access to new developers, and its terms forbid scraping, so
  prices have to come through a provider like TCGdex.
- **Upgrade path**: paid providers such as Scrydex, PokemonPriceTracker or JustTCG offer more
  history, graded (PSA) prices and better accuracy. To switch, change
  [`scripts/src/tcgdex.ts`](scripts/src/tcgdex.ts) and `extractPriceRows` in
  [`scripts/src/transform.ts`](scripts/src/transform.ts). The database and app stay the same.

## Ideas for next steps

- Image matching for scans: store an image embedding per card with `pgvector` and match photos
  visually. This helps with non-English cards and worn text.
- Price alerts as push notifications when a card moves more than X%.
- Purchase price and profit/loss, wishlists, graded cards, CSV export, and multiple languages
  (TCGdex supports them).

## Legal

Pokémon and all card names and images are trademarks of Nintendo, Creatures Inc. and GAME FREAK
inc. Holos is not affiliated with or endorsed by them. Card data and images come from TCGdex.
Check each data provider's terms before charging for the app.
