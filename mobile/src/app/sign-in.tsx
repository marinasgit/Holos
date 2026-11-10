import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, SetupNotice } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export default function SignInScreen() {
  const theme = useTheme();
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setMessage(null);
    const credentials = { email: email.trim(), password };
    const { data, error } =
      mode === 'sign-in'
        ? await supabase.auth.signInWithPassword(credentials)
        : await supabase.auth.signUp(credentials);
    setBusy(false);
    if (error) {
      setMessage(error.message);
    } else if (!data.session) {
      setMessage('Check your email to confirm your account, then sign in.');
      setMode('sign-in');
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/collection');
    }
  }

  if (!isSupabaseConfigured) return <SetupNotice />;

  const inputStyle = [styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }];

  return (
    <ThemedView style={styles.flex}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.form}>
        <ThemedText type="subtitle">{mode === 'sign-in' ? 'Welcome back' : 'Create account'}</ThemedText>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          style={inputStyle}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password (6+ characters)"
          placeholderTextColor={theme.textSecondary}
          secureTextEntry
          autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
          textContentType={mode === 'sign-in' ? 'password' : 'newPassword'}
          style={inputStyle}
          onSubmitEditing={submit}
        />
        {message ? (
          <ThemedText type="small" themeColor="textSecondary">
            {message}
          </ThemedText>
        ) : null}
        <Button
          title={mode === 'sign-in' ? 'Sign in' : 'Create account'}
          onPress={submit}
          loading={busy}
          disabled={!email.trim() || password.length < 6}
        />
        <View style={styles.switchRow}>
          <Button
            variant="secondary"
            title={mode === 'sign-in' ? 'New here? Create an account' : 'Have an account? Sign in'}
            onPress={() => {
              setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in');
              setMessage(null);
            }}
          />
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  form: { flex: 1, padding: Spacing.four, gap: Spacing.three, justifyContent: 'center' },
  input: { height: 48, borderRadius: Spacing.three, paddingHorizontal: Spacing.three, fontSize: 16 },
  switchRow: { alignItems: 'center' },
});
