/**
 * ImagePreview — displays the captured/selected image with action buttons.
 *
 * This is a presentational component: it receives data and callbacks via props,
 * and its only job is to render them. It doesn't call the image service or
 * manage any state — the parent screen handles that.
 */

import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ImageSource } from '@/types/image';

interface ImagePreviewProps {
  /** The file URI of the image to display */
  uri: string;
  /** Where the image came from — determines button label ("Retake" vs "Reselect") */
  source: ImageSource;
  /** Called when the user wants to capture/select a different image */
  onRetake: () => void;
  /** Called when the user is happy with the image and wants to proceed */
  onContinue: () => void;
}

export function ImagePreview({ uri, source, onRetake, onContinue }: ImagePreviewProps) {
  const theme = useTheme();

  const retakeLabel = source === 'camera' ? 'Retake Photo' : 'Choose Different';

  return (
    <View style={styles.container}>
      <Image
        source={{ uri }}
        style={styles.image}
        contentFit="contain"
        accessibilityRole="image"
        accessibilityLabel="Preview of captured food image"
      />

      <ThemedView style={styles.buttonRow}>
        <Pressable
          onPress={onRetake}
          style={({ pressed }) => [
            styles.button,
            styles.secondaryButton,
            { borderColor: theme.textSecondary },
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={retakeLabel}
        >
          <ThemedText themeColor="textSecondary">{retakeLabel}</ThemedText>
        </Pressable>

        <Pressable
          onPress={onContinue}
          style={({ pressed }) => [
            styles.button,
            styles.primaryButton,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Analyze this food image"
        >
          <ThemedText style={styles.primaryButtonText}>Analyze Food</ThemedText>
        </Pressable>
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: Spacing.four,
  },
  image: {
    flex: 1,
    borderRadius: Spacing.three,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  button: {
    flex: 1,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    borderWidth: 1.5,
  },
  primaryButton: {
    backgroundColor: '#34C759',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },
  pressed: {
    opacity: 0.7,
  },
});
