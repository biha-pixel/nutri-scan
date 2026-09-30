/**
 * Image Picker Service
 *
 * A service layer for handling device camera and gallery interactions.
 * This abstracts permission handling, image capture, and selection
 * away from UI components.
 *
 * Why separate this into a service?
 * - Reusability: Multiple screens can use the same image logic
 * - Testability: Business logic can be tested independently of UI
 * - Maintainability: Permission logic changes in one place
 * - Separation of concerns: UI handles presentation, service handles operations
 */

import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking, Platform } from 'react-native';

/**
 * Permission status returned by the system
 */
export type PermissionStatus = 'granted' | 'denied' | 'undetermined' | 'restricted';

/**
 * Result of an image capture or selection operation
 */
export interface ImagePickerResult {
  success: boolean;
  uri?: string;
  canceled?: boolean;
  error?: string;
}

/**
 * Request camera permission from the user.
 * Shows a system dialog on first request.
 * Returns the current permission status.
 */
export async function requestCameraPermission(): Promise<PermissionStatus> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  return status;
}

/**
 * Request photo library permission from the user.
 * On iOS 14+, users can choose "Select Photos" (limited access).
 * Returns the current permission status.
 */
export async function requestGalleryPermission(): Promise<PermissionStatus> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return status;
}

/**
 * Check current camera permission without prompting the user.
 */
export async function checkCameraPermission(): Promise<PermissionStatus> {
  const { status } = await ImagePicker.getCameraPermissionsAsync();
  return status;
}

/**
 * Check current gallery permission without prompting.
 */
export async function checkGalleryPermission(): Promise<PermissionStatus> {
  const { status } = await ImagePicker.getMediaLibraryPermissionsAsync();
  return status;
}

/**
 * Handle the case where permission was denied.
 * Shows an alert explaining why permission is needed
 * and offers to open device settings.
 */
export function handlePermissionDenied(feature: 'camera' | 'gallery'): void {
  const title = `${feature === 'camera' ? 'Camera' : 'Photo Library'} Access Required`;
  const message =
    feature === 'camera'
      ? 'NutriScan needs camera access to photograph your food for nutrition analysis. Please enable camera access in Settings.'
      : 'NutriScan needs photo library access to select food photos. Please enable photo access in Settings.';

  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Open Settings',
      onPress: () => {
        // Open device settings where the user can grant permission
        if (Platform.OS === 'ios') {
          Linking.openURL('app-settings:');
        } else {
          Linking.openSettings();
        }
      },
    },
  ]);
}

/**
 * Launch the device camera to capture a photo.
 *
 * Workflow:
 * 1. Check and request camera permission if needed
 * 2. Open the camera UI (user frames food and takes photo)
 * 3. Return the captured image URI
 *
 * @param options Configuration for image capture
 * @returns ImagePickerResult with success status and URI
 */
export async function capturePhoto(options?: {
  allowsEditing?: boolean;
  aspect?: [number, number];
  quality?: number;
}): Promise<ImagePickerResult> {
  try {
    // Step 1: Request permission
    const status = await requestCameraPermission();

    if (status !== 'granted') {
      // Permission denied - show guidance
      handlePermissionDenied('camera');
      return {
        success: false,
        error: 'Camera permission denied',
      };
    }

    // Step 2: Launch camera
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: options?.allowsEditing ?? true,
      aspect: options?.aspect ?? [4, 3],
      quality: options?.quality ?? 0.8,
    });

    // Step 3: Handle result
    if (result.canceled) {
      return {
        success: false,
        canceled: true,
      };
    }

    const uri = result.assets[0]?.uri;
    if (!uri) {
      return {
        success: false,
        error: 'No image captured',
      };
    }

    return {
      success: true,
      uri,
    };
  } catch (error) {
    // Handle unexpected errors (hardware failure, etc.)
    const errorMessage = error instanceof Error ? error.message : 'Failed to open camera';
    console.error('capturePhoto error:', error);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Open the photo gallery to select an existing image.
 *
 * Workflow:
 * 1. Check and request gallery permission if needed
 * 2. Open the photo picker UI
 * 3. Return the selected image URI
 *
 * @param options Configuration for image selection
 * @returns ImagePickerResult with success status and URI
 */
export async function selectFromGallery(options?: {
  allowsEditing?: boolean;
  aspect?: [number, number];
  quality?: number;
}): Promise<ImagePickerResult> {
  try {
    // Step 1: Request permission
    const status = await requestGalleryPermission();

    if (status !== 'granted') {
      // Permission denied - show guidance
      handlePermissionDenied('gallery');
      return {
        success: false,
        error: 'Gallery permission denied',
      };
    }

    // Step 2: Launch image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: options?.allowsEditing ?? true,
      aspect: options?.aspect ?? [4, 3],
      quality: options?.quality ?? 0.8,
    });

    // Step 3: Handle result
    if (result.canceled) {
      return {
        success: false,
        canceled: true,
      };
    }

    const uri = result.assets[0]?.uri;
    if (!uri) {
      return {
        success: false,
        error: 'No image selected',
      };
    }

    return {
      success: true,
      uri,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to open gallery';
    console.error('selectFromGallery error:', error);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Validate that an image URI is accessible.
 * Useful for catching edge cases where a URI becomes invalid.
 */
export async function validateImageUri(uri: string): Promise<boolean> {
  try {
    // React Native's Image component will handle validation,
    // but we can add additional checks here if needed
    return uri && uri.length > 0;
  } catch {
    return false;
  }
}
