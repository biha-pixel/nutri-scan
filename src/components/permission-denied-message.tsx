/**
 * PermissionDeniedMessage — shown when the user has denied a required permission.
 *
 * Two cases:
 * 1. canAskAgain=true  → We can show "Try Again" to re-request.
 * 2. canAskAgain=false → The OS won't show the dialog again.
 *    The user must go to Settings manually. We show a helpful message.
 */

import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface PermissionDeniedMessageProps {
  /** Which permission was denied */
  permissionType: 'camera' | 'gallery';
  /** Whether the OS will show the permission dialog if we request again */
  canAskAgain: boolean;
  /** Called when the user taps "Try Again" */
  onRetry: () => void;
}

export function PermissionDeniedMessage({
  permissionType,
  canAskAgain,
  onRetry,
}: PermissionDeniedMessageProps) {
  const theme = useTheme();

  const permissionName = permissionType === 'camera' ? 'camera' : 'photo library';

  return (
    <View style={styles.container}>
      <ThemedText type="subtitle" style={styles.title}>
        Permission Needed
      </ThemedText>

      <ThemedText style={styles.message} themeColor="textSecondary">
        NutriScan needs access to your {permissionName} to identify food and provide nutritional
        information.
      </ThemedText>

      {canAskAgain ? (
        <Pressable
          onPress={onRetry}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: theme.backgroundElement },
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Grant ${permissionName} permission`}
        >
          <ThemedText>Try Again</ThemedText>
        </Pressable>
      ) : (
        <>
          <ThemedText style={styles.message} themeColor="textSecondary">
            You previously denied this permission. Please enable it in your device settings.
          </ThemedText>
          <Pressable
            onPress={openAppSettings}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.backgroundElement },
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Open device settings"
          >
            <ThemedText>Open Settings</ThemedText>
          </Pressable>
        </>
      )}
    </View>
  );
}

/**
 * Opens the system settings page for this app.
 * On iOS, this goes directly to the app's permission settings.
 * On Android, it opens the app info screen where permissions can be managed.
 */
function openAppSettings(): void {
  if (Platform.OS === 'ios') {
    Linking.openURL('app-settings:');
  } else {
    Linking.openSettings();
  }
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacing.four,
    paddingHorizontal: Spacing.four,
  },
  title: {
    textAlign: 'center',
  },
  message: {
    textAlign: 'center',
    lineHeight: 22,
  },
  button: {
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
});
