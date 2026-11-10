// Small shared building blocks: buttons, chips, notices.

import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}) {
  const theme = useTheme();
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: primary ? theme.accent : theme.backgroundElement },
        (pressed || disabled) && { opacity: disabled ? 0.5 : 0.8 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={primary ? theme.onAccent : theme.text} />
      ) : (
        <ThemedText type="smallBold" style={{ color: primary ? theme.onAccent : theme.text }}>
          {title}
        </ThemedText>
      )}
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? theme.accent : theme.backgroundElement,
          borderColor: selected ? theme.accent : theme.border,
        },
      ]}>
      <ThemedText type="small" style={{ color: selected ? theme.onAccent : theme.text }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

export function Notice({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <View style={styles.notice}>
      <ThemedText type="smallBold">{title}</ThemedText>
      {typeof children === 'string' ? (
        <ThemedText type="small" themeColor="textSecondary">
          {children}
        </ThemedText>
      ) : (
        children
      )}
    </View>
  );
}

export function SetupNotice() {
  return (
    <Notice title="Connect Supabase">
      Copy mobile/.env.example to mobile/.env.local, add your Supabase URL and anon key, then restart
      the dev server. See the README for the full setup.
    </Notice>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    paddingVertical: Spacing.one + 2,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  notice: {
    gap: Spacing.one,
    padding: Spacing.three,
    alignItems: 'center',
  },
});
