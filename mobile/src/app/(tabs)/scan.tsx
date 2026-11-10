import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useIsFocused } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CardRow } from '@/components/card-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Notice, SetupNotice } from '@/components/ui';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { searchCards } from '@/lib/api';
import { parseCardText, type ParsedCardText } from '@/lib/card-text';
import { isTextRecognitionAvailable, recognizeText } from '@/lib/ocr';
import { isSupabaseConfigured } from '@/lib/supabase';
import type { CardSearchResult } from '@/lib/types';

/** Try the most specific search first, then relax it until something matches. */
async function findMatches(parsed: ParsedCardText): Promise<CardSearchResult[]> {
  const attempts: Parameters<typeof searchCards>[0][] = [];
  if (parsed.number) {
    attempts.push({ number: parsed.number, setTotal: parsed.setTotal, q: parsed.name });
    attempts.push({ number: parsed.number, setTotal: parsed.setTotal });
    if (parsed.setTotal) attempts.push({ number: parsed.number, q: parsed.name });
  }
  for (const name of parsed.nameCandidates.slice(0, 3)) attempts.push({ q: name });

  for (const params of attempts) {
    if (!params.number && !params.q) continue;
    const results = await searchCards({ ...params, limit: 10 });
    if (results.length > 0) return results;
  }
  return [];
}

type ScanState =
  | { status: 'idle' }
  | { status: 'working' }
  | { status: 'done'; parsed: ParsedCardText; results: CardSearchResult[] }
  | { status: 'error'; message: string };

export default function ScanScreen() {
  const theme = useTheme();
  const focused = useIsFocused();
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = useState<ScanState>({ status: 'idle' });

  async function scan() {
    if (!camera.current) return;
    setState({ status: 'working' });
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.8 });
      const lines = await recognizeText(photo.uri);
      const parsed = parseCardText(lines);
      const results = await findMatches(parsed);
      setState({ status: 'done', parsed, results });
    } catch (err) {
      setState({ status: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }

  let body;
  if (!isSupabaseConfigured) {
    body = <SetupNotice />;
  } else if (!isTextRecognitionAvailable) {
    body = (
      <Notice title="Scanning needs a development build">
        Expo Go doesn&apos;t include on-device text recognition. Run “npx expo run:ios” or “npx expo
        run:android” (or an EAS development build), as described in the README. Search works in the meantime.
      </Notice>
    );
  } else if (!permission) {
    body = <ActivityIndicator style={styles.spinner} />;
  } else if (!permission.granted) {
    body = (
      <Notice title="Camera access needed">
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          Holos uses the camera to read the name and number on your card.
        </ThemedText>
        <Button title="Allow camera" onPress={requestPermission} style={styles.allow} />
      </Notice>
    );
  } else {
    body = (
      <View style={styles.flex}>
        <View style={styles.cameraWrap}>
          {focused ? <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" /> : null}
          <View pointerEvents="none" style={[styles.frame, { borderColor: theme.onAccent }]} />
        </View>
        <View style={styles.controls}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            Fill the frame with the card, flat and in good light, with the number at the bottom readable.
          </ThemedText>
          <Button title="Scan card" onPress={scan} loading={state.status === 'working'} />
        </View>
        <ScanResults state={state} onReset={() => setState({ status: 'idle' })} />
      </View>
    );
  }

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <ThemedText type="subtitle">Scan</ThemedText>
      </SafeAreaView>
      {body}
    </ThemedView>
  );
}

function ScanResults({ state, onReset }: { state: ScanState; onReset: () => void }) {
  if (state.status === 'error') return <Notice title="Scan failed">{state.message}</Notice>;
  if (state.status !== 'done') return null;

  const { parsed, results } = state;
  const read = [parsed.name, parsed.number && (parsed.setTotal ? `${parsed.number}/${parsed.setTotal}` : parsed.number)]
    .filter(Boolean)
    .join(' · ');

  return (
    <FlatList
      style={styles.flex}
      data={results}
      keyExtractor={(card) => card.id}
      contentContainerStyle={{ paddingBottom: BottomTabInset + Spacing.three }}
      ListHeaderComponent={
        <ThemedText type="small" themeColor="textSecondary" style={styles.readLine}>
          Read: {read || 'nothing recognizable'}
        </ThemedText>
      }
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
        />
      )}
      ListEmptyComponent={
        <Notice title="No match found">
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            Try again closer and with less glare, or search by name.
          </ThemedText>
          <View style={styles.row}>
            <Button title="Try again" variant="secondary" onPress={onReset} />
            <Button title="Search" variant="secondary" onPress={() => router.navigate('/')} />
          </View>
        </Notice>
      }
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.two },
  cameraWrap: {
    height: 340,
    marginHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    overflow: 'hidden',
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Card-shaped guide (63 x 88 mm).
  frame: { height: '88%', aspectRatio: 63 / 88, borderWidth: 2, borderRadius: 12, opacity: 0.8 },
  controls: { padding: Spacing.three, gap: Spacing.two },
  center: { textAlign: 'center' },
  allow: { marginTop: Spacing.two },
  spinner: { marginTop: Spacing.five },
  readLine: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.one },
  row: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
});
