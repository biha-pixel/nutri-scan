/**
 * Sign In Screen
 *
 * Lets an existing user sign in with their email and password.
 *
 * WHAT THIS SCREEN DOES:
 * 1. Collects email and password from text inputs.
 * 2. Calls the signIn method from our auth context.
 * 3. On success, navigates to the main app (the tabs).
 * 4. On failure, shows a user-friendly error message.
 *
 * DESIGN DECISIONS:
 * - The sign-in button is disabled while loading (prevents double-taps).
 * - Email input uses autoCapitalize="none" and keyboardType="email-address"
 *   so the keyboard shows @ and . instead of autocapitalizing.
 * - Password input uses secureTextEntry to mask the characters.
 * - There's a link to the sign-up screen for new users.
 */

import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';

export default function SignInScreen() {
  const { signIn } = useAuth();
  const theme = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSignIn() {
    // Basic client-side validation (server validates too)
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    const result = await signIn(email.trim(), password);

    setIsSubmitting(false);

    if (result.success) {
      // Navigate to the main app — replace so pressing back doesn't return here
      router.replace('/(tabs)');
    } else {
      setError(result.error);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          {/* Header */}
          <View style={styles.header}>
            <ThemedText type="subtitle" style={styles.title}>
              Welcome back
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              Sign in to access your scan history
            </ThemedText>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <ThemedText type="small" style={styles.label}>
                Email
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundElement,
                    color: theme.text,
                    borderColor: error ? '#ef4444' : theme.backgroundSelected,
                  },
                ]}
                placeholder="you@example.com"
                placeholderTextColor={theme.textSecondary}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                autoComplete="email"
                returnKeyType="next"
                accessibilityLabel="Email address"
                editable={!isSubmitting}
              />
            </View>

            <View style={styles.inputGroup}>
              <ThemedText type="small" style={styles.label}>
                Password
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundElement,
                    color: theme.text,
                    borderColor: error ? '#ef4444' : theme.backgroundSelected,
                  },
                ]}
                placeholder="Your password"
                placeholderTextColor={theme.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                textContentType="password"
                autoComplete="password"
                returnKeyType="done"
                onSubmitEditing={handleSignIn}
                accessibilityLabel="Password"
                editable={!isSubmitting}
              />
            </View>

            {/* Error message */}
            {error && (
              <ThemedText style={styles.errorText}>{error}</ThemedText>
            )}

            {/* Sign In Button */}
            <Pressable
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
                isSubmitting && styles.buttonDisabled,
              ]}
              onPress={handleSignIn}
              disabled={isSubmitting}
              accessibilityRole="button"
              accessibilityLabel="Sign in"
              accessibilityState={{ disabled: isSubmitting }}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <ThemedText style={styles.buttonText}>Sign In</ThemedText>
              )}
            </Pressable>
          </View>

          {/* Footer — link to sign up */}
          <View style={styles.footer}>
            <ThemedText themeColor="textSecondary">
              Don't have an account?{' '}
            </ThemedText>
            <Pressable
              onPress={() => router.push('/(auth)/sign-up')}
              accessibilityRole="link"
              accessibilityLabel="Go to sign up"
            >
              <ThemedText style={styles.linkText}>Sign Up</ThemedText>
            </Pressable>
          </View>

          {/* Skip — continue as guest */}
          <Pressable
            onPress={() => router.replace('/(tabs)')}
            style={styles.skipButton}
            accessibilityRole="button"
            accessibilityLabel="Continue without signing in"
          >
            <ThemedText themeColor="textSecondary" type="small">
              Continue as guest
            </ThemedText>
          </Pressable>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  header: {
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.five,
  },
  title: {
    textAlign: 'center',
  },
  form: {
    gap: Spacing.three,
  },
  inputGroup: {
    gap: Spacing.one,
  },
  label: {
    marginLeft: Spacing.one,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
    fontSize: 16,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#3c87f7',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.four,
  },
  linkText: {
    color: '#3c87f7',
    fontWeight: '600',
    fontSize: 16,
  },
  skipButton: {
    alignItems: 'center',
    marginTop: Spacing.three,
    paddingVertical: Spacing.two,
  },
});
