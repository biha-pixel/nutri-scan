/**
 * Custom Hook: useTodaysNutrition
 *
 * Fetches the authenticated user's scan history and calculates today's
 * aggregated nutrition totals (calories, protein, carbs, fat).
 *
 * WHAT THIS HOOK DOES:
 * 1. Fetches scan history using the existing history service
 * 2. Filters scans to only those created today (same calendar date in user's timezone)
 * 3. Aggregates nutrition values across all food items in today's scans
 * 4. Handles null values (treats as 0 for aggregation)
 * 5. Provides loading, error, and refresh states
 *
 * USAGE:
 *   const { calories, protein, carbs, fat, scanCount, isLoading, error, refresh } = useTodaysNutrition();
 *
 * RETURNS:
 *   - calories: Total calories today (number)
 *   - protein: Total protein in grams (number)
 *   - carbs: Total carbohydrates in grams (number)
 *   - fat: Total fat in grams (number)
 *   - scanCount: Number of scans today (number)
 *   - isLoading: Whether data is being fetched (boolean)
 *   - error: Error message if fetch failed (string | null)
 *   - refresh: Function to manually refresh the data
 */

import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/contexts/auth-context';
import { fetchScanHistory } from '@/services/history-service';
import type { SavedScan } from '@/types/food';

interface TodaysNutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  scanCount: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useTodaysNutrition(): TodaysNutrition {
  const { session } = useAuth();
  const [calories, setCalories] = useState(0);
  const [protein, setProtein] = useState(0);
  const [carbs, setCarbs] = useState(0);
  const [fat, setFat] = useState(0);
  const [scanCount, setScanCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Check if a scan was created today (same calendar date in user's timezone).
   */
  const isToday = (dateString: string): boolean => {
    const scanDate = new Date(dateString);
    const today = new Date();

    return (
      scanDate.getFullYear() === today.getFullYear() &&
      scanDate.getMonth() === today.getMonth() &&
      scanDate.getDate() === today.getDate()
    );
  };

  /**
   * Aggregate nutrition values from today's scans.
   */
  const calculateTodaysNutrition = (scans: SavedScan[]) => {
    const todaysScans = scans.filter((scan) => isToday(scan.createdAt));

    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;

    todaysScans.forEach((scan) => {
      scan.items.forEach((item) => {
        // Treat null as 0 for aggregation
        totalCalories += item.nutrients?.calories ?? 0;
        totalProtein += item.nutrients?.macronutrients?.protein ?? 0;
        totalCarbs += item.nutrients?.macronutrients?.carbohydrates ?? 0;
        totalFat += item.nutrients?.macronutrients?.totalFat ?? 0;
      });
    });

    setCalories(Math.round(totalCalories));
    setProtein(Math.round(totalProtein));
    setCarbs(Math.round(totalCarbs));
    setFat(Math.round(totalFat));
    setScanCount(todaysScans.length);
  };

  /**
   * Fetch scan history and calculate today's totals.
   */
  const loadTodaysNutrition = useCallback(async () => {
    if (!session?.access_token) {
      // Guest user — reset to zeros
      setCalories(0);
      setProtein(0);
      setCarbs(0);
      setFat(0);
      setScanCount(0);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch enough scans to cover today (limit to 50 to avoid over-fetching)
      const response = await fetchScanHistory({
        token: session.access_token,
        limit: 50,
        offset: 0,
      });

      calculateTodaysNutrition(response.scans);
    } catch (err) {
      console.error('Failed to load today\'s nutrition:', err);
      setError('Could not load today\'s nutrition data.');
      // Reset to zeros on error
      setCalories(0);
      setProtein(0);
      setCarbs(0);
      setFat(0);
      setScanCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  /**
   * Load data on mount and whenever session changes.
   */
  useEffect(() => {
    loadTodaysNutrition();
  }, [loadTodaysNutrition]);

  return {
    calories,
    protein,
    carbs,
    fat,
    scanCount,
    isLoading,
    error,
    refresh: loadTodaysNutrition,
  };
}
