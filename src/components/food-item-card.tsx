/**
 * Food Item Card Component
 *
 * Renders a single analyzed food item with full nutrition data.
 * Displays:
 * - Food name, portion badge, and confidence indicator
 * - Calorie count prominently
 * - Macronutrients (protein, carbs, fat, fiber, sugar)
 * - Collapsible micronutrients section
 * - Educational highlight badges with regulatory references
 * - Nutrition status indicator (found, ambiguous, not_found, error)
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type {
  AnalyzedFoodItem,
  NutritionHighlight,
  Macronutrients,
  Micronutrients,
} from '@/types/food';

// Enable LayoutAnimation for Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface FoodItemCardProps {
  item: AnalyzedFoodItem;
}

export function FoodItemCard({ item }: FoodItemCardProps) {
  const theme = useTheme();
  const [showMicronutrients, setShowMicronutrients] = useState(false);

  const confidencePercent = Math.round(item.confidence * 100);

  // Confidence color styling
  let confidenceColor = '#34C759'; // Green (>= 90%)
  let confidenceLabel = 'High';

  if (item.confidence < 0.7) {
    confidenceColor = '#FF9500'; // Orange (< 70%)
    confidenceLabel = 'Low';
  } else if (item.confidence < 0.9) {
    confidenceColor = '#FFCC00'; // Amber (70-89%)
    confidenceLabel = 'Medium';
  }

  // Nutrition status styling
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'found':
        return '#34C759';
      case 'ambiguous':
        return '#FF9500';
      case 'not_found':
        return '#FF3B30';
      case 'unavailable':
        return '#8E8E93';
      case 'error':
        return '#FF3B30';
      default:
        return '#8E8E93';
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'found':
        return 'Nutrition Found';
      case 'ambiguous':
        return 'Multiple Matches';
      case 'not_found':
        return 'Not in Database';
      case 'unavailable':
        return 'Service Unavailable';
      case 'error':
        return 'Lookup Error';
      default:
        return 'Unknown';
    }
  };

  const toggleMicronutrients = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowMicronutrients(!showMicronutrients);
  };

  // Format nutrient value (null = "—")
  const formatValue = (value: number | null, unit: string = 'g'): string => {
    if (value === null) return '—';
    return `${value}${unit}`;
  };

  // Highlight level to color mapping
  const getHighlightColor = (level: string): string => {
    switch (level) {
      case 'high':
        return '#34C759'; // Green
      case 'good':
        return '#5AC8FA'; // Blue
      case 'low':
        return '#FF9500'; // Orange
      case 'info':
        return '#8E8E93'; // Gray
      default:
        return '#8E8E93';
    }
  };

  const hasNutrition = item.nutritionStatus === 'found' && item.nutrition;

  return (
    <ThemedView
      type="backgroundElement"
      style={styles.card}
      accessibilityRole="summary"
      accessibilityLabel={`${item.name}, ${item.estimatedPortion}, ${confidencePercent}% confidence`}
    >
      {/* Header: Name, Portion Badge, Confidence */}
      <View style={styles.headerRow}>
        <View style={styles.nameContainer}>
          <ThemedText style={styles.name}>{item.name}</ThemedText>
          <View
            style={[styles.portionBadge, { backgroundColor: theme.backgroundSelected }]}
          >
            <ThemedText style={styles.portionText}>⚖️ {item.estimatedPortion}</ThemedText>
          </View>
        </View>
        <View style={styles.confidenceBadge}>
          <View style={[styles.confidenceDot, { backgroundColor: confidenceColor }]} />
          <ThemedText style={styles.confidenceText}>{confidenceLabel}</ThemedText>
        </View>
      </View>

      {/* Status Indicator */}
      <View style={styles.statusRow}>
        <View
          style={[styles.statusDot, { backgroundColor: getStatusColor(item.nutritionStatus) }]}
        />
        <ThemedText style={styles.statusText} themeColor="textSecondary">
          {getStatusLabel(item.nutritionStatus)}
        </ThemedText>
      </View>

      {/* Error Message (if any) */}
      {item.errorMessage && (
        <ThemedView type="backgroundElement" style={styles.errorBanner}>
          <ThemedText style={styles.errorText} themeColor="textSecondary">
            ⚠️ {item.errorMessage}
          </ThemedText>
        </ThemedView>
      )}

      {/* Nutrition Data Section */}
      {hasNutrition && item.nutrition && (
        <>
          {/* Calories - Prominent Display */}
          <View style={styles.calorieSection}>
            <ThemedText style={styles.calorieLabel}>Calories</ThemedText>
            <ThemedText style={styles.calorieValue}>
              {formatValue(item.nutrition.calories, '')}
            </ThemedText>
            <ThemedText style={styles.servingText} themeColor="textSecondary">
              per {item.nutrition.servingSize}
              {item.nutrition.servingUnit}
            </ThemedText>
          </View>

          {/* Macronutrients Grid */}
          <View style={styles.macrosSection}>
            <ThemedText style={styles.sectionTitle}>Macronutrients</ThemedText>
            <View style={styles.macrosGrid}>
              {renderMacroItem('Protein', item.nutrition.macronutrients.protein)}
              {renderMacroItem('Carbs', item.nutrition.macronutrients.carbohydrates)}
              {renderMacroItem('Fat', item.nutrition.macronutrients.totalFat)}
              {renderMacroItem('Fiber', item.nutrition.macronutrients.fiber)}
              {renderMacroItem('Sugar', item.nutrition.macronutrients.sugar)}
              {renderMacroItem(
                'Sat. Fat',
                item.nutrition.macronutrients.saturatedFat
              )}
            </View>
          </View>

          {/* Micronutrients - Collapsible */}
          <Pressable
            onPress={toggleMicronutrients}
            style={styles.microToggle}
            accessibilityRole="button"
            accessibilityLabel={
              showMicronutrients ? 'Hide micronutrients' : 'Show micronutrients'
            }
          >
            <ThemedText style={styles.sectionTitle}>
              Micronutrients {showMicronutrients ? '▲' : '▼'}
            </ThemedText>
          </Pressable>

          {showMicronutrients && (
            <View style={styles.microsGrid}>
              {renderMicroItem('Sodium', item.nutrition.micronutrients.sodium, 'mg')}
              {renderMicroItem(
                'Potassium',
                item.nutrition.micronutrients.potassium,
                'mg'
              )}
              {renderMicroItem(
                'Calcium',
                item.nutrition.micronutrients.calcium,
                'mg'
              )}
              {renderMicroItem('Iron', item.nutrition.micronutrients.iron, 'mg')}
              {renderMicroItem(
                'Vitamin A',
                item.nutrition.micronutrients.vitaminA,
                'µg'
              )}
              {renderMicroItem(
                'Vitamin C',
                item.nutrition.micronutrients.vitaminC,
                'mg'
              )}
              {renderMicroItem(
                'Cholesterol',
                item.nutrition.micronutrients.cholesterol,
                'mg'
              )}
            </View>
          )}

          {/* Educational Highlights */}
          {item.highlights.length > 0 && (
            <View style={styles.highlightsSection}>
              <ThemedText style={styles.sectionTitle}>Highlights</ThemedText>
              {item.highlights.map((highlight, index) => (
                <View
                  key={`${highlight.nutrient}-${index}`}
                  style={[
                    styles.highlightBadge,
                    { borderColor: getHighlightColor(highlight.level) },
                  ]}
                >
                  <View
                    style={[
                      styles.highlightIndicator,
                      { backgroundColor: getHighlightColor(highlight.level) },
                    ]}
                  />
                  <View style={styles.highlightContent}>
                    <ThemedText style={styles.highlightText}>{highlight.text}</ThemedText>
                    <ThemedText style={styles.highlightRef} themeColor="textSecondary">
                      {highlight.referenceBasis}
                    </ThemedText>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Source Attribution */}
          <View style={styles.sourceSection}>
            <ThemedText style={styles.sourceText} themeColor="textSecondary">
              Source: {item.nutrition.source}
            </ThemedText>
            {item.nutrition.sourceUrl && (
              <ThemedText style={styles.sourceText} themeColor="textSecondary">
                🔗 {item.nutrition.sourceUrl}
              </ThemedText>
            )}
          </View>
        </>
      )}

      {/* Ambiguous Candidates */}
      {item.nutritionStatus === 'ambiguous' && item.candidates && item.candidates.length > 0 && (
        <View style={styles.candidatesSection}>
          <ThemedText style={styles.sectionTitle}>Possible Matches</ThemedText>
          {item.candidates.slice(0, 3).map((candidate, index) => (
            <View key={`${candidate.sourceId}-${index}`} style={styles.candidateItem}>
              <ThemedText style={styles.candidateName}>{candidate.foodName}</ThemedText>
              <ThemedText style={styles.candidateDesc} themeColor="textSecondary">
                {candidate.description}
              </ThemedText>
            </View>
          ))}
        </View>
      )}
    </ThemedView>
  );

  // Helper to render a single macro item
  function renderMacroItem(label: string, value: number | null): React.ReactElement {
    return (
      <View style={styles.macroItem}>
        <ThemedText style={styles.macroValue}>{formatValue(value)}</ThemedText>
        <ThemedText style={styles.macroLabel} themeColor="textSecondary">
          {label}
        </ThemedText>
      </View>
    );
  }

  // Helper to render a single micro item
  function renderMicroItem(
    label: string,
    value: number | null,
    unit: string
  ): React.ReactElement {
    return (
      <View style={styles.microItem}>
        <ThemedText style={styles.microLabel} themeColor="textSecondary">
          {label}
        </ThemedText>
        <ThemedText style={styles.microValue}>{formatValue(value, unit)}</ThemedText>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.four,
    borderRadius: Spacing.three,
    marginBottom: Spacing.three,
    gap: Spacing.three,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  nameContainer: {
    flex: 1,
    gap: Spacing.one,
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  portionBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Spacing.one,
  },
  portionText: {
    fontSize: 12,
    fontWeight: '500',
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.one,
    backgroundColor: 'rgba(142, 142, 147, 0.1)',
  },
  confidenceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
  },
  errorBanner: {
    padding: Spacing.two,
    borderRadius: Spacing.two,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
  },
  errorText: {
    fontSize: 13,
    lineHeight: 18,
  },
  calorieSection: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  calorieLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  calorieValue: {
    fontSize: 36,
    fontWeight: '700',
  },
  servingText: {
    fontSize: 12,
  },
  macrosSection: {
    gap: Spacing.two,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  macrosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  macroItem: {
    width: '30%',
    alignItems: 'center',
    padding: Spacing.two,
    borderRadius: Spacing.two,
    backgroundColor: 'rgba(142, 142, 147, 0.05)',
  },
  macroValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  macroLabel: {
    fontSize: 11,
    marginTop: Spacing.half,
  },
  microToggle: {
    paddingVertical: Spacing.one,
  },
  microsGrid: {
    gap: Spacing.two,
    paddingTop: Spacing.one,
  },
  microItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.one,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150, 150, 150, 0.2)',
  },
  microLabel: {
    fontSize: 13,
  },
  microValue: {
    fontSize: 13,
    fontWeight: '500',
  },
  highlightsSection: {
    gap: Spacing.two,
  },
  highlightBadge: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1.5,
    gap: Spacing.two,
  },
  highlightIndicator: {
    width: 4,
    height: '100%',
    minHeight: 20,
    borderRadius: 2,
  },
  highlightContent: {
    flex: 1,
    gap: Spacing.half,
  },
  highlightText: {
    fontSize: 13,
    fontWeight: '500',
  },
  highlightRef: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  sourceSection: {
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150, 150, 150, 0.2)',
    gap: Spacing.one,
  },
  sourceText: {
    fontSize: 11,
  },
  candidatesSection: {
    gap: Spacing.two,
  },
  candidateItem: {
    padding: Spacing.two,
    borderRadius: Spacing.two,
    backgroundColor: 'rgba(142, 142, 147, 0.05)',
    gap: Spacing.one,
  },
  candidateName: {
    fontSize: 14,
    fontWeight: '500',
  },
  candidateDesc: {
    fontSize: 12,
  },
});
