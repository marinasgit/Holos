# Holos mobile app

Expo (React Native) app with Search, Scan, Collection and card detail screens. See the
[root README](../README.md) for full setup.

```bash
cp .env.example .env.local   # Supabase URL + anon/publishable key
npm install
npx expo start
```

- Screens live in `src/app/` (Expo Router: `(tabs)/index.tsx` = Search, `(tabs)/scan.tsx`,
  `(tabs)/collection.tsx`, `card/[id].tsx`, `sign-in.tsx`).
- Data access is in `src/lib/api.ts`, and the scanner's text parsing is in `src/lib/card-text.ts`
  (tested in `card-text.test.ts`).
- The Scan tab needs a development build (`npx expo run:ios|android` or EAS), because Expo Go
  doesn't include text recognition.
