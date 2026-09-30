import React from 'react';
import { StyleSheet, Text, View, Image, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { COLORS, SPACING, RADIUS } from '../constants/theme';
import { Button } from '../components/Button';

export default function ResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ imageUri?: string; foodName?: string }>();

  const foodName = params.foodName || 'Identified Food';
  const imageUri = params.imageUri;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Food Image (if passed) or Placeholder */}
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Text style={styles.placeholderEmoji}>🥗</Text>
        </View>
      )}

      {/* Main Info Card */}
      <View style={styles.card}>
        <Text style={styles.foodTitle}>{foodName}</Text>
        <Text style={styles.servingInfo}>Standard Serving: 100g (Estimated)</Text>

        {/* Highlight / Benefit Rule (Rule-based mockup) */}
        <View style={styles.highlightBadge}>
          <Text style={styles.highlightText}>🌱 High in Fiber & Healthy Fats</Text>
        </View>

        {/* Nutritional Facts Table */}
        <View style={styles.nutritionGrid}>
          <View style={styles.nutriTile}>
            <Text style={styles.nutriValue}>160</Text>
            <Text style={styles.nutriLabel}>Calories (kcal)</Text>
          </View>
          <View style={styles.nutriTile}>
            <Text style={styles.nutriValue}>2.0g</Text>
            <Text style={styles.nutriLabel}>Protein</Text>
          </View>
          <View style={styles.nutriTile}>
            <Text style={styles.nutriValue}>14.7g</Text>
            <Text style={styles.nutriLabel}>Total Fat</Text>
          </View>
          <View style={styles.nutriTile}>
            <Text style={styles.nutriValue}>8.5g</Text>
            <Text style={styles.nutriLabel}>Carbs</Text>
          </View>
        </View>

        {/* Educational / Non-Medical Disclaimer */}
        <View style={styles.disclaimerBox}>
          <Text style={styles.disclaimerText}>
            ℹ️ Source: USDA FoodData Central. For general informational and educational purposes only. Not intended as medical advice.
          </Text>
        </View>
      </View>

      <Button
        title="Scan Another Food"
        variant="primary"
        onPress={() => router.back()}
        style={styles.backButton}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.m,
  },
  image: {
    width: '100%',
    height: 220,
    borderRadius: RADIUS.l,
    marginBottom: SPACING.m,
  },
  imagePlaceholder: {
    width: '100%',
    height: 160,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.l,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.m,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  placeholderEmoji: {
    fontSize: 50,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    padding: SPACING.l,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.l,
  },
  foodTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  servingInfo: {
    fontSize: 14,
    color: COLORS.textLight,
    marginBottom: SPACING.m,
  },
  highlightBadge: {
    backgroundColor: '#E8F5E9',
    paddingVertical: SPACING.s,
    paddingHorizontal: SPACING.m,
    borderRadius: RADIUS.m,
    marginBottom: SPACING.m,
  },
  highlightText: {
    color: COLORS.primaryDark,
    fontWeight: '600',
    fontSize: 14,
  },
  nutritionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginVertical: SPACING.m,
  },
  nutriTile: {
    width: '48%',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.m,
    padding: SPACING.m,
    marginBottom: SPACING.s,
    alignItems: 'center',
  },
  nutriValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  nutriLabel: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 2,
  },
  disclaimerBox: {
    marginTop: SPACING.m,
    paddingTop: SPACING.m,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  disclaimerText: {
    fontSize: 12,
    color: COLORS.textLight,
    lineHeight: 16,
  },
  backButton: {
    marginBottom: SPACING.xl,
  },
});
