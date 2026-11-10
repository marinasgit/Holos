import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney } from '@/lib/format';

export interface ChartPoint {
  date: string; // YYYY-MM-DD
  value: number;
}

/** Simple price-over-time line chart. Colored green or red by overall direction. */
export function LineChart({
  points,
  height = 160,
  currency = 'USD',
}: {
  points: ChartPoint[];
  height?: number;
  currency?: string;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);

  if (points.length < 2) return null;

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 4;
  const x = (i: number) => (i / (points.length - 1)) * width;
  const y = (v: number) => pad + (1 - (v - min) / range) * (height - pad * 2);

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${line} L${width},${height} L0,${height} Z`;
  const up = values[values.length - 1] >= values[0];
  const color = up ? theme.positive : theme.negative;

  return (
    <View style={styles.container}>
      <View style={styles.labels}>
        <ThemedText type="small" themeColor="textSecondary">
          High {formatMoney(max, currency)}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Low {formatMoney(min, currency)}
        </ThemedText>
      </View>
      <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? (
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={color} stopOpacity={0.25} />
                <Stop offset="1" stopColor={color} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Path d={area} fill="url(#fill)" />
            <Path d={line} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" />
          </Svg>
        ) : null}
      </View>
      <View style={styles.labels}>
        <ThemedText type="small" themeColor="textSecondary">
          {points[0].date}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {points[points.length - 1].date}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.one },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
});
