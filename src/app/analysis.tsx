/**
 * Analysis Screen — Displays AI Food Recognition Results.
 *
 * This screen:
 * 1. Receives the captured image URI from the scan screen via route params
 * 2. Uploads the image to the Next.js /api/scan endpoint
 * 3. Handles loading, error, empty, and success states
 * 4. Displays detected food items with portion estimates and confidence scores
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
import { useTheme } from '@/hooks/use-theme';
import { scanFoodImage } from '@/services/scan-service';
import type { FoodItem, FoodRecognitionResult } from '@/types/food';

type AnalysisState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string; code?: string }
  | { kind: 'success'; data: FoodRecognitionResult };

export default function AnalysisScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { imageUri } = useLocalSearchParams<{ imageUri: string }>();

  const [state, setState] = useState<AnalysisState>({ kind: 'loading' });

  const performAnalysis = useCallback(async () => {
    if (!imageUri) {
      setState({
        kind: 'error',
        message: 'No image was provided for analysis. Please return to the scan screen and select an image.',
        code: 'MISSING_IMAGE_URI',
      });
      return;
    }

    setState({ kind: 'loading' });

    try {
      const result = await scanFoodImage(imageUri);
      setState({ kind: 'success', data: result });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'An unexpected error occurred during analysis.';
      const code = (error as { code?: string })?.code;
      setState({ kind: 'error', message, code });
    }
  }, [imageUri]);

  useEffect(() => {
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
            Food Recognition
          </ThemedText>
          <View style={styles.headerSpacer} />
        </View>

        {/* LOADING STATE */}
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
              Analyzing Food Photo...
            </ThemedText>
            <ThemedText style={styles.loadingSubtitle} themeColor="textSecondary">
              Our AI vision service is identifying food items and estimating portions.
            </ThemedText>
          </View>
        )}

        {/* ERROR STATE */}
        {state.kind === 'error' && (
          <View style={styles.centered}>
            <ThemedText style={styles.errorIcon}>⚠️</ThemedText>
            <ThemedText type="subtitle" style={styles.errorTitle}>
              Recognition Failed
            </ThemedText>
            <ThemedText style={styles.errorMessage} themeColor="textSecondary">
              {state.message}
            </ThemedText>

            <View style={styles.actionButtonsRow}>
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

              <Pressable
                onPress={handleScanAnother}
                style={({ pressed }) => [
                  styles.actionBtn,
                  { borderColor: theme.textSecondary, borderWidth: 1.5 },
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Scan another photo"
              >
                <ThemedText themeColor="textSecondary">Scan Another</ThemedText>
              </Pressable>
            </View>
          </View>
        )}

        {/* SUCCESS STATE */}
        {state.kind === 'success' && (
          <FlatList
            data={state.data.items}
            keyExtractor={(item, index) => `${item.name}-${index}`}
            renderItem={({ item }: { item: FoodItem }) => <FoodItemCard item={item} />}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={
              <View style={styles.listHeader}>
                {/* Photo Thumbnail & Quality Card */}
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

                {/* Empty Items Message */}
                {state.data.items.length === 0 ? (
                  <View style={styles.emptyState}>
                    <ThemedText style={styles.emptyIcon}>🍽️</ThemedText>
                    <ThemedText style={styles.emptyTitle}>
                      No Food Detected
                    </ThemedText>
                    <ThemedText style={styles.emptyText} themeColor="textSecondary">
                      The AI model did not find any recognizable food in this photo. Try taking a clearer photo closer to your meal with good lighting.
                    </ThemedText>
                  </View>
                ) : (
                  <ThemedText style={styles.sectionTitle}>
                    Detected Items
                  </ThemedText>
                )}
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
                  <ThemedText style={styles.scanAnotherBtnText}>📷  Scan Another Food</ThemedText>
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
  loadingSubtitle: {
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginVertical: Spacing.two,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.five,
    gap: Spacing.two,
  },
  emptyIcon: {
    fontSize: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.four,
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
