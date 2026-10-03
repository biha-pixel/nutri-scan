/**
 * Today's Summary Card Component
 *
 * Displays an aggregated nutrition summary for the current day:
 * - Total calories
 * - Macronutrients (protein, carbs, fat)
 * - Number of scans today
 *
 * Handles three states:
 * 1. Loading (shows skeleton placeholder)
 * 2. Empty (no scans today)
 * 3. Data (shows aggregated nutrition)
 *
 * DESIGN:
 * - Premium card with clean visual hierarchy
 * - Calories prominently displayed
 * - Macros in a horizontal row with icons
 * - Secondary text for scan count
 */

import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface TodaysSummaryCardProps {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  scanCount: number;
  isLoading: boolean;
}

export function TodaysSummaryCard({
  calories,
  protein,
  carbs,
  fat,
  scanCount,
  isLoading,
}: TodaysSummaryCardProps) {
  const theme = useTheme();

  const isEmpty = scanCount === 0 && !isLoading;

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.header}>
        <ThemedText style={styles.cardTitle}>Today's Nutrition</ThemedText>
        {!isEmpty && !isLoading && (
          <ThemedText style={styles.scanCount} themeColor="textSecondary">
            {scanCount} {scanCount === 1 ? 'scan' : 'scans'}
          </ThemedText>
        )}
      </View>

      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.textSecondary} />
          <ThemedText themeColor="textSecondary" style={styles.loadingText}>
            Loading...
          </ThemedText>
        </View>
      )}

      {isEmpty && (
        <View style={styles.emptyContainer}>
          <ThemedText style={styles.emptyIcon}>🍽️</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.emptyText}>
            No scans yet today
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.emptyHint}>
            Scan your first meal to start tracking
          </ThemedText>
        </View>
      )}

      {!isEmpty && !isLoading && (
        <>
          {/* Calories — Prominent Display */}
          <View style={styles.caloriesSection}>
            <ThemedText style={styles.caloriesValue}>
              {calories.toLocaleString()}
            </ThemedText>
            <ThemedText style={styles.caloriesLabel} themeColor="textSecondary">
              calories
            </ThemedText>
          </View>

          {/* Macronutrients Row */}
          <View style={styles.macrosRow}>
            <View style={styles.macroItem}>
              <View style={[styles.macroDot, { backgroundColor: '#FF6B6B' }]} />
              <View style={styles.macroContent}>
                <ThemedText style={styles.macroValue}>{protein}g</ThemedText>
                <ThemedText style={styles.macroLabel} themeColor="textSecondary">
                  Protein
                </ThemedText>
              </View>
            </View>

            <View style={styles.macroItem}>
              <View style={[styles.macroDot, { backgroundColor: '#4ECDC4' }]} />
              <View style={styles.macroContent}>
                <ThemedText style={styles.macroValue}>{carbs}g</ThemedText>
                <ThemedText style={styles.macroLabel} themeColor="textSecondary">
                  Carbs
                </ThemedText>
              </View>
            </View>

            <View style={styles.macroItem}>
              <View style={[styles.macroDot, { backgroundColor: '#FFD93D' }]} />
              <View style={styles.macroContent}>
                <ThemedText style={styles.macroValue}>{fat}g</ThemedText>
                <ThemedText style={styles.macroLabel} themeColor="textSecondary">
                  Fat
                </ThemedText>
              </View>
            </View>
          </View>
        </>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.four,
    borderRadius: Spacing.three,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  scanCount: {
    fontSize: 13,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.four,
  },
  loadingText: {
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.four,
    gap: Spacing.one,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: Spacing.one,
  },
  emptyText: {
    fontSize: 15,
  },
  emptyHint: {
    fontSize: 13,
  },
  caloriesSection: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  caloriesValue: {
    fontSize: 42,
    fontWeight: '700',
    lineHeight: 48,
  },
  caloriesLabel: {
    fontSize: 14,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  macrosRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150, 150, 150, 0.2)',
  },
  macroItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  macroDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  macroContent: {
    alignItems: 'flex-start',
  },
  macroValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  macroLabel: {
    fontSize: 11,
  },
});
