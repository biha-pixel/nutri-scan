/**
 * History Tab Screen
 *
 * Shows the user's scan history if they are signed in, or prompts
 * them to sign in / create an account if they are a guest.
 *
 * WHY TWO STATES?
 * Our app allows anonymous scanning (guests can scan food without an account).
 * But scan history is a feature that requires authentication — we need to know
 * WHO the history belongs to. So this screen has two modes:
 *
 * 1. SIGNED IN → Shows the user's saved scan history (placeholder for now,
 *    until we build the Supabase scan_history table and backend endpoint).
 * 2. GUEST → Shows a friendly prompt explaining why signing in is needed,
 *    with buttons to sign in or create an account.
 *
 * AUTHORIZATION NOTE:
 * Even though the UI only shows the current user's history, the real protection
 * is Row Level Security (RLS) on the database. Even if someone tried to access
 * another user's scans via the API, Supabase would block it at the database level.
 * The UI is convenience; RLS is security.
 */

import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { deleteScanRecord, fetchScanHistory } from '@/services/history-service';
import type { SavedScan } from '@/types/food';

export default function HistoryScreen() {
  const { user, session, signOut } = useAuth();
  const [scans, setScans] = useState<SavedScan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const LIMIT = 20;

  const loadHistory = useCallback(
    async (isRefresh = false) => {
      if (!session?.access_token) return;

      try {
        const currentOffset = isRefresh ? 0 : offset;
        if (isRefresh) {
          setIsRefreshing(true);
        } else if (currentOffset === 0) {
          setIsLoading(true);
        }

        const response = await fetchScanHistory({
          token: session.access_token,
          limit: LIMIT,
          offset: currentOffset,
        });

        if (isRefresh) {
          setScans(response.scans);
          setOffset(LIMIT);
        } else {
          setScans((prev) => [...prev, ...response.scans]);
          setOffset((prev) => prev + LIMIT);
        }

        setHasMore(response.hasMore);
      } catch (error) {
        console.error('Failed to load scan history:', error);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [session, offset]
  );

  useEffect(() => {
    if (user && session) {
      loadHistory(true);
    }
  }, [user, session]);

  const handleDelete = (id: string) => {
    Alert.alert('Delete Scan', 'Are you sure you want to delete this scan from your history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!session?.access_token) return;
          try {
            await deleteScanRecord(id, session.access_token);
            setScans((prev) => prev.filter((scan) => scan.id !== id));
          } catch (error) {
            console.error('Delete failed:', error);
            Alert.alert('Error', 'Failed to delete scan.');
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: SavedScan }) => {
    const mainFood = item.items[0];
    const foodName = mainFood?.foodName || 'Unknown Food';
    const totalCalories = item.items.reduce((sum, i) => sum + (i.nutrients?.calories || 0), 0);
    const dateFormatted = new Date(item.createdAt).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    return (
      <ThemedView type="backgroundElement" style={styles.historyCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardMain}>
            <ThemedText style={styles.cardTitle}>{foodName}</ThemedText>
            {item.items.length > 1 && (
              <ThemedText type="small" themeColor="textSecondary">
                +{item.items.length - 1} other item{item.items.length > 2 ? 's' : ''}
              </ThemedText>
            )}
            <ThemedText type="small" themeColor="textSecondary" style={styles.cardDate}>
              {dateFormatted}
            </ThemedText>
          </View>
          <View style={styles.calorieBadge}>
            <ThemedText style={styles.calorieText}>{totalCalories}</ThemedText>
            <ThemedText style={styles.calorieUnit}>kcal</ThemedText>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <Pressable
            onPress={() => handleDelete(item.id)}
            style={({ pressed }) => [styles.deleteBtn, pressed && styles.buttonPressed]}
            accessibilityRole="button"
            accessibilityLabel={`Delete scan of ${foodName}`}
          >
            <ThemedText type="small" style={styles.deleteBtnText}>
              Delete
            </ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    );
  };

  // ─── Guest View: prompt to sign in ────────────────────────────────

  if (!user) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.centeredContent}>
            <ThemedText type="subtitle" style={styles.centeredText}>
              Scan History
            </ThemedText>
            <ThemedText
              themeColor="textSecondary"
              style={styles.centeredText}
            >
              Sign in to save your scans and access them anytime.
            </ThemedText>
            <View style={styles.buttonGroup}>
              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => router.push('/(auth)/sign-in')}
                accessibilityRole="button"
                accessibilityLabel="Sign in"
              >
                <ThemedText style={styles.primaryButtonText}>
                  Sign In
                </ThemedText>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => router.push('/(auth)/sign-up')}
                accessibilityRole="button"
                accessibilityLabel="Create account"
              >
                <ThemedText style={styles.secondaryButtonText}>
                  Create Account
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  // ─── Authenticated View: show scan history ────────────────────────

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header with user info and sign out */}
        <View style={styles.header}>
          <View>
            <ThemedText type="subtitle">History</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {user.email}
            </ThemedText>
          </View>
          <Pressable
            onPress={async () => {
              await signOut();
            }}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            style={({ pressed }) => [
              styles.signOutButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <ThemedText type="small" style={styles.signOutText}>
              Sign Out
            </ThemedText>
          </Pressable>
        </View>

        {/* Loading Spinner */}
        {isLoading && scans.length === 0 ? (
          <View style={styles.centeredContent}>
            <ActivityIndicator size="large" color="#3c87f7" />
            <ThemedText themeColor="textSecondary" style={styles.centeredText}>
              Loading scan history...
            </ThemedText>
          </View>
        ) : scans.length > 0 ? (
          /* List of Scans */
          <FlatList
            data={scans}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={() => loadHistory(true)}
                tintColor="#3c87f7"
              />
            }
            onEndReached={() => {
              if (hasMore && !isLoading && !isRefreshing) {
                loadHistory(false);
              }
            }}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              isLoading && scans.length > 0 ? (
                <View style={styles.listFooterLoader}>
                  <ActivityIndicator size="small" color="#3c87f7" />
                </View>
              ) : null
            }
          />
        ) : (
          /* Empty state */
          <View style={styles.centeredContent}>
            <ThemedText themeColor="textSecondary" style={styles.centeredText}>
              No scans yet
            </ThemedText>
            <ThemedText
              themeColor="textSecondary"
              type="small"
              style={styles.centeredText}
            >
              Scan some food and your history will appear here.
            </ThemedText>
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => router.push('/(tabs)/scan')}
              accessibilityRole="button"
              accessibilityLabel="Go to scan"
            >
              <ThemedText style={styles.primaryButtonText}>
                Scan Food
              </ThemedText>
            </Pressable>
          </View>
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
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.three,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  signOutButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 8,
  },
  signOutText: {
    color: '#ef4444',
  },
  listContent: {
    paddingVertical: Spacing.two,
    gap: Spacing.three,
  },
  listFooterLoader: {
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  historyCard: {
    borderRadius: 12,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: 'rgba(150, 150, 150, 0.1)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardMain: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  cardDate: {
    marginTop: 4,
  },
  calorieBadge: {
    backgroundColor: '#e0edff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 50,
  },
  calorieText: {
    color: '#1a56db',
    fontWeight: '700',
    fontSize: 14,
  },
  calorieUnit: {
    color: '#1a56db',
    fontSize: 10,
  },
  cardFooter: {
    marginTop: Spacing.two,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150, 150, 150, 0.2)',
    paddingTop: Spacing.two,
  },
  deleteBtn: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
  },
  deleteBtnText: {
    color: '#ef4444',
  },
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  centeredText: {
    textAlign: 'center',
  },
  buttonGroup: {
    gap: Spacing.two,
    width: '100%',
    maxWidth: 280,
    marginTop: Spacing.two,
  },
  primaryButton: {
    backgroundColor: '#3c87f7',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#3c87f7',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#3c87f7',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonPressed: {
    opacity: 0.7,
  },
  userInfo: {
    alignItems: 'center',
    paddingTop: Spacing.two,
  },
});
