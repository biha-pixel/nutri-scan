/**
 * Image Preview Modal Component
 *
 * Displays the selected image with options to retake/reselect or continue.
 * This is a presentational component — it receives the image URI and
 * callbacks from the parent screen.
 *
 * Why make this a separate component?
 * - Single responsibility: This component only handles image preview
 * - Reusability: Can be used from any screen that captures images
 * - Testability: Can be tested in isolation
 * - Cleaner parent code: The Scan screen doesn't need 50 lines of preview UI
 */

import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  Modal,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { COLORS, SPACING, RADIUS } from '../constants/theme';
import { Button } from './Button';

interface ImagePreviewModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** URI of the image to preview */
  imageUri: string | null;
  /** Called when user taps "Retake" or "Reselect" */
  onRetake: () => void;
  /** Called when user taps "Continue" to proceed with this image */
  onContinue: () => void;
  /** Called when user dismisses the modal without action */
  onDismiss: () => void;
  /** Label for the retake button (e.g., "Retake" vs "Reselect") */
  retakeLabel?: string;
  /** Whether an operation is in progress (shows loading state) */
  loading?: boolean;
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  visible,
  imageUri,
  onRetake,
  onContinue,
  onDismiss,
  retakeLabel = 'Retake',
  loading = false,
}) => {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onDismiss}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Preview</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Image Preview */}
        <View style={styles.imageContainer}>
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={styles.image}
              resizeMode="contain"
              accessibilityLabel="Preview of captured food photo"
            />
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderText}>No image selected</Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>Processing...</Text>
            </View>
          ) : (
            <>
              <Button
                title={retakeLabel}
                variant="secondary"
                onPress={onRetake}
                style={styles.button}
              />
              <Button
                title="Continue"
                variant="primary"
                onPress={onContinue}
                style={styles.button}
                disabled={!imageUri}
              />
            </>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.text,
  },
  cancelText: {
    fontSize: 16,
    color: COLORS.primaryDark,
  },
  headerSpacer: {
    width: 60, // Balance the cancel button for centered title
  },
  imageContainer: {
    flex: 1,
    padding: SPACING.m,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: RADIUS.l,
    backgroundColor: COLORS.card,
  },
  placeholder: {
    width: '100%',
    height: 300,
    borderRadius: RADIUS.l,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  placeholderText: {
    color: COLORS.textLight,
    fontSize: 16,
  },
  actions: {
    padding: SPACING.m,
    paddingBottom: SPACING.l,
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  button: {
    marginVertical: SPACING.xs,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.m,
  },
  loadingText: {
    marginTop: SPACING.s,
    color: COLORS.textLight,
    fontSize: 14,
  },
});
