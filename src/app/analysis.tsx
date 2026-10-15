/**
 * Analysis Screen — Unified Food Analysis with Nutrition Data.
 *
 * This screen:
 * 1. Receives the captured image URI from the scan screen via route params
 * 2. Uploads the image to POST /api/analyze-food (unified endpoint)
 * 3. Displays 4-stage loading progress (preparing → analyzing → nutrition → finalizing)
 * 4. Handles 7 distinct error types with tailored user guidance
 * 5. Displays analyzed food items with full nutrition data, macros, and educational highlights
 */

import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FoodItemCard } from '@/components/food-item-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { analyzeFoodImage, AnalyzeServiceError } from '@/services/analyze-service';
import { formatAnalysisResultForSave, saveScanRecord } from '@/services/history-service';
import type {
  AnalyzedFoodItem,
  FoodAnalysisResult,
  AnalysisLoadingStage,
  AnalysisErrorCode,
} from '@/types/food';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

type AnalysisState =
  | { kind: 'loading'; stage: AnalysisLoadingStage }
  | { kind: 'error'; code: AnalysisErrorCode; message: string; details?: string }
  | { kind: 'success'; data: FoodAnalysisResult };

// Stage labels for the 4-stage stepper
const STAGE_LABELS: Record<AnalysisLoadingStage, string> = {
  preparing: 'Preparing image',
  analyzing: 'Analyzing image',
  nutrition: 'Finding nutrition data',
  finalizing: 'Preparing results',
};

// Error configurations with user-friendly titles and guidance
const ERROR_CONFIG: Record<
  AnalysisErrorCode,
  { title: string; icon: string; canRetry: boolean }
> = {
  NO_FOOD_DETECTED: {
    title: 'No Food Detected',
    icon: '🍽️',
    canRetry: false,
  },
  UNCERTAIN_FOOD: {
    title: 'Unclear Photo',
    icon: '🤔',
    canRetry: true,
  },
  NUTRITION_UNAVAILABLE: {
    title: 'Nutrition Data Unavailable',
    icon: '📊',
    canRetry: true,
  },
  NETWORK_ERROR: {
    title: 'Connection Problem',
    icon: '📡',
    canRetry: true,
  },
  AI_FAILURE: {
    title: 'AI Service Unavailable',
    icon: '⚠️',
    canRetry: true,
  },
  SERVER_ERROR: {
    title: 'Server Error',
    icon: '⚠️',
    canRetry: true,
  },
  INVALID_IMAGE: {
    title: 'Invalid Image',
    icon: '🖼️',
    canRetry: false,
  },
};

export default function AnalysisScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { imageUri, captureMetadata } = useLocalSearchParams<{
    imageUri: string;
    captureMetadata?: string;
  }>();

  const { user, session } = useAuth();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  const [state, setState] = useState<AnalysisState>({
    kind: 'loading',
    stage: 'preparing',
  });

  // Auto-save successful scans for authenticated users
  useEffect(() => {
    if (state.kind === 'success' && user && session?.access_token && saveStatus === 'idle') {
      setSaveStatus('saving');

      const payload = formatAnalysisResultForSave(state.data, user.id);

      saveScanRecord(payload, session.access_token)
        .then(() => setSaveStatus('saved'))
        .catch((err) => {
          console.error('Scan auto-save failed:', err);
          setSaveStatus('error');
        });
    }
  }, [state, user, session, saveStatus]);

  const performAnalysis = useCallback(async () => {
    if (!imageUri) {
      setState({
        kind: 'error',
        code: 'INVALID_IMAGE',
        message: 'No image was provided for analysis.',
        details: 'Please return to the scan screen and select an image.',
      });
      return;
    }

    setState({ kind: 'loading', stage: 'preparing' });

    try {
      const result = await analyzeFoodImage(imageUri, (stage) => {
        setState({ kind: 'loading', stage });
      }, captureMetadata);

      // Handle empty results (no food detected)
      if (result.items.length === 0 || result.imageQuality === 'unrecognizable') {
        setState({
          kind: 'error',
          code: 'NO_FOOD_DETECTED',
          message: result.message || 'No food items could be detected in this photo.',
          details:
            'Try taking a clearer photo closer to your meal with good lighting. Make sure the food is in focus and well-lit.',
        });
        return;
      }

      // Handle poor image quality
      if (result.imageQuality === 'poor') {
        setState({
          kind: 'error',
          code: 'UNCERTAIN_FOOD',
          message: 'The photo quality was too low for confident food recognition.',
          details:
            'Try retaking the photo with better lighting, focus, and a closer view of the food. Avoid shadows, blurriness, or extreme angles.',
        });
        return;
      }

      setState({ kind: 'success', data: result });
    } catch (error) {
      if (error instanceof AnalyzeServiceError) {
        // Map service error codes to AnalysisErrorCode
        let errorCode: AnalysisErrorCode = 'SERVER_ERROR';
        if (error.code === 'NETWORK_ERROR') {
          errorCode = 'NETWORK_ERROR';
        } else if (error.code === 'INVALID_FORMAT' || error.code === 'FILE_NOT_FOUND') {
          errorCode = 'INVALID_IMAGE';
        } else if (error.code === 'AI_FAILURE') {
          errorCode = 'AI_FAILURE';
        }

        setState({
          kind: 'error',
          code: errorCode,
          message: error.message,
        });
      } else {
        setState({
          kind: 'error',
          code: 'SERVER_ERROR',
          message:
            error instanceof Error
              ? error.message
              : 'An unexpected error occurred during analysis.',
        });
      }
    }
  }, [imageUri]);

  useEffect(() => {
    setSaveStatus('idle');
    performAnalysis();
  }, [performAnalysis]);

  function handleGoBack(): void {
    router.back();
  }

  function handleScanAnother(): void {
    router.replace('/scan');
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* HEADER */}
        <View style={styles.header}>
          <Pressable
            onPress={handleGoBack}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ThemedText style={styles.backButtonText}>← Back</ThemedText>
          </Pressable>
          <ThemedText type="subtitle" style={styles.headerTitle}>
            Food Analysis
          </ThemedText>
          <View style={styles.headerSpacer} />
        </View>

        {/* LOADING STATE WITH 4-STAGE PROGRESS */}
        {state.kind === 'loading' && (
          <View style={styles.centered}>
            {imageUri ? (
              <Image
                source={{ uri: imageUri }}
                style={styles.loadingThumbnail}
                contentFit="cover"
              />
            ) : null}
            <ActivityIndicator size="large" color="#34C759" style={styles.spinner} />
            <ThemedText style={styles.loadingTitle}>
              {STAGE_LABELS[state.stage]}
            </ThemedText>

            {/* 4-Stage Progress Stepper */}
            <View style={styles.stageIndicator}>
              {(['preparing', 'analyzing', 'nutrition', 'finalizing'] as const).map(
                (stage, index) => {
                  const isActive = state.stage === stage;
                  const isPast =
                    ['preparing', 'analyzing', 'nutrition', 'finalizing'].indexOf(
                      state.stage
                    ) >
                    ['preparing', 'analyzing', 'nutrition', 'finalizing'].indexOf(stage);

                  return (
                    <View key={stage} style={styles.stageRow}>
                      <View
                        style={[
                          styles.stageDot,
                          isPast && styles.stageDotComplete,
                          isActive && styles.stageDotActive,
                        ]}
                      />
                      <ThemedText
                        style={[
                          styles.stageLabel,
                          (isActive || isPast) && styles.stageLabelActive,
                        ]}
                        themeColor={isActive || isPast ? 'text' : 'textSecondary'}
                      >
                        {STAGE_LABELS[stage]}
                      </ThemedText>
                    </View>
                  );
                }
              )}
            </View>
          </View>
        )}

        {/* ERROR STATE WITH TAILORED GUIDANCE */}
        {state.kind === 'error' && (
          <View style={styles.centered}>
            <ThemedText style={styles.errorIcon}>
              {ERROR_CONFIG[state.code].icon}
            </ThemedText>
            <ThemedText type="subtitle" style={styles.errorTitle}>
              {ERROR_CONFIG[state.code].title}
            </ThemedText>
            <ThemedText style={styles.errorMessage} themeColor="textSecondary">
              {state.message}
            </ThemedText>
            {state.details ? (
              <ThemedText style={styles.errorDetails} themeColor="textSecondary">
                {state.details}
              </ThemedText>
            ) : null}

            <View style={styles.actionButtonsRow}>
              {ERROR_CONFIG[state.code].canRetry && (
                <Pressable
                  onPress={performAnalysis}
                  style={({ pressed }) => [
                    styles.actionBtn,
                    styles.primaryActionBtn,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Retry analysis"
                >
                  <ThemedText style={styles.primaryActionBtnText}>Try Again</ThemedText>
                </Pressable>
              )}

              <Pressable
                onPress={handleScanAnother}
                style={({ pressed }) => [
                  styles.actionBtn,
                  ERROR_CONFIG[state.code].canRetry
                    ? { borderColor: theme.textSecondary, borderWidth: 1.5 }
                    : styles.primaryActionBtn,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Scan another photo"
              >
                <ThemedText
                  style={
                    ERROR_CONFIG[state.code].canRetry
                      ? undefined
                      : styles.primaryActionBtnText
                  }
                  themeColor={ERROR_CONFIG[state.code].canRetry ? 'textSecondary' : undefined}
                >
                  Scan Another
                </ThemedText>
              </Pressable>
            </View>
          </View>
        )}

        {/* SUCCESS STATE WITH FULL NUTRITION DATA */}
        {state.kind === 'success' && (
          <FlatList
            data={state.data.items}
            keyExtractor={(item, index) => `${item.canonicalName}-${index}`}
            renderItem={({ item }: { item: AnalyzedFoodItem }) => (
              <FoodItemCard item={item} />
            )}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={
              <View style={styles.listHeader}>
                {/* Photo Thumbnail & Summary Card */}
                <ThemedView type="backgroundElement" style={styles.summaryCard}>
                  {imageUri ? (
                    <Image
                      source={{ uri: imageUri }}
                      style={styles.summaryThumbnail}
                      contentFit="cover"
                      accessibilityLabel="Photo analyzed"
                    />
                  ) : null}
                  <View style={styles.summaryDetails}>
                    <ThemedText style={styles.summaryTitle}>
                      {state.data.items.length === 1
                        ? '1 Food Item Found'
                        : `${state.data.items.length} Food Items Found`}
                    </ThemedText>
                    <View style={styles.badgeRow}>
                      <View
                        style={[
                          styles.qualityBadge,
                          {
                            backgroundColor:
                              state.data.imageQuality === 'good'
                                ? '#34C759'
                                : state.data.imageQuality === 'poor'
                                ? '#FF9500'
                                : '#FF3B30',
                          },
                        ]}
                      >
                        <ThemedText style={styles.qualityBadgeText}>
                          {state.data.imageQuality === 'good'
                            ? 'Good Quality'
                            : state.data.imageQuality === 'poor'
                            ? 'Low Clarity'
                            : 'Unrecognizable'}
                        </ThemedText>
                      </View>

                      {user && (saveStatus === 'saving' || saveStatus === 'saved') && (
                        <View style={[styles.qualityBadge, { backgroundColor: saveStatus === 'saved' ? '#3C87F7' : '#8E8E93' }]}>
                          <ThemedText style={styles.qualityBadgeText}>
                            {saveStatus === 'saved' ? '✓ Saved' : 'Saving...'}
                          </ThemedText>
                        </View>
                      )}
                    </View>
                  </View>
                </ThemedView>

                {/* Optional Message from Vision Service */}
                {state.data.message ? (
                  <ThemedView type="backgroundElement" style={styles.messageBanner}>
                    <ThemedText style={styles.messageText} themeColor="textSecondary">
                      ℹ️ {state.data.message}
                    </ThemedText>
                  </ThemedView>
                ) : null}

                {/* Calibration Status Banner (Step 3) */}
                {state.data.calibration ? (
                  <ThemedView
                    type="backgroundElement"
                    style={[
                      styles.calibrationBanner,
                      {
                        borderLeftColor:
                          state.data.calibration.success ? '#34C759' : '#FF9500',
                      },
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.calibrationBannerText,
                        {
                          color: state.data.calibration.success ? '#34C759' : '#FF9500',
                        },
                      ]}
                    >
                      {state.data.calibration.success
                        ? `📐 Calibrated${
                            state.data.calibration.detectedMarker
                              ? ` (${state.data.calibration.detectedMarker.markerType})`
                              : ''
                          }`
                        : `⚠️ ${state.data.calibration.validationStatus || 'Calibration unavailable'}`}
                    </ThemedText>
                    {state.data.calibration.statusMessage ? (
                      <ThemedText
                        style={styles.calibrationStatusMessage}
                        themeColor="textSecondary"
                      >
                        {state.data.calibration.statusMessage}
                      </ThemedText>
                    ) : null}
                  </ThemedView>
                ) : null}

                <ThemedText style={styles.sectionTitle}>Nutrition Results</ThemedText>
              </View>
            }
            ListFooterComponent={
              <View style={styles.listFooter}>
                <Pressable
                  onPress={handleScanAnother}
                  style={({ pressed }) => [
                    styles.scanAnotherBtn,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Scan another food item"
                >
                  <ThemedText style={styles.scanAnotherBtnText}>
                    📷 Scan Another Food
                  </ThemedText>
                </Pressable>
              </View>
            }
          />
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  backButton: {
    paddingVertical: Spacing.two,
    paddingRight: Spacing.three,
  },
  backButtonText: {
    fontSize: 16,
  },
  headerTitle: {
    fontSize: 18,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 48,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  loadingThumbnail: {
    width: 140,
    height: 140,
    borderRadius: Spacing.three,
    marginBottom: Spacing.two,
  },
  spinner: {
    marginVertical: Spacing.two,
  },
  loadingTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  stageIndicator: {
    marginTop: Spacing.four,
    gap: Spacing.two,
    alignSelf: 'stretch',
    maxWidth: 300,
  },
  stageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  stageDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#8E8E93',
  },
  stageDotActive: {
    backgroundColor: '#34C759',
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  stageDotComplete: {
    backgroundColor: '#34C759',
  },
  stageLabel: {
    fontSize: 14,
  },
  stageLabelActive: {
    fontWeight: '600',
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
    fontSize: 15,
  },
  errorDetails: {
    textAlign: 'center',
    lineHeight: 20,
    fontSize: 13,
    fontStyle: 'italic',
    maxWidth: 320,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    marginTop: Spacing.four,
  },
  actionBtn: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  primaryActionBtn: {
    backgroundColor: '#34C759',
  },
  primaryActionBtnText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
  },
  listHeader: {
    marginBottom: Spacing.three,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.three,
    marginVertical: Spacing.three,
    gap: Spacing.three,
  },
  summaryThumbnail: {
    width: 70,
    height: 70,
    borderRadius: Spacing.two,
  },
  summaryDetails: {
    flex: 1,
    gap: Spacing.one,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qualityBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Spacing.one,
  },
  qualityBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  messageBanner: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    marginBottom: Spacing.three,
  },
  messageText: {
    fontSize: 13,
    lineHeight: 18,
  },
  calibrationBanner: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    marginBottom: Spacing.three,
    borderLeftWidth: 4,
  },
  calibrationBannerText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  calibrationStatusMessage: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: Spacing.one,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginVertical: Spacing.two,
  },
  listFooter: {
    marginTop: Spacing.four,
    marginBottom: Spacing.four,
  },
  scanAnotherBtn: {
    backgroundColor: '#34C759',
    paddingVertical: Spacing.three + Spacing.one,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  scanAnotherBtnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },
  pressed: {
    opacity: 0.7,
  },
});
