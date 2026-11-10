import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CardRow } from '@/components/card-row';
import { LineChart } from '@/components/line-chart';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Notice, SetupNotice } from '@/components/ui';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useLoader } from '@/hooks/use-loader';
import { useTheme } from '@/hooks/use-theme';
import { getCollection, getCollectionValueHistory } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatChange, formatMoney, formatVariant } from '@/lib/format';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export default function CollectionScreen() {
  const theme = useTheme();
  const { session, loading: authLoading } = useAuth();
  const enabled = isSupabaseConfigured && !!session;
  const userId = session?.user.id;

  const items = useLoader(getCollection, [userId], enabled);
  const history = useLoader(() => getCollectionValueHistory(), [userId], enabled);

  // Refresh when coming back to this tab (e.g. after adding a card), but not on first mount.
  const reloadItems = items.reload;
  const reloadHistory = history.reload;
  const focusedBefore = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focusedBefore.current) {
        reloadItems();
        reloadHistory();
      }
      focusedBefore.current = true;
    }, [reloadItems, reloadHistory]),
  );

  const header = (
    <SafeAreaView edges={['top']} style={styles.header}>
      <ThemedText type="subtitle">Collection</ThemedText>
    </SafeAreaView>
  );

  if (!isSupabaseConfigured) {
    return (
      <ThemedView style={styles.flex}>
        {header}
        <SetupNotice />
      </ThemedView>
    );
  }
  if (authLoading) {
    return (
      <ThemedView style={styles.flex}>
        {header}
        <ActivityIndicator style={styles.spinner} />
      </ThemedView>
    );
  }
  if (!session) {
    return (
      <ThemedView style={styles.flex}>
        {header}
        <Notice title="Track your collection">
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            Sign in to save cards and watch your collection&apos;s value change over time.
          </ThemedText>
          <Button title="Sign in" onPress={() => router.push('/sign-in')} style={styles.signIn} />
        </Notice>
      </ThemedView>
    );
  }

  const list = items.data ?? [];
  const total = list.reduce((sum, item) => sum + (item.total_price ?? 0), 0);
  const count = list.reduce((sum, item) => sum + item.quantity, 0);
  const unpriced = list.filter((item) => item.unit_price == null).length;
  const points = (history.data ?? []).map((p) => ({ date: p.recorded_on, value: p.total_value }));
  const previous = points.length >= 2 ? points[points.length - 2].value : null;

  return (
    <ThemedView style={styles.flex}>
      <FlatList
        data={list}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: BottomTabInset + Spacing.three }}
        refreshControl={
          <RefreshControl
            refreshing={items.loading && list.length > 0}
            onRefresh={() => {
              items.reload();
              history.reload();
            }}
          />
        }
        ListHeaderComponent={
          <View>
            {header}
            <View style={styles.summary}>
              <ThemedText type="small" themeColor="textSecondary">
                Market value · {count} card{count === 1 ? '' : 's'}
              </ThemedText>
              <ThemedText type="title">{formatMoney(total)}</ThemedText>
              {previous != null ? (
                <ThemedText
                  type="smallBold"
                  style={{ color: points[points.length - 1].value >= previous ? theme.positive : theme.negative }}>
                  {formatChange(previous, points[points.length - 1].value)} since last snapshot
                </ThemedText>
              ) : null}
              {unpriced > 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {unpriced} card{unpriced === 1 ? ' is' : 's are'} waiting for tonight&apos;s price update.
                </ThemedText>
              ) : null}
              <LineChart points={points} height={120} />
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <CardRow
            id={item.card_id}
            name={item.name}
            setName={item.set_name}
            localId={item.local_id}
            officialCount={item.official_count}
            imageUrl={item.image_url}
            price={item.total_price}
            priceLabel={item.quantity > 1 ? `${item.quantity} × ${formatMoney(item.unit_price)}` : undefined}
            detail={`${formatVariant(item.variant)} · ${item.condition}`}
          />
        )}
        ListEmptyComponent={
          items.loading ? (
            <ActivityIndicator style={styles.spinner} />
          ) : items.error ? (
            <Notice title="Couldn't load your collection">{items.error}</Notice>
          ) : (
            <Notice title="No cards yet">Scan or search for a card and tap “Add to collection”.</Notice>
          )
        }
        ListFooterComponent={
          <View style={styles.footer}>
            <ThemedText type="small" themeColor="textSecondary">
              Signed in as {session.user.email}
            </ThemedText>
            <Button title="Sign out" variant="secondary" onPress={() => supabase.auth.signOut()} />
          </View>
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.two },
  summary: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.three, gap: Spacing.one },
  center: { textAlign: 'center' },
  signIn: { marginTop: Spacing.two, alignSelf: 'stretch' },
  spinner: { marginTop: Spacing.five },
  footer: { padding: Spacing.three, gap: Spacing.two, alignItems: 'center' },
});
