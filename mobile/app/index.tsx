import React, { useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView, Alert, FlatList, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, SPACING, RADIUS } from '../constants/theme';
import { Button } from '../components/Button';

interface RecentScanItem {
  id: string;
  name: string;
  date: string;
  calories: number;
}

const DUMMY_RECENT_SCANS: RecentScanItem[] = [
  { id: '1', name: 'Avocado Toast', date: 'Today, 8:30 AM', calories: 250 },
  { id: '2', name: 'Grilled Chicken Salad', date: 'Yesterday, 1:15 PM', calories: 380 },
  { id: '3', name: 'Banana & Peanut Butter', date: 'Oct 23, 4:00 PM', calories: 190 },
];

export default function ScanScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Needed',
          'Camera permission is required to photograph your food. Please enable it in your device settings.'
        );
        return;
      }

      setLoading(true);
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        // In the future, this would upload to the backend.
        // For now, simulate flow to Result screen:
        router.push({
          pathname: '/result',
          params: { imageUri: result.assets[0].uri, foodName: 'Sample Food' },
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to open camera. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChooseFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Needed',
          'Gallery permission is required to select photos from your library.'
        );
        return;
      }

      setLoading(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        router.push({
          pathname: '/result',
          params: { imageUri: result.assets[0].uri, foodName: 'Gallery Image' },
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image from gallery.');
    } finally {
      setLoading(false);
    }
  };

  const renderRecentScan = ({ item }: { item: RecentScanItem }) => (
    <TouchableOpacity
      style={styles.recentItem}
      onPress={() =>
        router.push({
          pathname: '/result',
          params: { foodName: item.name },
        })
      }
      accessibilityRole="button"
      accessibilityLabel={`View scan details for ${item.name}`}
    >
      <View>
        <Text style={styles.recentItemTitle}>{item.name}</Text>
        <Text style={styles.recentItemSubtitle}>{item.date}</Text>
      </View>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{item.calories} kcal</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Top Header Navigation Icons */}
        <View style={styles.topNav}>
          <Button
            title="⚙️ Settings"
            variant="secondary"
            onPress={() => router.push('/settings')}
            style={styles.navButton}
            textStyle={styles.navButtonText}
          />
          <Button
            title="📜 History"
            variant="secondary"
            onPress={() => router.push('/history')}
            style={styles.navButton}
            textStyle={styles.navButtonText}
          />
        </View>

        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Text style={styles.title}>NutriScan</Text>
          <Text style={styles.subtitle}>
            Snap a photo of your food to instantly identify ingredients and get accurate, science-backed nutrition facts.
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionCard}>
          <Button
            title="📸 Take Photo"
            onPress={handleTakePhoto}
            style={styles.actionButton}
            disabled={loading}
          />
          <Button
            title="🖼️ Choose from Gallery"
            variant="secondary"
            onPress={handleChooseFromGallery}
            style={styles.actionButton}
            disabled={loading}
          />
        </View>

        {/* Recent Scans Section */}
        <View style={styles.recentSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Scans</Text>
            <TouchableOpacity onPress={() => router.push('/history')}>
              <Text style={styles.seeAllText}>See all</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={DUMMY_RECENT_SCANS}
            keyExtractor={(item) => item.id}
            renderItem={renderRecentScan}
            scrollEnabled={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No recent scans yet. Take a photo to start!</Text>
              </View>
            }
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: SPACING.m,
  },
  topNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.l,
    marginTop: SPACING.s,
  },
  navButton: {
    paddingVertical: SPACING.s,
    paddingHorizontal: SPACING.m,
    borderRadius: RADIUS.round,
  },
  navButtonText: {
    fontSize: 14,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
    paddingHorizontal: SPACING.m,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.primaryDark,
    marginBottom: SPACING.s,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textLight,
    textAlign: 'center',
    lineHeight: 22,
  },
  actionCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    padding: SPACING.l,
    marginBottom: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionButton: {
    marginVertical: SPACING.xs,
  },
  recentSection: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.m,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  seeAllText: {
    color: COLORS.primaryDark,
    fontWeight: '600',
  },
  recentItem: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.l,
    padding: SPACING.m,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.s,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  recentItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  recentItemSubtitle: {
    fontSize: 13,
    color: COLORS.textLight,
  },
  badge: {
    backgroundColor: COLORS.background,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.s,
    borderRadius: RADIUS.m,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primaryDark,
  },
  emptyState: {
    padding: SPACING.l,
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.textLight,
    fontSize: 14,
  },
});
