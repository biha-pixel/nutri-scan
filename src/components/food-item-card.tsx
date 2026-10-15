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

import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  LayoutAnimation,
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
  NutritionData,
} from '@/types/food';

interface FoodItemCardProps {
  item: AnalyzedFoodItem;
}

/**
 * Helper: Scale nutrition data to a different portion size
 * Maintains proportional relationships between all nutrients
 */
function scaleNutrition(
  nutrition: NutritionData,
  targetGrams: number
): NutritionData {
  const baseSizeGrams = nutrition.servingSize || 100;
  const scaleFactor = targetGrams / baseSizeGrams;

  return {
    ...nutrition,
    servingSize: targetGrams,
    calories: nutrition.calories ? Math.round(nutrition.calories * scaleFactor) : null,
    macronutrients: {
      protein: nutrition.macronutrients.protein
        ? Math.round(nutrition.macronutrients.protein * scaleFactor * 10) / 10
        : null,
      totalFat: nutrition.macronutrients.totalFat
        ? Math.round(nutrition.macronutrients.totalFat * scaleFactor * 10) / 10
        : null,
      saturatedFat: nutrition.macronutrients.saturatedFat
        ? Math.round(nutrition.macronutrients.saturatedFat * scaleFactor * 10) / 10
        : null,
      carbohydrates: nutrition.macronutrients.carbohydrates
        ? Math.round(nutrition.macronutrients.carbohydrates * scaleFactor * 10) / 10
        : null,
      fiber: nutrition.macronutrients.fiber
        ? Math.round(nutrition.macronutrients.fiber * scaleFactor * 10) / 10
        : null,
      sugar: nutrition.macronutrients.sugar
        ? Math.round(nutrition.macronutrients.sugar * scaleFactor * 10) / 10
        : null,
    },
    micronutrients: {
      sodium: nutrition.micronutrients.sodium
        ? Math.round(nutrition.micronutrients.sodium * scaleFactor * 10) / 10
        : null,
      cholesterol: nutrition.micronutrients.cholesterol
        ? Math.round(nutrition.micronutrients.cholesterol * scaleFactor * 10) / 10
        : null,
      potassium: nutrition.micronutrients.potassium
        ? Math.round(nutrition.micronutrients.potassium * scaleFactor * 10) / 10
        : null,
      vitaminA: nutrition.micronutrients.vitaminA
        ? Math.round(nutrition.micronutrients.vitaminA * scaleFactor * 10) / 10
        : null,
      vitaminC: nutrition.micronutrients.vitaminC
        ? Math.round(nutrition.micronutrients.vitaminC * scaleFactor * 10) / 10
        : null,
      calcium: nutrition.micronutrients.calcium
        ? Math.round(nutrition.micronutrients.calcium * scaleFactor * 10) / 10
        : null,
      iron: nutrition.micronutrients.iron
        ? Math.round(nutrition.micronutrients.iron * scaleFactor * 10) / 10
        : null,
    },
  };
}

export function FoodItemCard({ item }: FoodItemCardProps) {
  const theme = useTheme();
  const [showMicronutrients, setShowMicronutrients] = useState(false);

  // Step 3: Portion adjuster state
  const initialGrams = item.nutrition?.servingSize ?? item.estimatedGrams ?? 150;
  const [adjustedGrams, setAdjustedGrams] = useState(initialGrams);

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

  // Step 3: Memoized scaled nutrition (recalculates when adjustedGrams changes)
  const scaledNutrition = useMemo(() => {
    if (!hasNutrition || !item.nutrition) return null;
    return scaleNutrition(item.nutrition, adjustedGrams);
  }, [adjustedGrams, hasNutrition, item.nutrition]);

  // Step 3: Handler functions for portion adjustment
  const handleAdjustGrams = (delta: number) => {
    const newGrams = Math.max(5, Math.min(2000, adjustedGrams + delta));
    setAdjustedGrams(newGrams);
  };

  const handleReset = () => {
    setAdjustedGrams(initialGrams);
  };

  // Helper: Get confidence label for estimation method
  const getEstimationConfidence = (): string => {
    const method = item.estimationMethod || '';
    if (method.includes('calibrated')) return 'High Confidence';
    if (method.includes('visual')) return 'Medium Confidence';
    return 'Low Confidence';
  };

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
      {hasNutrition && item.nutrition && scaledNutrition && (
        <>
          {/* Step 3: Portion Adjuster Section */}
          <ThemedView type="backgroundElement" style={styles.portionAdjusterSection}>
            <View style={styles.portionAdjusterHeader}>
              <View style={styles.estimatedPortionInfo}>
                <ThemedText style={styles.portionEstimateLabel}>Estimated Portion</ThemedText>
                <ThemedText style={styles.portionEstimateValue}>
                  {item.estimatedGrams}g {item.uncertaintyGrams ? `±${item.uncertaintyGrams}g` : ''}
                </ThemedText>
                <ThemedText style={styles.estimationMethodLabel} themeColor="textSecondary">
                  {getEstimationConfidence()}
                </ThemedText>
              </View>
            </View>

            <View style={styles.portionAdjustmentControls}>
              <Pressable
                onPress={() => handleAdjustGrams(-25)}
                style={({ pressed }) => [
                  styles.adjustButton,
                  pressed && styles.adjustButtonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Decrease portion by 25 grams"
              >
                <ThemedText style={styles.adjustButtonText}>−25g</ThemedText>
              </Pressable>

              <Pressable
                onPress={() => handleAdjustGrams(-5)}
                style={({ pressed }) => [
                  styles.adjustButton,
                  pressed && styles.adjustButtonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Decrease portion by 5 grams"
              >
                <ThemedText style={styles.adjustButtonText}>−5g</ThemedText>
              </Pressable>

              <ThemedText style={styles.currentGramsDisplay}>{adjustedGrams}g</ThemedText>

              <Pressable
                onPress={() => handleAdjustGrams(5)}
                style={({ pressed }) => [
                  styles.adjustButton,
                  pressed && styles.adjustButtonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Increase portion by 5 grams"
              >
                <ThemedText style={styles.adjustButtonText}>+5g</ThemedText>
              </Pressable>

              <Pressable
                onPress={() => handleAdjustGrams(25)}
                style={({ pressed }) => [
                  styles.adjustButton,
                  pressed && styles.adjustButtonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Increase portion by 25 grams"
              >
                <ThemedText style={styles.adjustButtonText}>+25g</ThemedText>
              </Pressable>
            </View>

            {adjustedGrams !== initialGrams && (
              <Pressable
                onPress={handleReset}
                style={({ pressed }) => [
                  styles.resetButton,
                  pressed && styles.resetButtonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Reset to AI estimate ${initialGrams} grams`}
              >
                <ThemedText style={styles.resetButtonText}>
                  ↻ Reset to {initialGrams}g
                </ThemedText>
              </Pressable>
            )}
          </ThemedView>

          {/* Calories - Prominent Display */}
          <View style={styles.calorieSection}>
            <ThemedText style={styles.calorieLabel}>Calories</ThemedText>
            <ThemedText style={styles.calorieValue}>
              {formatValue(scaledNutrition.calories, '')}
            </ThemedText>
            <ThemedText style={styles.servingText} themeColor="textSecondary">
              per {scaledNutrition.servingSize}
              {scaledNutrition.servingUnit}
            </ThemedText>
          </View>

          {/* Macronutrients Grid */}
          <View style={styles.macrosSection}>
            <ThemedText style={styles.sectionTitle}>Macronutrients</ThemedText>
            <View style={styles.macrosGrid}>
              {renderMacroItem('Protein', scaledNutrition.macronutrients.protein)}
              {renderMacroItem('Carbs', scaledNutrition.macronutrients.carbohydrates)}
              {renderMacroItem('Fat', scaledNutrition.macronutrients.totalFat)}
              {renderMacroItem('Fiber', scaledNutrition.macronutrients.fiber)}
              {renderMacroItem('Sugar', scaledNutrition.macronutrients.sugar)}
              {renderMacroItem(
                'Sat. Fat',
                scaledNutrition.macronutrients.saturatedFat
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
              {renderMicroItem('Sodium', scaledNutrition.micronutrients.sodium, 'mg')}
              {renderMicroItem(
                'Potassium',
                scaledNutrition.micronutrients.potassium,
                'mg'
              )}
              {renderMicroItem(
                'Calcium',
                scaledNutrition.micronutrients.calcium,
                'mg'
              )}
              {renderMicroItem('Iron', scaledNutrition.micronutrients.iron, 'mg')}
              {renderMicroItem(
                'Vitamin A',
                scaledNutrition.micronutrients.vitaminA,
                'µg'
              )}
              {renderMicroItem(
                'Vitamin C',
                scaledNutrition.micronutrients.vitaminC,
                'mg'
              )}
              {renderMicroItem(
                'Cholesterol',
                scaledNutrition.micronutrients.cholesterol,
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
  portionAdjusterSection: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    marginBottom: Spacing.three,
    gap: Spacing.two,
  },
  portionAdjusterHeader: {
    marginBottom: Spacing.two,
  },
  estimatedPortionInfo: {
    gap: Spacing.one,
  },
  portionEstimateLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  portionEstimateValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  estimationMethodLabel: {
    fontSize: 11,
  },
  portionAdjustmentControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
  },
  adjustButton: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.one,
    backgroundColor: '#5AC8FA',
  },
  adjustButtonPressed: {
    opacity: 0.7,
  },
  adjustButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 12,
  },
  currentGramsDisplay: {
    fontSize: 14,
    fontWeight: '600',
    minWidth: 50,
    textAlign: 'center',
  },
  resetButton: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
    alignItems: 'center',
  },
  resetButtonPressed: {
    opacity: 0.7,
  },
  resetButtonText: {
    color: '#34C759',
    fontWeight: '600',
    fontSize: 13,
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
