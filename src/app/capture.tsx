/**
 * Capture Screen — Real-time food photography with measurement guidance.
 *
 * This screen provides a live camera preview with a framing guide, permission
 * handling, capture controls, and image review before analysis.
 *
 * LIFECYCLE:
 * 1. Request camera permission (if needed)
 * 2. Wait for camera to be ready (onCameraReady)
 * 3. Display live preview with framing guide
 * 4. Allow capture (button enabled only after camera ready)
 * 5. Show captured image with Retake/Use Photo actions
 * 6. Unmount camera when leaving screen to avoid dual preview
 *
 * IMAGE CAPTURE:
 * - No crop or editing applied (uncropped original)
 * - Retains width, height, and URI
 * - Does NOT claim to provide depth or real-world scale
 */

import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { CapturedImage } from '@/types/image';
import type { FoodCaptureMetadata } from '@/types/capture-metadata';
import type { ReferenceMarkerType } from '@/types/reference-marker';
import { REFERENCE_MARKER_SPECS } from '@/types/reference-marker';

type CaptureState =
  | { kind: 'permission-requesting' }
  | { kind: 'permission-denied'; canAskAgain: boolean }
  | { kind: 'camera-unavailable' }
  | { kind: 'waiting-for-ready' }
  | { kind: 'ready' }
  | { kind: 'capturing' }
  | { kind: 'capture-error'; message: string }
  | { kind: 'camera-error'; message: string }
  | {
      kind: 'reviewing';
      image: CapturedImage;
      photoWidth?: number;
      photoHeight?: number;
      metadata: FoodCaptureMetadata;
    };

export default function CaptureScreen() {
  const router = useRouter();
  const theme = useTheme();
  const cameraRef = useRef<CameraView>(null);

  // Read route params for calibration initialization
  const { initialCalibration } = useLocalSearchParams<{ initialCalibration?: 'true' | 'false' }>();

  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = useState<CaptureState>(() => {
    // Determine initial state based on permission status
    if (permission === null) {
      return { kind: 'permission-requesting' };
    }
    if (!permission.granted) {
      return { kind: 'permission-denied', canAskAgain: permission.canAskAgain };
    }
    return { kind: 'waiting-for-ready' };
  });

  // Calibration state
  const [calibrationEnabled, setCalibrationEnabled] = useState(initialCalibration === 'true');
  const [selectedMarkerType, setSelectedMarkerType] = useState<ReferenceMarkerType | undefined>();
  const [showMarkerSelector, setShowMarkerSelector] = useState(false);

  // Request permission on mount if needed
  React.useEffect(() => {
    if (permission === null) {
      return; // Still loading
    }
    if (!permission.granted && permission.canAskAgain) {
      // Auto-request permission on mount if we can
      requestPermission().catch(() => {
        // Error during request; user likely dismissed dialog
      });
    }
  }, [permission, requestPermission]);

  // Unmount camera on screen exit to prevent dual previews
  React.useEffect(() => {
    return () => {
      // Component unmounting; camera will be cleaned up automatically
      // but we can explicitly deactivate if needed
    };
  }, []);

  async function handleRequestPermission(): Promise<void> {
    try {
      const result = await requestPermission();
      if (result.granted) {
        setState({ kind: 'waiting-for-ready' });
      } else {
        setState({
          kind: 'permission-denied',
          canAskAgain: result.canAskAgain,
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to request camera permission';
      setState({ kind: 'permission-denied', canAskAgain: false });
    }
  }

  function handleCameraReady(): void {
    if (state.kind === 'waiting-for-ready') {
      setState({ kind: 'ready' });
    }
  }

  function handleCameraError(error: unknown): void {
    const message =
      error instanceof Error ? error.message : 'Camera error occurred';
    setState({ kind: 'camera-error', message });
  }

  function handleToggleCalibration(): void {
    setCalibrationEnabled(!calibrationEnabled);
    // Clear marker selection when toggling off
    if (calibrationEnabled) {
      setSelectedMarkerType(undefined);
    }
  }

  function handleSelectMarker(markerType: ReferenceMarkerType): void {
    setSelectedMarkerType(markerType);
  }

  function handleClearMarker(): void {
    setSelectedMarkerType(undefined);
  }

  async function handleCapture(): Promise<void> {
    // Prevent duplicate capture requests
    if (state.kind !== 'ready') {
      return;
    }

    if (!cameraRef.current) {
      setState({
        kind: 'capture-error',
        message: 'Camera reference is not available',
      });
      return;
    }

    setState({ kind: 'capturing' });

    try {
      // Capture uncropped image without editing
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7, // Reasonable balance between quality and file size
        exif: false,  // Strip EXIF metadata (privacy)
        skipProcessing: false, // Let native side optimize
      });

      if (!photo || !photo.uri) {
        throw new Error('Capture returned no URI');
      }

      // Capture the image URI and dimensions (informational only)
      const capturedImage: CapturedImage = {
        uri: photo.uri,
        source: 'camera',
      };

      // Create capture metadata from available, verified data
      const metadata: FoodCaptureMetadata = {
        version: 1,
        capturedAt: new Date().toISOString(),
        captureMode: 'camera',
        imageWidthPx: photo.width ?? 0,
        imageHeightPx: photo.height ?? 0,
        mimeType: 'image/jpeg', // Camera capture always produces JPEG
        compressionQuality: 0.7, // Matches takePictureAsync quality param
        exifStripped: true, // We explicitly set exif: false
        referenceCalibration: calibrationEnabled && selectedMarkerType
          ? {
              version: 1,
              enabled: true,
              selectedMarkerType,
              statusMessage: `Calibration enabled - ${selectedMarkerType.replace(/_/g, ' ')} selected`,
            }
          : calibrationEnabled
          ? {
              version: 1,
              enabled: true,
              statusMessage: 'Calibration enabled - No marker selected',
            }
          : { enabled: false },
        disclaimer: 'Single RGB image — no depth data, no 3D reconstruction, no absolute scale.',
      };

      // Store dimensions for display purposes
      const photoWidth = photo.width;
      const photoHeight = photo.height;

      setState({ kind: 'reviewing', image: capturedImage, photoWidth, photoHeight, metadata });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to capture image';
      setState({ kind: 'capture-error', message });
    }
  }

  function handleRetake(): void {
    setState({ kind: 'ready' });
  }

  function handleUsePhoto(): void {
    if (state.kind !== 'reviewing') return;

    // Navigate to analysis screen with captured image and metadata
    // Encode metadata as JSON string (route params don't support complex objects)
    const metadataJson = JSON.stringify(state.metadata);

    router.push({
      pathname: '/analysis',
      params: {
        imageUri: state.image.uri,
        captureMetadata: metadataJson,
      },
    });
  }

  function handleCancel(): void {
    router.back();
  }

  function handleRetryCapture(): void {
    setState({ kind: 'ready' });
  }

  // Permission requesting state
  if (state.kind === 'permission-requesting') {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={theme.text} />
            <ThemedText themeColor="textSecondary">Requesting camera access...</ThemedText>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  // Permission denied state
  if (state.kind === 'permission-denied') {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <Pressable
              onPress={handleCancel}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <ThemedText style={styles.headerButton}>← Back</ThemedText>
            </Pressable>
          </View>

          <View style={styles.centered}>
            <ThemedText style={styles.errorIcon}>📷</ThemedText>
            <ThemedText type="subtitle" style={styles.errorTitle}>
              Camera Access Required
            </ThemedText>
            <ThemedText style={styles.errorMessage} themeColor="textSecondary">
              NutriScan needs camera permission to photograph food for analysis.
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
                accessibilityLabel="Enable camera access"
              >
                <ThemedText style={styles.primaryButtonText}>Enable Camera</ThemedText>
              </Pressable>
            )}

            {!state.canAskAgain && (
              <ThemedText style={styles.settingsNote} themeColor="textSecondary">
                Please enable camera access in your device settings.
              </ThemedText>
            )}
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  // Camera unavailable state
  if (state.kind === 'camera-unavailable') {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <Pressable onPress={handleCancel} accessibilityRole="button">
              <ThemedText style={styles.headerButton}>← Back</ThemedText>
            </Pressable>
          </View>

          <View style={styles.centered}>
            <ThemedText style={styles.errorIcon}>⚠️</ThemedText>
            <ThemedText type="subtitle" style={styles.errorTitle}>
              Camera Not Available
            </ThemedText>
            <ThemedText style={styles.errorMessage} themeColor="textSecondary">
              This device does not have a camera or it is not accessible.
            </ThemedText>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  // Camera error state
  if (state.kind === 'camera-error') {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <Pressable onPress={handleCancel} accessibilityRole="button">
              <ThemedText style={styles.headerButton}>← Back</ThemedText>
            </Pressable>
          </View>

          <View style={styles.centered}>
            <ThemedText style={styles.errorIcon}>🔴</ThemedText>
            <ThemedText type="subtitle" style={styles.errorTitle}>
              Camera Error
            </ThemedText>
            <ThemedText style={styles.errorMessage} themeColor="textSecondary">
              {state.message}
            </ThemedText>
            <Pressable
              onPress={handleCancel}
              style={({ pressed }) => [
                styles.button,
                { borderColor: theme.textSecondary },
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <ThemedText>Go Back</ThemedText>
            </Pressable>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  // Capture error state
  if (state.kind === 'capture-error') {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <Pressable onPress={handleCancel} accessibilityRole="button">
              <ThemedText style={styles.headerButton}>← Back</ThemedText>
            </Pressable>
          </View>

          <View style={styles.centered}>
            <ThemedText style={styles.errorIcon}>❌</ThemedText>
            <ThemedText type="subtitle" style={styles.errorTitle}>
              Capture Failed
            </ThemedText>
            <ThemedText style={styles.errorMessage} themeColor="textSecondary">
              {state.message}
            </ThemedText>
            <Pressable
              onPress={handleRetryCapture}
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

  // Reviewing captured image state
  if (state.kind === 'reviewing') {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.reviewHeader}>
            <Pressable
              onPress={handleCancel}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <ThemedText style={styles.headerButton}>← Cancel</ThemedText>
            </Pressable>
            <ThemedText type="subtitle">Review Photo</ThemedText>
            <View style={styles.headerSpacer} />
          </View>

          {/* Image preview */}
          <View style={styles.reviewContainer}>
            <View style={styles.imageContainer}>
              {/* Using a simple colored view since we need to display the captured image */}
              <ThemedView style={styles.imagePlaceholder}>
                <ThemedText themeColor="textSecondary" style={styles.imageNote}>
                  Photo captured{state.photoWidth ? ` (${state.photoWidth}×${state.photoHeight}px)` : ''}
                </ThemedText>
              </ThemedView>
            </View>

            {/* Reference Calibration UI */}
            <View style={styles.calibrationSection}>
              <View style={styles.calibrationHeader}>
                <Pressable
                  onPress={handleToggleCalibration}
                  style={styles.calibrationToggle}
                  accessibilityRole="button"
                  accessibilityLabel={calibrationEnabled ? 'Disable calibration' : 'Enable calibration'}
                >
                  <ThemedText style={styles.calibrationIcon}>
                    {calibrationEnabled ? '📐' : '○'}
                  </ThemedText>
                  <ThemedText type="subtitle">
                    Reference Calibration {calibrationEnabled ? '✓' : ''}
                  </ThemedText>
                </Pressable>
              </View>

              {calibrationEnabled && (
                <View style={styles.calibrationContent}>
                  {!selectedMarkerType ? (
                    <>
                      <ThemedText style={styles.markerPrompt} themeColor="textSecondary">
                        Select a reference marker type:
                      </ThemedText>
                      <View style={styles.markerGrid}>
                        {(['credit_card', 'us_quarter', 'us_penny', 'one_euro_coin', 'ruler'] as const).map(
                          (markerType) => (
                            <Pressable
                              key={markerType}
                              onPress={() => handleSelectMarker(markerType)}
                              style={({ pressed }) => [
                                styles.markerOption,
                                pressed && styles.markerOptionPressed,
                              ]}
                              accessibilityRole="button"
                              accessibilityLabel={`Select ${markerType.replace(/_/g, ' ')}`}
                            >
                              <ThemedText style={styles.markerLabel}>
                                {markerType === 'credit_card' && '💳 Credit Card'}
                                {markerType === 'us_quarter' && '🪙 US Quarter'}
                                {markerType === 'us_penny' && '🪙 US Penny'}
                                {markerType === 'one_euro_coin' && '🪙 €1 Coin'}
                                {markerType === 'ruler' && '📏 Ruler'}
                              </ThemedText>
                            </Pressable>
                          )
                        )}
                      </View>
                    </>
                  ) : (
                    <View style={styles.markerSelected}>
                      <View style={styles.markerChip}>
                        <ThemedText style={styles.markerChipText}>
                          📐 {selectedMarkerType.replace(/_/g, ' ')} selected
                        </ThemedText>
                        <Pressable
                          onPress={handleClearMarker}
                          accessibilityRole="button"
                          accessibilityLabel="Clear marker selection"
                        >
                          <ThemedText style={styles.markerChipClose}>✕</ThemedText>
                        </Pressable>
                      </View>
                      <ThemedText style={styles.calibrationTip} themeColor="textSecondary">
                        💡 Place the reference object flat next to your plate for accurate measurement.
                      </ThemedText>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Action buttons */}
            <View style={styles.actionButtonRow}>
              <Pressable
                onPress={handleRetake}
                style={({ pressed }) => [
                  styles.button,
                  styles.secondaryButton,
                  { borderColor: theme.textSecondary },
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Retake photo"
              >
                <ThemedText themeColor="textSecondary">Retake</ThemedText>
              </Pressable>

              <Pressable
                onPress={handleUsePhoto}
                style={({ pressed }) => [
                  styles.button,
                  styles.primaryButton,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Use this photo"
              >
                <ThemedText style={styles.primaryButtonText}>Use Photo</ThemedText>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  // Waiting for camera to be ready or camera ready state
  const isReady = state.kind === 'ready';
  const isWaiting = state.kind === 'waiting-for-ready';
  const isCapturing = state.kind === 'capturing';

  return (
    <ThemedView style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        onCameraReady={handleCameraReady}
        onMountError={handleCameraError}
        poster={undefined}
      >
        {/* Header */}
        <SafeAreaView style={styles.cameraHeader}>
          <View style={styles.headerTop}>
            <Pressable
              onPress={handleCancel}
              disabled={isCapturing}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <ThemedText style={styles.headerButtonLight}>← Back</ThemedText>
            </Pressable>
            <ThemedText style={styles.headerTitle}>Capture Food</ThemedText>
            <View style={styles.headerSpacer} />
          </View>
        </SafeAreaView>

        {/* Framing guide overlay */}
        <View style={styles.framingGuideContainer}>
          {/* Grid lines for composition guidance */}
          <View style={styles.framingGuide}>
            <View style={[styles.gridLine, styles.gridLineHorizontal, { top: '33%' }]} />
            <View style={[styles.gridLine, styles.gridLineHorizontal, { top: '66%' }]} />
            <View style={[styles.gridLine, styles.gridLineVertical, { left: '33%' }]} />
            <View style={[styles.gridLine, styles.gridLineVertical, { left: '66%' }]} />
          </View>

          {/* Center focus circle */}
          <View style={styles.focusCircle} />

          {/* Corner brackets */}
          <View style={[styles.cornerBracket, styles.cornerTopLeft]} />
          <View style={[styles.cornerBracket, styles.cornerTopRight]} />
          <View style={[styles.cornerBracket, styles.cornerBottomLeft]} />
          <View style={[styles.cornerBracket, styles.cornerBottomRight]} />
        </View>

        {/* Loading indicator while waiting for camera */}
        {isWaiting && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#34C759" />
          </View>
        )}

        {/* Footer with capture button and status */}
        <SafeAreaView style={styles.cameraFooter} edges={['bottom']}>
          <View style={styles.footerContent}>
            {isWaiting && (
              <ThemedText style={styles.statusText} themeColor="textSecondary">
                Preparing camera...
              </ThemedText>
            )}

            {isReady && (
              <ThemedText style={styles.instructionText} themeColor="textSecondary">
                Position your food and tap to capture
              </ThemedText>
            )}

            {/* Capture button */}
            <Pressable
              onPress={handleCapture}
              disabled={!isReady || isCapturing}
              style={({ pressed }) => [
                styles.captureButton,
                (!isReady || isCapturing) && styles.captureButtonDisabled,
                (pressed && isReady) && styles.captureButtonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Capture photo"
              accessibilityHint={isReady ? 'Double tap to take photo' : 'Waiting for camera to be ready'}
            >
              {isCapturing ? (
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
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  headerButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerButtonLight: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  headerSpacer: {
    width: 48,
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
  settingsNote: {
    textAlign: 'center',
    fontSize: 14,
    fontStyle: 'italic',
  },
  button: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#34C759',
  },
  secondaryButton: {
    borderWidth: 1.5,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },
  pressed: {
    opacity: 0.7,
  },

  // Camera view styles
  camera: {
    flex: 1,
  },
  cameraHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },

  // Framing guide overlay
  framingGuideContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  framingGuide: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
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
  focusCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: 'rgba(52, 199, 89, 0.4)',
  },
  cornerBracket: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#34C759',
    borderWidth: 2,
  },
  cornerTopLeft: {
    top: '15%',
    left: '10%',
    borderBottomWidth: 0,
    borderRightWidth: 0,
  },
  cornerTopRight: {
    top: '15%',
    right: '10%',
    borderBottomWidth: 0,
    borderLeftWidth: 0,
  },
  cornerBottomLeft: {
    bottom: '15%',
    left: '10%',
    borderTopWidth: 0,
    borderRightWidth: 0,
  },
  cornerBottomRight: {
    bottom: '15%',
    right: '10%',
    borderTopWidth: 0,
    borderLeftWidth: 0,
  },

  // Footer and capture button
  cameraFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  footerContent: {
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
    gap: Spacing.three,
  },
  statusText: {
    fontSize: 14,
    color: '#ffffff',
  },
  instructionText: {
    fontSize: 14,
    color: '#ffffff',
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
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 5,
  },
  captureButtonDisabled: {
    backgroundColor: 'rgba(52, 199, 89, 0.5)',
    opacity: 0.6,
  },
  captureButtonPressed: {
    opacity: 0.8,
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    pointerEvents: 'none',
  },

  // Review state styles
  reviewContainer: {
    flex: 1,
    justifyContent: 'space-between',
    gap: Spacing.four,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
  },
  imageContainer: {
    flex: 1,
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  imageNote: {
    fontSize: 14,
    textAlign: 'center',
  },
  actionButtonRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },

  // Calibration UI styles
  calibrationSection: {
    backgroundColor: 'rgba(52, 199, 89, 0.08)',
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  calibrationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calibrationToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flex: 1,
  },
  calibrationIcon: {
    fontSize: 20,
  },
  calibrationContent: {
    gap: Spacing.three,
  },
  markerPrompt: {
    fontSize: 14,
    lineHeight: 20,
  },
  markerGrid: {
    gap: Spacing.two,
  },
  markerOption: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
    borderWidth: 1,
    borderColor: '#34C759',
    alignItems: 'center',
  },
  markerOptionPressed: {
    backgroundColor: 'rgba(52, 199, 89, 0.25)',
    opacity: 0.8,
  },
  markerLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  markerSelected: {
    gap: Spacing.two,
  },
  markerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    backgroundColor: '#34C759',
  },
  markerChipText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  markerChipClose: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: Spacing.two,
  },
  calibrationTip: {
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
  },
});
