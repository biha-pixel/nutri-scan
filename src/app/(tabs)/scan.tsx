/**
 * Scan Screen — The heart of NutriScan.
 *
 * This screen lets the user:
 * 1. Take a photo of food using the camera
 * 2. Pick an existing food photo from their gallery
 * 3. Preview the selected image
 * 4. Retake / reselect if they're not happy
 * 5. Tap "Analyze Food" to proceed to analysis
 */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ImagePreview } from '@/components/image-preview';
import { PermissionDeniedMessage } from '@/components/permission-denied-message';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ImagePermissionError, pickFromGallery } from '@/services/image-service';
import type { CapturedImage } from '@/types/image';

type ScanScreenState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'preview'; image: CapturedImage }
  | { kind: 'permission-denied'; permissionType: 'camera' | 'gallery'; canAskAgain: boolean }
  | { kind: 'error'; message: string };

export default function ScanScreen() {
  const router = useRouter();
  const theme = useTheme();

  const [state, setState] = useState<ScanScreenState>({ kind: 'idle' });

  function handleTakePhoto(): void {
    // Navigate to dedicated capture screen
    router.push('/capture' as any);
  }

  async function handlePickFromGallery(): Promise<void> {
    setState({ kind: 'loading' });

    try {
      const image = await pickFromGallery();

      if (image === null) {
        setState({ kind: 'idle' });
        return;
      }

      setState({ kind: 'preview', image });
    } catch (error) {
      handleImageError(error);
    }
  }

  function handleImageError(error: unknown): void {
    if (error instanceof ImagePermissionError) {
      setState({
        kind: 'permission-denied',
        permissionType: error.permissionType,
        canAskAgain: error.canAskAgain,
      });
    } else {
      const message =
        error instanceof Error ? error.message : 'Something went wrong. Please try again.';
      setState({ kind: 'error', message });
    }
  }

  function handleRetake(): void {
    setState({ kind: 'idle' });
  }

  function handleContinue(): void {
    if (state.kind !== 'preview') return;

    router.push({
      pathname: '/analysis',
      params: { imageUri: state.image.uri },
    });
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle" style={styles.title}>
          Scan Food
        </ThemedText>

        {/* IDLE — Show the two action buttons */}
        {state.kind === 'idle' && (
          <ThemedView style={styles.content}>
            <ThemedText style={styles.instructions} themeColor="textSecondary">
              Take a photo of your food or choose from your gallery, then analyze it for nutrition data.
            </ThemedText>

            <Pressable
              onPress={handleTakePhoto}
              style={({ pressed }) => [
                styles.actionButton,
                styles.primaryActionButton,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Take a photo of food"
            >
              <ThemedText style={styles.primaryActionText}>📷  Take Photo</ThemedText>
            </Pressable>

            <Pressable
              onPress={handlePickFromGallery}
              style={({ pressed }) => [
                styles.actionButton,
                { borderColor: theme.textSecondary },
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Choose a food photo from gallery"
            >
              <ThemedText themeColor="textSecondary">🖼️  Choose from Gallery</ThemedText>
            </Pressable>
          </ThemedView>
        )}

        {/* LOADING — Camera or gallery is open */}
        {state.kind === 'loading' && (
          <ThemedView style={styles.centered}>
            <ActivityIndicator size="large" color={theme.text} />
            <ThemedText themeColor="textSecondary">Opening camera...</ThemedText>
          </ThemedView>
        )}

        {/* PREVIEW — Show the captured image with retake/continue buttons */}
        {state.kind === 'preview' && (
          <ImagePreview
            uri={state.image.uri}
            source={state.image.source}
            onRetake={handleRetake}
            onContinue={handleContinue}
          />
        )}

        {/* PERMISSION DENIED — Show explanation and retry/settings button */}
        {state.kind === 'permission-denied' && (
          <ThemedView style={styles.centered}>
            <PermissionDeniedMessage
              permissionType={state.permissionType}
              canAskAgain={state.canAskAgain}
              onRetry={
                state.permissionType === 'gallery' ? handlePickFromGallery : () => {}
              }
            />
          </ThemedView>
        )}

        {/* ERROR — Show error message with retry option */}
        {state.kind === 'error' && (
          <ThemedView style={styles.centered}>
            <ThemedText type="subtitle" style={styles.errorTitle}>
              Oops!
            </ThemedText>
            <ThemedText style={styles.errorMessage} themeColor="textSecondary">
              {state.message}
            </ThemedText>
            <Pressable
              onPress={handleRetake}
              style={({ pressed }) => [
                styles.actionButton,
                { borderColor: theme.textSecondary },
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Try again"
            >
              <ThemedText>Try Again</ThemedText>
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
    paddingTop: Spacing.four,
    paddingBottom: Spacing.four,
  },
  title: {
    textAlign: 'center',
    marginBottom: Spacing.four,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.four,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.three,
  },
  instructions: {
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.three,
  },
  actionButton: {
    paddingVertical: Spacing.four,
    borderRadius: Spacing.three,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  primaryActionButton: {
    backgroundColor: '#34C759',
    borderColor: '#34C759',
  },
  primaryActionText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 18,
  },
  pressed: {
    opacity: 0.7,
  },
  errorTitle: {
    textAlign: 'center',
  },
  errorMessage: {
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.four,
  },
});
