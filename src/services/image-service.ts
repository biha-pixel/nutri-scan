/**
 * Image Service — handles all camera and gallery operations.
 *
 * WHY THIS EXISTS:
 * The scan screen needs to take photos and pick images from the gallery.
 * But the screen's job is to show the UI — not to manage permissions,
 * configure camera settings, or handle image compression.
 *
 * This service owns all of that complexity. The screen simply calls
 * `takePhoto()` or `pickFromGallery()` and gets back an image URI
 * or an error — it doesn't need to know anything about expo-image-picker,
 * permission APIs, or compression settings.
 *
 * This is "separation of concerns" in action:
 *   - Screen component → what the user sees
 *   - Image service    → how images are captured, selected, and prepared
 */

import * as ImagePicker from 'expo-image-picker';

import type { CapturedImage, PermissionResult } from '@/types/image';

/**
 * Maximum dimension (width or height) for captured images.
 * The AI model doesn't need 48-megapixel photos to recognize food.
 * 1024px is more than enough and keeps file sizes under ~300KB.
 */
const MAX_IMAGE_DIMENSION = 1024;

/**
 * JPEG compression quality from 0 (worst) to 1 (best).
 * 0.7 gives a good balance between visual quality and file size.
 */
const IMAGE_QUALITY = 0.7;

/**
 * Shared ImagePicker options used by both camera and gallery.
 * This avoids duplicating the same settings in two places.
 */
const sharedPickerOptions: Partial<ImagePicker.ImagePickerOptions> = {
  mediaTypes: ['images'],
  allowsEditing: true,
  quality: IMAGE_QUALITY,
  exif: false, // Strip EXIF data — it can contain GPS coordinates (security rule #9)
};

// ---------------------------------------------------------------------------
// Permission helpers
// ---------------------------------------------------------------------------

/**
 * Check and request camera permission.
 *
 * The flow:
 * 1. First, check the current status without showing a dialog.
 * 2. If undetermined (never asked), request permission (shows the OS dialog).
 * 3. Return the final status so the UI knows what to display.
 */
export async function requestCameraPermission(): Promise<PermissionResult> {
  const current = await ImagePicker.getCameraPermissionsAsync();

  if (current.granted) {
    return { status: 'granted', canAskAgain: true };
  }

  // If we haven't asked yet, or we can ask again, show the OS dialog
  if (current.canAskAgain) {
    const requested = await ImagePicker.requestCameraPermissionsAsync();
    return {
      status: requested.granted ? 'granted' : 'denied',
      canAskAgain: requested.canAskAgain,
    };
  }

  // User previously denied and the OS won't show the dialog again
  return { status: 'denied', canAskAgain: false };
}

/**
 * Check and request media library (photo gallery) permission.
 *
 * Note: On iOS 14+, the user can grant access to "selected photos only"
 * or "all photos". Both count as granted for our purposes.
 * On Android 13+, READ_MEDIA_IMAGES is used instead of READ_EXTERNAL_STORAGE.
 */
export async function requestGalleryPermission(): Promise<PermissionResult> {
  const current = await ImagePicker.getMediaLibraryPermissionsAsync();

  if (current.granted) {
    return { status: 'granted', canAskAgain: true };
  }

  if (current.canAskAgain) {
    const requested = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return {
      status: requested.granted ? 'granted' : 'denied',
      canAskAgain: requested.canAskAgain,
    };
  }

  return { status: 'denied', canAskAgain: false };
}

// ---------------------------------------------------------------------------
// Image capture / selection
// ---------------------------------------------------------------------------

/**
 * Open the device camera and let the user take a photo.
 *
 * Returns the captured image with its URI, or null if the user cancelled.
 * Throws an error if permission was denied.
 *
 * The calling screen doesn't need to know about ImagePicker, permission APIs,
 * or compression settings — it just calls this and gets a CapturedImage or null.
 */
export async function takePhoto(): Promise<CapturedImage | null> {
  // Step 1: Ensure we have permission
  const permission = await requestCameraPermission();

  if (permission.status !== 'granted') {
    throw new ImagePermissionError('camera', permission.canAskAgain);
  }

  // Step 2: Launch the camera with our shared settings
  const result = await ImagePicker.launchCameraAsync({
    ...sharedPickerOptions,
  });

  // Step 3: Handle cancellation (user pressed back / cancel)
  if (result.canceled || result.assets.length === 0) {
    return null;
  }

  // Step 4: Return the image data the screen needs
  return {
    uri: result.assets[0].uri,
    source: 'camera',
  };
}

/**
 * Open the photo gallery and let the user pick one image.
 *
 * Returns the selected image with its URI, or null if the user cancelled.
 * Throws an error if permission was denied.
 */
export async function pickFromGallery(): Promise<CapturedImage | null> {
  // Step 1: Ensure we have permission
  const permission = await requestGalleryPermission();

  if (permission.status !== 'granted') {
    throw new ImagePermissionError('gallery', permission.canAskAgain);
  }

  // Step 2: Launch the gallery picker
  const result = await ImagePicker.launchImageLibraryAsync({
    ...sharedPickerOptions,
  });

  // Step 3: Handle cancellation
  if (result.canceled || result.assets.length === 0) {
    return null;
  }

  // Step 4: Return the image data
  return {
    uri: result.assets[0].uri,
    source: 'gallery',
  };
}

// ---------------------------------------------------------------------------
// Custom error class for permission failures
// ---------------------------------------------------------------------------

/**
 * A custom error thrown when a permission is denied.
 *
 * WHY A CUSTOM ERROR:
 * The scan screen needs to know two things when permission fails:
 *   1. Which permission was denied (camera vs gallery)
 *   2. Whether the OS will show the permission dialog again (canAskAgain)
 *
 * A plain Error("Permission denied") doesn't carry this information.
 * A custom error class lets the screen handle permission denials differently
 * from other errors (like a camera hardware failure).
 */
export class ImagePermissionError extends Error {
  readonly permissionType: 'camera' | 'gallery';
  readonly canAskAgain: boolean;

  constructor(permissionType: 'camera' | 'gallery', canAskAgain: boolean) {
    const target = permissionType === 'camera' ? 'Camera' : 'Photo library';
    super(`${target} permission is required.`);
    this.name = 'ImagePermissionError';
    this.permissionType = permissionType;
    this.canAskAgain = canAskAgain;
  }
}
