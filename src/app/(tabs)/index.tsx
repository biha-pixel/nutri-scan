/**
 * Home Screen — NutriScan Dashboard
 *
 * The main landing screen after launching the app.
 *
 * FEATURES:
 * 1. Personalized greeting based on time of day
 * 2. Primary "Scan Food" action button
 * 3. Today's nutrition summary (authenticated users only)
 * 4. Recent scans list (authenticated users only)
 * 5. Guest-user state prompting sign-in
 * 6. Pull-to-refresh
 *
 * STATES:
 * - Guest: Shows welcome + sign-in prompt + scan button
 * - Authenticated + Loading: Shows skeleton placeholders
 * - Authenticated + Error: Shows error with retry
 * - Authenticated + Empty: Shows "No scans yet" empty state
 * - Authenticated + Data: Shows full dashboard
 */

import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RecentScanCard } from '@/components/recent-scan-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TodaysSummaryCard } from '@/components/todays-summary-card';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTodaysNutrition } from '@/hooks/use-todays-nutrition';
import { useTheme } from '@/hooks/use-theme';
import { fetchScanHistory } from '@/services/history-service';
import type { SavedScan } from '@/types/food';

type RecentScansState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'success'; scans: SavedScan[] };

/**
 * Get a personalized greeting based on the current time of day.
 */
function getGreeting(name?: string): string {
  const hour = new Date().getHours();
  let timeOfDay = 'Hello';

  if (hour >= 5 && hour < 12) {
    timeOfDay = 'Good morning';
  } else if (hour >= 12 && hour < 17) {
    timeOfDay = 'Good afternoon';
  } else if (hour >= 17 && hour < 22) {
    timeOfDay = 'Good evening';
  } else {
    timeOfDay = 'Hello';
  }

  return name ? `${timeOfDay}, ${name}!` : `${timeOfDay}!`;
}

/**
 * Extract first name from email (fallback if we don't have a display name).
 */
function getFirstName(email: string): string {
  const username = email.split('@')[0];
  // Capitalize first letter
  return username.charAt(0).toUpperCase() + username.slice(1);
}

export default function HomeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { user, session } = useAuth();

  // Today's nutrition summary
  const todaysNutrition = useTodaysNutrition();

  // Recent scans (separate from today's summary for display)
  const [recentScansState, setRecentScansState] = useState<RecentScansState>({ kind: 'loading' });
  const [isRefreshing, setIsRefreshing] = useState(false);

  /**
   * Load recent scans for authenticated users.
   */
  const loadRecentScans = useCallback(async () => {
    if (!session?.access_token) {
      setRecentScansState({ kind: 'success', scans: [] });
      return;
    }

    try {
      const response = await fetchScanHistory({
        token: session.access_token,
        limit: 5, // Show up to 5 recent scans
        offset: 0,
      });

      setRecentScansState({ kind: 'success', scans: response.scans });
    } catch (error) {
      console.error('Failed to load recent scans:', error);
      setRecentScansState({
        kind: 'error',
        message: 'Could not load recent scans. Pull down to retry.',
      });
    }
  }, [session]);

  /**
   * Initial load on mount.
   */
  useEffect(() => {
    if (user) {
      loadRecentScans();
    } else {
      setRecentScansState({ kind: 'success', scans: [] });
    }
  }, [user, loadRecentScans]);

  /**
   * Handle pull-to-refresh.
   */
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([todaysNutrition.refresh(), loadRecentScans()]);
    setIsRefreshing(false);
  }, [todaysNutrition, loadRecentScans]);

  /**
   * Navigate to Scan screen.
   */
  const handleScanFood = () => {
    router.push('/(tabs)/scan');
  };

  /**
   * Navigate to History screen.
   */
  const handleViewAllHistory = () => {
    router.push('/(tabs)/history');
  };

  /**
   * Navigate to Sign In screen.
   */
  const handleSignIn = () => {
    router.push('/(auth)/sign-in');
  };

  /**
   * Navigate to Sign Up screen.
   */
  const handleSignUp = () => {
    router.push('/(auth)/sign-up');
  };

  const userName = user?.email ? getFirstName(user.email) : undefined;
  const greeting = getGreeting(userName);

  // ─── GUEST USER STATE ───────────────────────────────────────────────

  if (!user) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={false}
                onRefresh={() => {}}
                tintColor={theme.textSecondary}
              />
            }
          >
            {/* Header */}
            <View style={styles.headerSection}>
              <ThemedText type="title" style={styles.appTitle}>
                NutriScan
              </ThemedText>
              <ThemedText style={styles.greeting} themeColor="textSecondary">
                Welcome!
              </ThemedText>
            </View>

            {/* Primary Scan Action */}
            <Pressable
              onPress={handleScanFood}
              style={({ pressed }) => [
                styles.primaryActionButton,
                pressed && styles.buttonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Scan food"
            >
              <ThemedText style={styles.primaryActionText}>📷  Scan Food</ThemedText>
            </Pressable>

            {/* Guest Info Card */}
            <ThemedView type="backgroundElement" style={styles.guestInfoCard}>
              <ThemedText style={styles.guestInfoIcon}>👋</ThemedText>
              <ThemedText style={styles.guestInfoTitle}>Track Your Nutrition</ThemedText>
              <ThemedText style={styles.guestInfoText} themeColor="textSecondary">
                Sign in to save your scans, track daily nutrition totals, and access your scan
                history from any device.
              </ThemedText>

              <View style={styles.guestButtonGroup}>
                <Pressable
                  onPress={handleSignIn}
                  style={({ pressed }) => [
                    styles.guestSignInButton,
                    pressed && styles.buttonPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Sign in"
                >
                  <ThemedText style={styles.guestSignInButtonText}>Sign In</ThemedText>
                </Pressable>

                <Pressable
                  onPress={handleSignUp}
                  style={({ pressed }) => [
                    styles.guestSignUpButton,
                    { borderColor: theme.textSecondary },
                    pressed && styles.buttonPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Create account"
                >
                  <ThemedText themeColor="textSecondary">Create Account</ThemedText>
                </Pressable>
              </View>
            </ThemedView>

            {/* Guest Explainer */}
            <ThemedText style={styles.guestExplainer} themeColor="textSecondary">
              You can still scan food without an account. Your scans just won't be saved.
            </ThemedText>
          </ScrollView>
        </SafeAreaView>
      </ThemedView>
    );
  }

  // ─── AUTHENTICATED USER STATE ───────────────────────────────────────

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={theme.textSecondary}
            />
          }
        >
          {/* Header */}
          <View style={styles.headerSection}>
            <ThemedText type="title" style={styles.appTitle}>
              NutriScan
            </ThemedText>
            <ThemedText style={styles.greeting} themeColor="textSecondary">
              {greeting}
            </ThemedText>
          </View>

          {/* Primary Scan Action */}
          <Pressable
            onPress={handleScanFood}
            style={({ pressed }) => [styles.primaryActionButton, pressed && styles.buttonPressed]}
            accessibilityRole="button"
            accessibilityLabel="Scan food"
          >
            <ThemedText style={styles.primaryActionText}>📷  Scan Food</ThemedText>
          </Pressable>

          {/* Today's Summary Card */}
          <TodaysSummaryCard
            calories={todaysNutrition.calories}
            protein={todaysNutrition.protein}
            carbs={todaysNutrition.carbs}
            fat={todaysNutrition.fat}
            scanCount={todaysNutrition.scanCount}
            isLoading={todaysNutrition.isLoading}
          />

          {/* Error State for Today's Summary */}
          {todaysNutrition.error && (
            <ThemedView type="backgroundElement" style={styles.errorBanner}>
              <ThemedText style={styles.errorText} themeColor="textSecondary">
                ⚠️ {todaysNutrition.error}
              </ThemedText>
              <Pressable
                onPress={todaysNutrition.refresh}
                style={({ pressed }) => [styles.retryButton, pressed && styles.buttonPressed]}
                accessibilityRole="button"
                accessibilityLabel="Retry loading"
              >
                <ThemedText style={styles.retryButtonText}>Retry</ThemedText>
              </Pressable>
            </ThemedView>
          )}

          {/* Recent Scans Section */}
          <View style={styles.recentScansSection}>
            <View style={styles.sectionHeader}>
              <ThemedText style={styles.sectionTitle}>Recent Scans</ThemedText>
              {recentScansState.kind === 'success' && recentScansState.scans.length > 0 && (
                <Pressable
                  onPress={handleViewAllHistory}
                  style={({ pressed }) => [styles.viewAllButton, pressed && styles.buttonPressed]}
                  accessibilityRole="button"
                  accessibilityLabel="View all scan history"
                >
                  <ThemedText style={styles.viewAllText} themeColor="textSecondary">
                    View All →
                  </ThemedText>
                </Pressable>
              )}
            </View>

            {/* Loading State */}
            {recentScansState.kind === 'loading' && (
              <View style={styles.recentScansLoading}>
                <ActivityIndicator size="small" color={theme.textSecondary} />
                <ThemedText themeColor="textSecondary" style={styles.loadingText}>
                  Loading recent scans...
                </ThemedText>
              </View>
            )}

            {/* Error State */}
            {recentScansState.kind === 'error' && (
              <ThemedView type="backgroundElement" style={styles.errorCard}>
                <ThemedText themeColor="textSecondary">{recentScansState.message}</ThemedText>
              </ThemedView>
            )}

            {/* Empty State */}
            {recentScansState.kind === 'success' && recentScansState.scans.length === 0 && (
              <ThemedView type="backgroundElement" style={styles.emptyCard}>
                <ThemedText style={styles.emptyIcon}>📋</ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                  No scans yet
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.emptyHint}>
                  Scan your first meal to get started
                </ThemedText>
              </ThemedView>
            )}

            {/* Recent Scans List */}
            {recentScansState.kind === 'success' && recentScansState.scans.length > 0 && (
              <View style={styles.recentScansList}>
                {recentScansState.scans.map((scan) => (
                  <RecentScanCard key={scan.id} scan={scan} />
                ))}
              </View>
            )}
          </View>
        </ScrollView>
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
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.six,
    maxWidth: MaxContentWidth,
    width: '100%',
    gap: Spacing.four,
  },
  headerSection: {
    gap: Spacing.one,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  greeting: {
    fontSize: 16,
  },
  primaryActionButton: {
    backgroundColor: '#34C759',
    paddingVertical: Spacing.four,
    borderRadius: Spacing.three,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryActionText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  buttonPressed: {
    opacity: 0.7,
  },
  errorBanner: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    gap: Spacing.two,
    borderLeftWidth: 3,
    borderLeftColor: '#FF9500',
  },
  errorText: {
    fontSize: 13,
  },
  retryButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.one,
    backgroundColor: '#FF9500',
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  recentScansSection: {
    gap: Spacing.three,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  viewAllButton: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '500',
  },
  recentScansLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.four,
  },
  loadingText: {
    fontSize: 14,
  },
  errorCard: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  emptyCard: {
    padding: Spacing.four,
    borderRadius: Spacing.three,
    alignItems: 'center',
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
  recentScansList: {
    gap: Spacing.two,
  },
  // Guest-specific styles
  guestInfoCard: {
    padding: Spacing.four,
    borderRadius: Spacing.three,
    alignItems: 'center',
    gap: Spacing.three,
  },
  guestInfoIcon: {
    fontSize: 48,
  },
  guestInfoTitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  guestInfoText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  guestButtonGroup: {
    gap: Spacing.two,
    width: '100%',
    maxWidth: 280,
    marginTop: Spacing.two,
  },
  guestSignInButton: {
    backgroundColor: '#3c87f7',
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  guestSignInButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  guestSignUpButton: {
    borderWidth: 1.5,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  guestExplainer: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
