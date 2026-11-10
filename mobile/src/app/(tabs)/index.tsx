import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CardRow } from '@/components/card-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Notice, SetupNotice } from '@/components/ui';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useLoader } from '@/hooks/use-loader';
import { useTheme } from '@/hooks/use-theme';
import { searchCards } from '@/lib/api';
import { parseCardText } from '@/lib/card-text';
import { isSupabaseConfigured } from '@/lib/supabase';

/** "charizard", "25", "006/165" and "pikachu 25/102" all work. */
function toSearchParams(text: string) {
  const numberMatch = text.match(/\S+\s*\/\s*\S+/);
  if (numberMatch) {
    const { number, setTotal } = parseCardText([numberMatch[0]]);
    if (number) return { number, setTotal, q: text.replace(numberMatch[0], '').trim() || null };
  }
  const trailingNumber = text.match(/^(.*?)\s*\b(\d{1,3})$/);
  if (trailingNumber) return { q: trailingNumber[1] || null, number: trailingNumber[2] };
  return { q: text };
}

export default function SearchScreen() {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data, loading, error } = useLoader(
    () => (debounced.length >= 2 || /\d/.test(debounced) ? searchCards(toSearchParams(debounced)) : Promise.resolve([])),
    [debounced],
    isSupabaseConfigured,
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <ThemedText type="subtitle">Search</ThemedText>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Card name or number, e.g. Charizard 4/102"
          placeholderTextColor={theme.textSecondary}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          returnKeyType="search"
          style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
        />
      </SafeAreaView>

      {!isSupabaseConfigured ? (
        <SetupNotice />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(card) => card.id}
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingBottom: BottomTabInset + Spacing.three }}
          renderItem={({ item }) => (
            <CardRow
              id={item.id}
              name={item.name}
              setName={item.set_name}
              localId={item.local_id}
              officialCount={item.official_count}
              imageUrl={item.image_url}
              price={item.market_price}
              priceLabel={item.market_price != null ? 'from' : undefined}
              detail={item.rarity ?? undefined}
            />
          )}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator style={styles.spinner} />
            ) : error ? (
              <Notice title="Search failed">{error}</Notice>
            ) : debounced ? (
              <Notice title="No cards found">Try a shorter name or just the card number.</Notice>
            ) : (
              <Notice title="Find any Pokémon card">
                Search by name, or by the number printed at the bottom of the card.
              </Notice>
            )
          }
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.two, gap: Spacing.two },
  input: {
    height: 44,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  spinner: { marginTop: Spacing.five },
});
