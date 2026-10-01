/**
 * Sign Up Screen
 *
 * Lets a new user create an account with email and password.
 *
 * WHAT THIS SCREEN DOES:
 * 1. Collects email and password (with confirmation).
 * 2. Calls the signUp method from our auth context.
 * 3. If Supabase requires email confirmation, shows a confirmation message.
 * 4. If no confirmation is needed, navigates directly to the main app.
 * 5. On failure, shows a user-friendly error message.
 *
 * WHY CONFIRM PASSWORD?
 * Because the password is masked (dots instead of characters), it's easy to
 * make a typo. Asking the user to type it twice catches mistakes before the
 * account is created. This is a client-side check — Supabase doesn't require it.
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

export default function SignUpScreen() {
  const { signUp } = useAuth();
  const theme = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  async function handleSignUp() {
    // Client-side validation
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (!password) {
      setError('Please enter a password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    const result = await signUp(email.trim(), password);

    setIsSubmitting(false);

    if (result.success) {
      if (result.needsConfirmation) {
        // Supabase requires email confirmation — show a message
        setShowConfirmation(true);
      } else {
        // No confirmation needed — go straight to the main app
        router.replace('/(tabs)');
      }
    } else {
      setError(result.error);
    }
  }

  // ─── Confirmation Message Screen ─────────────────────────────────

  if (showConfirmation) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.confirmationContent}>
            <ThemedText type="subtitle" style={styles.title}>
              Check your email
            </ThemedText>
            <ThemedText
              themeColor="textSecondary"
              style={styles.confirmationText}
            >
              We sent a confirmation link to{' '}
              <ThemedText style={styles.emailHighlight}>{email}</ThemedText>.
              {'\n\n'}
              Click the link in the email to activate your account, then come
              back here to sign in.
            </ThemedText>
            <Pressable
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => router.replace('/(auth)/sign-in')}
              accessibilityRole="button"
              accessibilityLabel="Go to sign in"
            >
              <ThemedText style={styles.buttonText}>Go to Sign In</ThemedText>
            </Pressable>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  // ─── Sign Up Form ────────────────────────────────────────────────

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
              Create account
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              Sign up to save your scan history
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
                placeholder="At least 6 characters"
                placeholderTextColor={theme.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                textContentType="newPassword"
                autoComplete="new-password"
                returnKeyType="next"
                accessibilityLabel="Password"
                editable={!isSubmitting}
              />
            </View>

            <View style={styles.inputGroup}>
              <ThemedText type="small" style={styles.label}>
                Confirm password
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
                placeholder="Type your password again"
                placeholderTextColor={theme.textSecondary}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                textContentType="newPassword"
                autoComplete="new-password"
                returnKeyType="done"
                onSubmitEditing={handleSignUp}
                accessibilityLabel="Confirm password"
                editable={!isSubmitting}
              />
            </View>

            {/* Error message */}
            {error && (
              <ThemedText style={styles.errorText}>{error}</ThemedText>
            )}

            {/* Sign Up Button */}
            <Pressable
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
                isSubmitting && styles.buttonDisabled,
              ]}
              onPress={handleSignUp}
              disabled={isSubmitting}
              accessibilityRole="button"
              accessibilityLabel="Create account"
              accessibilityState={{ disabled: isSubmitting }}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <ThemedText style={styles.buttonText}>
                  Create Account
                </ThemedText>
              )}
            </Pressable>
          </View>

          {/* Footer — link to sign in */}
          <View style={styles.footer}>
            <ThemedText themeColor="textSecondary">
              Already have an account?{' '}
            </ThemedText>
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="link"
              accessibilityLabel="Go to sign in"
            >
              <ThemedText style={styles.linkText}>Sign In</ThemedText>
            </Pressable>
          </View>
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
  confirmationContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    gap: Spacing.four,
  },
  confirmationText: {
    textAlign: 'center',
    lineHeight: 24,
  },
  emailHighlight: {
    fontWeight: '600',
  },
});
