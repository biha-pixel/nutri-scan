/**
 * Analysis Screen — temporary placeholder for the food analysis step.
 *
 * Right now this screen simply:
 * 1. Receives the image URI from the scan screen (via route params)
 * 2. Shows a "loading / analyzing" animation
 * 3. Does NOT call any backend (that comes later when we build the API)
 *
 * WHY IT EXISTS NOW:
 * Even though the backend isn't built yet, creating this screen lets us
 * complete the full user flow from photo → preview → "analyzing..." so we
 * can test navigation and make sure the image URI passes through correctly.
 * This is called a "stub" or "placeholder" — a real screen with fake behaviour
 * that will be filled in with real logic later.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function AnalysisScreen() {
  const router = useRouter();
  const theme = useTheme();

  // Read the imageUri that the scan screen passed via router.push({ params })
  const { imageUri } = useLocalSearchParams<{ imageUri: string }>();

  // Simulated analysis states
  const [status, setStatus] = useState<'analyzing' | 'done'>('analyzing');

  /**
   * Simulate an analysis delay.
   *
   * In the real implementation, this useEffect will be replaced with an
   * actual API call to our Next.js backend, which will:
   *   1. Upload the image
   *   2. Send it to the AI vision model for food identification
   *   3. Look up nutrition data from USDA
   *   4. Return the results
   *
   * For now, we just wait 3 seconds to simulate the experience.
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      setStatus('done');
    }, 3000);

    // Cleanup: if the user leaves this screen before the timer fires,
    // cancel the timer so it doesn't try to update state on an unmounted component.
    return () => clearTimeout(timer);
  }, []);

  function handleGoBack(): void {
    router.back();
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {status === 'analyzing' && (
          <ThemedView style={styles.centered}>
            <ActivityIndicator size="large" color={theme.text} />
            <ThemedText type="subtitle" style={styles.title}>
              Analyzing...
            </ThemedText>
            <ThemedText style={styles.subtitle} themeColor="textSecondary">
              Identifying food items in your photo
            </ThemedText>
          </ThemedView>
        )}

        {status === 'done' && (
          <ThemedView style={styles.centered}>
            <ThemedText style={styles.checkmark}>✅</ThemedText>
            <ThemedText type="subtitle" style={styles.title}>
              Analysis Complete
            </ThemedText>
            <ThemedText style={styles.subtitle} themeColor="textSecondary">
              This is a placeholder screen.{'\n'}Backend integration coming soon!
            </ThemedText>

            {imageUri && (
              <ThemedView
                type="backgroundElement"
                style={styles.debugInfo}
              >
                <ThemedText type="code">Image URI received ✓</ThemedText>
              </ThemedView>
            )}

            <Pressable
              onPress={handleGoBack}
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: theme.backgroundElement },
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Go back to scan screen"
            >
              <ThemedText>← Scan Another</ThemedText>
            </Pressable>
          </ThemedView>
        )}
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
    paddingHorizontal: Spacing.four,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.three,
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    lineHeight: 22,
  },
  checkmark: {
    fontSize: 48,
  },
  debugInfo: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    marginTop: Spacing.three,
  },
  button: {
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    marginTop: Spacing.four,
  },
  pressed: {
    opacity: 0.7,
  },
});
