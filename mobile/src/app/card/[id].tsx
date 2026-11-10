import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LineChart } from '@/components/line-chart';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Chip, Notice } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useLoader } from '@/hooks/use-loader';
import { useTheme } from '@/hooks/use-theme';
import {
  addToCollection,
  getCard,
  getCollectionForCard,
  getPriceHistory,
  removeFromCollection,
  updateQuantity,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cardImage, formatCardNumber, formatMoney, formatVariant } from '@/lib/format';
import { isSupabaseConfigured } from '@/lib/supabase';
import { fetchLivePrices } from '@/lib/tcgdex';
import { CONDITIONS, type Condition, type PricePoint } from '@/lib/types';

/** Printing names from the card's catalog data, for cards with no TCGplayer price yet. */
const CATALOG_VARIANTS: Record<string, string> = {
  normal: 'normal',
  holo: 'holofoil',
  reverse: 'reverse-holofoil',
  firstEdition: '1stEditionHolofoil',
};

/** Most recent row per source + variant. */
function latestPrices(history: PricePoint[]): PricePoint[] {
  const latest = new Map<string, PricePoint>();
  for (const row of history) latest.set(`${row.source}:${row.variant}`, row); // history is date-ascending
  return [...latest.values()];
}

export default function CardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();

  const card = useLoader(() => getCard(id), [id], isSupabaseConfigured);
  const history = useLoader(() => getPriceHistory(id), [id], isSupabaseConfigured);
  const live = useLoader(() => fetchLivePrices(id), [id]);
  const owned = useLoader(() => getCollectionForCard(id), [id, session?.user.id], isSupabaseConfigured && !!session);

  const [variant, setVariant] = useState<string | null>(null);
  const [condition, setCondition] = useState<Condition>('NM');
  const [quantity, setQuantity] = useState(1);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (card.loading && !card.data) return <ActivityIndicator style={styles.spinner} />;
  if (!card.data) return <Notice title="Card not found">{card.error ?? undefined}</Notice>;
  const c = card.data;

  const prices = live.data?.length ? live.data : latestPrices(history.data ?? []);
  const tcgplayer = prices.filter((p) => p.source === 'tcgplayer');
  const cardmarket = prices.filter((p) => p.source === 'cardmarket');
  const variants = tcgplayer.length
    ? tcgplayer.map((p) => p.variant)
    : (c.variants ?? []).map((v) => CATALOG_VARIANTS[v]).filter(Boolean);
  const selected = variant && variants.includes(variant) ? variant : (variants[0] ?? 'normal');
  const selectedPrice = tcgplayer.find((p) => p.variant === selected);
  const chartPoints = (history.data ?? [])
    .filter((p) => p.source === 'tcgplayer' && p.variant === selected && p.market != null)
    .map((p) => ({ date: p.recorded_on, value: p.market as number }));

  async function add() {
    if (!session) {
      router.push('/sign-in');
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await addToCollection({ card_id: c.id, variant: selected, condition, quantity });
      setMessage(`Added ${quantity} to your collection.`);
      setQuantity(1);
      owned.reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function change(itemId: string, next: number) {
    try {
      await (next < 1 ? removeFromCollection(itemId) : updateQuantity(itemId, next));
      owned.reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }

  const image = cardImage(c.image_url, 'high');

  return (
    <ThemedView style={styles.flex}>
      <Stack.Screen options={{ title: c.name }} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.five }]}>
        {image ? (
          <Image source={{ uri: image }} style={styles.image} contentFit="contain" transition={200} />
        ) : (
          <View style={[styles.image, { backgroundColor: theme.backgroundElement }]} />
        )}

        <View style={styles.section}>
          <ThemedText type="subtitle">{c.name}</ThemedText>
          <ThemedText themeColor="textSecondary">
            {c.set?.name} · {formatCardNumber(c.local_id, c.set?.official_count)}
            {c.rarity ? ` · ${c.rarity}` : ''}
          </ThemedText>
        </View>

        <View style={[styles.panel, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="small" themeColor="textSecondary">
            Market price (TCGplayer){variants.length > 1 ? ` · ${formatVariant(selected)}` : ''}
          </ThemedText>
          <ThemedText type="title">{formatMoney(selectedPrice?.market ?? null)}</ThemedText>
          {selectedPrice ? (
            <ThemedText type="small" themeColor="textSecondary">
              Low {formatMoney(selectedPrice.low)} · Mid {formatMoney(selectedPrice.mid)} · High{' '}
              {formatMoney(selectedPrice.high)}
            </ThemedText>
          ) : live.loading ? (
            <ActivityIndicator />
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              No TCGplayer price available for this printing.
            </ThemedText>
          )}
          {cardmarket.map((p) => (
            <ThemedText key={p.variant} type="small" themeColor="textSecondary">
              Cardmarket {p.variant === 'foil' ? 'foil ' : ''}trend {formatMoney(p.market, p.currency)}
            </ThemedText>
          ))}

          {chartPoints.length >= 2 ? (
            <LineChart points={chartPoints} />
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              Price history builds up daily once this card is in a collection.
            </ThemedText>
          )}
        </View>

        <View style={styles.section}>
          <ThemedText type="smallBold">Add to collection</ThemedText>
          {variants.length > 1 ? (
            <View style={styles.chips}>
              {variants.map((v) => (
                <Chip key={v} label={formatVariant(v)} selected={v === selected} onPress={() => setVariant(v)} />
              ))}
            </View>
          ) : null}
          <View style={styles.chips}>
            {CONDITIONS.map((cond) => (
              <Chip key={cond} label={cond} selected={cond === condition} onPress={() => setCondition(cond)} />
            ))}
          </View>
          <View style={styles.stepperRow}>
            <Stepper value={quantity} onChange={setQuantity} />
            <Button title={session ? 'Add to collection' : 'Sign in to add'} onPress={add} loading={saving} style={styles.flex} />
          </View>
          {message ? (
            <ThemedText type="small" themeColor="textSecondary">
              {message}
            </ThemedText>
          ) : null}
        </View>

        {owned.data?.length ? (
          <View style={styles.section}>
            <ThemedText type="smallBold">In your collection</ThemedText>
            {owned.data.map((item) => (
              <View key={item.id} style={[styles.ownedRow, { borderColor: theme.border }]}>
                <View style={styles.flex}>
                  <ThemedText type="small">
                    {formatVariant(item.variant)} · {item.condition}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatMoney(item.total_price)}
                  </ThemedText>
                </View>
                <Stepper value={item.quantity} min={0} onChange={(next) => change(item.id, next)} />
              </View>
            ))}
          </View>
        ) : null}

        {c.illustrator ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.section}>
            Illustrated by {c.illustrator}
          </ThemedText>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

function Stepper({ value, onChange, min = 1 }: { value: number; onChange: (next: number) => void; min?: number }) {
  const theme = useTheme();
  const button = (label: string, next: number, a11y: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={() => onChange(next)}
      disabled={next < min}
      style={[styles.stepButton, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="smallBold">{label}</ThemedText>
    </Pressable>
  );
  return (
    <View style={styles.stepper}>
      {button(value - 1 < 1 && min === 0 ? '✕' : '−', value - 1, value - 1 < 1 && min === 0 ? 'Remove' : 'Decrease')}
      <ThemedText type="smallBold" style={styles.stepValue}>
        {value}
      </ThemedText>
      {button('+', value + 1, 'Increase')}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  spinner: { marginTop: Spacing.six },
  content: { padding: Spacing.three, gap: Spacing.four },
  image: { width: '70%', aspectRatio: 63 / 88, alignSelf: 'center', borderRadius: 12 },
  section: { gap: Spacing.two },
  panel: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.one },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  stepperRow: { flexDirection: 'row', gap: Spacing.three, alignItems: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  stepButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  stepValue: { minWidth: 24, textAlign: 'center' },
  ownedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
