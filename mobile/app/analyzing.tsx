/**
 * Analyzing Screen
 *
 * Temporary loading screen shown while "analyzing" the food image.
 * In a future phase, this will call the backend AI service.
 * For now, it simulates a delay and navigates to the result screen.
 */

import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { COLORS, SPACING } from '../constants/theme';

export default function AnalyzingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ imageUri?: string }>();
  const [status, setStatus] = useState('Identifying food...');

  useEffect(() => {
    // Simulate the analysis workflow
    const simulateAnalysis = async () => {
      // Step 1: Food identification (simulated)
      await delay(1500);
      setStatus('Looking up nutrition data...');

      // Step 2: Nutrition lookup (simulated)
      await delay(1500);
      setStatus('Preparing results...');

      // Step 3: Navigate to result
      await delay(500);

      // Navigate to result screen with the image
      router.replace({
        pathname: '/result',
        params: {
          imageUri: params.imageUri,
          foodName: 'Sample Food', // Will come from AI in future
        },
      });
    };

    simulateAnalysis();
  }, [params.imageUri, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.title}>Analyzing Your Food</Text>
      <Text style={styles.status}>{status}</Text>
      <Text style={styles.hint}>This usually takes 3-5 seconds</Text>
    </View>
  );
}

/**
 * Simple delay helper for simulating async operations
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: SPACING.l,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: SPACING.l,
    marginBottom: SPACING.s,
  },
  status: {
    fontSize: 16,
    color: COLORS.textLight,
    marginBottom: SPACING.l,
  },
  hint: {
    fontSize: 14,
    color: COLORS.textLight,
    fontStyle: 'italic',
  },
});
