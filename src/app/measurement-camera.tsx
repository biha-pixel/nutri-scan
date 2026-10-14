/**
 * Measurement Camera Screen — Real-time food measurement with AR overlay.
 *
 * This screen:
 * 1. Displays live camera preview via expo-camera
 * 2. Shows an AR grid overlay and measuring line for visual guidance
 * 3. Lets the user capture a frame with a prominent capture button
 * 4. Handles permission denied states
 * 5. Returns the captured image to the scan screen for analysis
 */

import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { captureFrame, MeasurementCameraError } from '@/services/measurement-camera-service';

type MeasurementCameraState =
  | { kind: 'idle' }
  | { kind: 'capturing' }
  | { kind: 'permission-denied'; canAskAgain: boolean }
  | { kind: 'error'; message: string };

export default function MeasurementCameraScreen() {
  const router = useRouter();
  const theme = useTheme();
  const cameraRef = useRef<CameraView>(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = useState<MeasurementCameraState>({ kind: 'idle' });

  // Request permission on mount if not yet determined
  React.useEffect(() => {
    if (permission && !permission.granted) {
      // Permission was denied; update state
      setState({
        kind: 'permission-denied',
        canAskAgain: permission.canAskAgain,
      });
    }
  }, [permission]);

  async function handleRequestPermission(): Promise<void> {
    try {
      const result = await requestPermission();
      if (result.granted) {
        setState({ kind: 'idle' });
      } else {
        setState({
          kind: 'permission-denied',
          canAskAgain: result.canAskAgain,
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to request camera permission.';
      setState({ kind: 'error', message });
    }
  }

  async function handleCapture(): Promise<void> {
    setState({ kind: 'capturing' });

    try {
      const capturedImage = await captureFrame(cameraRef);

      // Navigate to analysis screen with the captured image
      router.push({
        pathname: '/analysis',
        params: { imageUri: capturedImage.uri },
      });
    } catch (error) {
      if (error instanceof MeasurementCameraError) {
        setState({ kind: 'error', message: error.message });
      } else {
        const message =
          error instanceof Error ? error.message : 'Failed to capture image.';
        setState({ kind: 'error', message });
      }
    }
  }

  function handleGoBack(): void {
    router.back();
  }

  function handleRetry(): void {
    setState({ kind: 'error', message: '' });
    setState({ kind: 'idle' });
  }

  // Permission not yet determined or being requested
  if (!permission) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={theme.text} />
            <ThemedText themeColor="textSecondary">Loading camera...</ThemedText>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  // Permission denied
  if (state.kind === 'permission-denied') {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <Pressable onPress={handleGoBack} accessibilityRole="button">
              <ThemedText style={styles.backButton}>← Back</ThemedText>
            </Pressable>
          </View>
          <View style={styles.centered}>
            <ThemedText style={styles.errorIcon}>🚫</ThemedText>
            <ThemedText type="subtitle" style={styles.errorTitle}>
              Camera Permission Required
            </ThemedText>
            <ThemedText style={styles.errorMessage} themeColor="textSecondary">
              NutriScan needs access to your camera to measure food items.
            </ThemedText>
            {state.canAskAgain && (
              <Pressable
                onPress={handleRequestPermission}
                style={({ pressed }) => [
                  styles.button,
                  styles.primaryButton,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Enable camera"
              >
                <ThemedText style={styles.primaryButtonText}>Enable Camera</ThemedText>
              </Pressable>
            )}
            {!state.canAskAgain && (
              <ThemedText style={styles.settingsHint} themeColor="textSecondary">
                Please enable camera access in your device settings.
              </ThemedText>
            )}
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  // Error state
  if (state.kind === 'error') {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <Pressable onPress={handleGoBack} accessibilityRole="button">
              <ThemedText style={styles.backButton}>← Back</ThemedText>
            </Pressable>
          </View>
          <View style={styles.centered}>
            <ThemedText style={styles.errorIcon}>⚠️</ThemedText>
            <ThemedText type="subtitle" style={styles.errorTitle}>
              Capture Failed
            </ThemedText>
            <ThemedText style={styles.errorMessage} themeColor="textSecondary">
              {state.message}
            </ThemedText>
            <Pressable
              onPress={handleRetry}
              style={({ pressed }) => [
                styles.button,
                styles.primaryButton,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Try again"
            >
              <ThemedText style={styles.primaryButtonText}>Try Again</ThemedText>
            </Pressable>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  // Camera active (idle or capturing)
  return (
    <ThemedView style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        enableTorch={false}
      >
        {/* Header with back button */}
        <SafeAreaView style={styles.cameraHeader}>
          <Pressable
            onPress={handleGoBack}
            disabled={state.kind === 'capturing'}
            style={({ pressed }) => [
              styles.backButtonContainer,
              (pressed || state.kind === 'capturing') && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ThemedText style={styles.backButtonLight}>← Back</ThemedText>
          </Pressable>
        </SafeAreaView>

        {/* AR Overlay — Grid and measuring line */}
        <View style={styles.overlayContainer}>
          {/* Grid overlay for visual guidance */}
          <View style={styles.gridOverlay}>
            {/* Horizontal grid lines */}
            <View style={[styles.gridLine, styles.gridLineHorizontal, { top: '33%' }]} />
            <View style={[styles.gridLine, styles.gridLineHorizontal, { top: '66%' }]} />
            {/* Vertical grid lines */}
            <View style={[styles.gridLine, styles.gridLineVertical, { left: '33%' }]} />
            <View style={[styles.gridLine, styles.gridLineVertical, { left: '66%' }]} />
          </View>

          {/* Measuring line across the middle */}
          <View style={styles.measuringLineContainer}>
            <View style={styles.measuringLine} />
            <ThemedText style={styles.measuringLineLabel}>Position food on the line</ThemedText>
          </View>

          {/* Corner markers */}
          <View style={[styles.cornerMarker, styles.cornerTopLeft]} />
          <View style={[styles.cornerMarker, styles.cornerTopRight]} />
          <View style={[styles.cornerMarker, styles.cornerBottomLeft]} />
          <View style={[styles.cornerMarker, styles.cornerBottomRight]} />
        </View>

        {/* Bottom controls */}
        <SafeAreaView style={styles.cameraFooter} edges={['bottom']}>
          <View style={styles.footerContent}>
            <ThemedText style={styles.instructions} themeColor="textSecondary">
              Position your food on the measuring line and tap to capture.
            </ThemedText>

            {/* Capture button */}
            <Pressable
              onPress={handleCapture}
              disabled={state.kind === 'capturing'}
              style={({ pressed }) => [
                styles.captureButton,
                (pressed || state.kind === 'capturing') && styles.captureButtonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Capture food measurement"
            >
              {state.kind === 'capturing' ? (
                <ActivityIndicator size="large" color="#ffffff" />
              ) : (
                <View style={styles.captureButtonInner} />
              )}
            </Pressable>
          </View>
        </SafeAreaView>
      </CameraView>
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  header: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  backButton: {
    fontSize: 16,
  },
  errorIcon: {
    fontSize: 48,
  },
  errorTitle: {
    textAlign: 'center',
  },
  errorMessage: {
    textAlign: 'center',
    lineHeight: 22,
  },
  settingsHint: {
    textAlign: 'center',
    fontSize: 14,
    fontStyle: 'italic',
  },
  button: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  primaryButton: {
    backgroundColor: '#34C759',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },
  pressed: {
    opacity: 0.7,
  },

  // Camera-specific styles
  camera: {
    flex: 1,
  },
  cameraHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  backButtonContainer: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  backButtonLight: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  overlayContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: 'rgba(52, 199, 89, 0.2)',
  },
  gridLineHorizontal: {
    height: 1,
    left: 0,
    right: 0,
  },
  gridLineVertical: {
    width: 1,
    top: 0,
    bottom: 0,
  },
  measuringLineContainer: {
    position: 'absolute',
    left: Spacing.four,
    right: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
  },
  measuringLine: {
    height: 2,
    width: '100%',
    backgroundColor: '#34C759',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
  },
  measuringLineLabel: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  cornerMarker: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#34C759',
    borderWidth: 2,
  },
  cornerTopLeft: {
    top: '20%',
    left: '10%',
    borderBottomWidth: 0,
    borderRightWidth: 0,
  },
  cornerTopRight: {
    top: '20%',
    right: '10%',
    borderBottomWidth: 0,
    borderLeftWidth: 0,
  },
  cornerBottomLeft: {
    bottom: '20%',
    left: '10%',
    borderTopWidth: 0,
    borderRightWidth: 0,
  },
  cornerBottomRight: {
    bottom: '20%',
    right: '10%',
    borderTopWidth: 0,
    borderLeftWidth: 0,
  },
  cameraFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  footerContent: {
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
    gap: Spacing.three,
  },
  instructions: {
    textAlign: 'center',
    color: '#ffffff',
    fontSize: 14,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#34C759',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  captureButtonPressed: {
    opacity: 0.7,
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
});
