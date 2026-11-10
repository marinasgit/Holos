import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { cardImage, formatCardNumber, formatMoney } from '@/lib/format';

export function CardThumb({ imageUrl, width = 56 }: { imageUrl: string | null; width?: number }) {
  const theme = useTheme();
  const uri = cardImage(imageUrl, 'low');
  const style = { width, height: width * 1.4, borderRadius: width / 14, backgroundColor: theme.backgroundElement };
  return uri ? <Image source={{ uri }} style={style} contentFit="cover" transition={150} /> : <View style={style} />;
}

/** One row in a list of cards: thumbnail, name, set and number, and a price on the right. */
export function CardRow({
  id,
  name,
  setName,
  localId,
  officialCount,
  imageUrl,
  price,
  priceLabel,
  detail,
}: {
  id: string;
  name: string;
  setName: string;
  localId: string;
  officialCount: number | null;
  imageUrl: string | null;
  price: number | null;
  priceLabel?: string;
  detail?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/card/[id]', params: { id } })}
      style={({ pressed }) => [styles.row, { borderColor: theme.border }, pressed && styles.pressed]}>
      <CardThumb imageUrl={imageUrl} />
      <View style={styles.middle}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {setName} · {formatCardNumber(localId, officialCount)}
        </ThemedText>
        {detail ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {detail}
          </ThemedText>
        ) : null}
      </View>
      <View style={styles.right}>
        {priceLabel ? (
          <ThemedText type="small" themeColor="textSecondary">
            {priceLabel}
          </ThemedText>
        ) : null}
          <ThemedText type="smallBold">{formatMoney(price)}</ThemedText>
        </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  middle: { flex: 1, gap: Spacing.half },
  right: { alignItems: 'flex-end' },
  pressed: { opacity: 0.7 },
});
