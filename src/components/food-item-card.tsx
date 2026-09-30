/**
 * Food Item Card Component
 *
 * Renders a single food item recognized by the AI vision service.
 * Displays:
 * - Food name & estimated portion badge
 * - Canonical lookup name
 * - Description
 * - Confidence score with colored indicator
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { FoodItem } from '@/types/food';

interface FoodItemCardProps {
  item: FoodItem;
}

export function FoodItemCard({ item }: FoodItemCardProps) {
  const theme = useTheme();

  const confidencePercent = Math.round(item.confidence * 100);

  // Confidence color styling
  let confidenceColor = '#34C759'; // Green (>= 90%)
  let confidenceLabel = 'High Confidence';

  if (item.confidence < 0.7) {
    confidenceColor = '#FF9500'; // Orange (< 70%)
    confidenceLabel = 'Uncertain';
  } else if (item.confidence < 0.9) {
    confidenceColor = '#FFCC00'; // Amber (70-89%)
    confidenceLabel = 'Medium Confidence';
  }

  return (
    <ThemedView
      type="backgroundElement"
      style={styles.card}
      accessibilityRole="summary"
      accessibilityLabel={`${item.name}, portion estimate ${item.estimatedPortion}, confidence ${confidencePercent} percent`}
    >
      {/* Header: Name and Portion Badge */}
      <View style={styles.headerRow}>
        <ThemedText style={styles.name}>
          {item.name}
        </ThemedText>
        <View style={[styles.portionBadge, { backgroundColor: theme.backgroundSelected }]}>
          <ThemedText style={styles.portionText}>
            ⚖️ {item.estimatedPortion}
          </ThemedText>
        </View>
      </View>

      {/* Canonical Name */}
      <ThemedText style={styles.canonicalName} themeColor="textSecondary">
        Canonical: {item.canonicalName}
      </ThemedText>

      {/* Description */}
      {item.description ? (
        <ThemedText style={styles.description}>
          {item.description}
        </ThemedText>
      ) : null}

      {/* Footer: Confidence indicator */}
      <View style={styles.footerRow}>
        <View style={styles.confidenceContainer}>
          <View style={[styles.confidenceDot, { backgroundColor: confidenceColor }]} />
          <ThemedText style={styles.confidenceText} themeColor="textSecondary">
            {confidencePercent}% confidence ({confidenceLabel})
          </ThemedText>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.four,
    borderRadius: Spacing.three,
    marginBottom: Spacing.three,
    gap: Spacing.two,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
    textTransform: 'capitalize',
    flexShrink: 1,
  },
  portionBadge: {
    paddingHorizontal: Spacing.two + Spacing.half,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.two,
  },
  portionText: {
    fontSize: 13,
    fontWeight: '500',
  },
  canonicalName: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.one,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150, 150, 150, 0.2)',
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  confidenceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  confidenceText: {
    fontSize: 12,
  },
});
