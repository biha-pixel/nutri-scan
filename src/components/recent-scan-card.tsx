/**
 * Recent Scan Card Component
 *
 * A compact variant of FoodItemCard for displaying recent scans on the Home screen.
 *
 * Displays:
 * - Primary food name (first item in the scan)
 * - Total calories for the scan
 * - Number of additional items if multi-food scan
 * - Relative timestamp (e.g., "2 hours ago")
 *
 * DESIGN:
 * - Compact card (less padding than full FoodItemCard)
 * - Horizontal layout: food info on left, calories badge on right
 * - Single-line food name with ellipsis
 * - Subtle border and background
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import type { SavedScan } from '@/types/food';

interface RecentScanCardProps {
  scan: SavedScan;
}

/**
 * Format a timestamp as a relative time string (e.g., "2 hours ago", "Just now")
 */
function formatRelativeTime(dateString: string): string {
  const now = new Date();
  const scanDate = new Date(dateString);
  const diffMs = now.getTime() - scanDate.getTime();
  const diffMinutes = Math.floor(diffMs / 1000 / 60);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  // Fallback to date string for older scans
  return scanDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function RecentScanCard({ scan }: RecentScanCardProps) {
  const mainFood = scan.items[0];
  const foodName = mainFood?.foodName || 'Unknown Food';
  const totalCalories = scan.items.reduce((sum, item) => sum + (item.nutrients?.calories ?? 0), 0);
  const additionalCount = scan.items.length - 1;
  const relativeTime = formatRelativeTime(scan.createdAt);

  return (
    <ThemedView
      type="backgroundElement"
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={`Scan of ${foodName}, ${Math.round(totalCalories)} calories, ${relativeTime}`}
    >
      <View style={styles.content}>
        <View style={styles.foodInfo}>
          <ThemedText style={styles.foodName} numberOfLines={1} ellipsizeMode="tail">
            {foodName}
          </ThemedText>
          {additionalCount > 0 && (
            <ThemedText style={styles.additionalItems} themeColor="textSecondary">
              +{additionalCount} other {additionalCount === 1 ? 'item' : 'items'}
            </ThemedText>
          )}
          <ThemedText style={styles.timestamp} themeColor="textSecondary">
            {relativeTime}
          </ThemedText>
        </View>

        <View style={styles.calorieBadge}>
          <ThemedText style={styles.calorieValue}>{Math.round(totalCalories)}</ThemedText>
          <ThemedText style={styles.calorieUnit}>kcal</ThemedText>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: 'rgba(150, 150, 150, 0.1)',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  foodInfo: {
    flex: 1,
    gap: 2,
  },
  foodName: {
    fontSize: 15,
    fontWeight: '600',
  },
  additionalItems: {
    fontSize: 12,
  },
  timestamp: {
    fontSize: 12,
    marginTop: 2,
  },
  calorieBadge: {
    backgroundColor: '#e0edff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 50,
  },
  calorieValue: {
    color: '#1a56db',
    fontWeight: '700',
    fontSize: 14,
  },
  calorieUnit: {
    color: '#1a56db',
    fontSize: 10,
  },
});
