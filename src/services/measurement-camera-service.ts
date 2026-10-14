/**
 * Measurement Camera Service — Real-time food measurement capture.
 *
 * WHY THIS EXISTS:
 * The measurement camera screen needs to capture frames from expo-camera,
 * handle permissions, save the captured image, and return it in the same
 * format as the existing image service (CapturedImage).
 *
 * This service owns all camera logic, leaving the UI to focus on rendering
 * the preview and overlay. The screen simply calls `captureFrame()` and gets
 * back an image URI or an error.
 */

import { Platform } from 'react-native';
import { CameraView } from 'expo-camera';

import type { CapturedImage } from '@/types/image';

/**
 * Custom error class for camera-related failures.
 */
export class MeasurementCameraError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MeasurementCameraError';
  }
}

/**
 * Normalizes Android local file URIs for Expo Go experience directory paths.
 * Same logic as in scan-service.ts and analyze-service.ts for consistency.
 */
function normalizeFileUri(uri: string): string {
  if (Platform.OS === 'android' && uri.startsWith('file://')) {
    if (uri.includes('%') && !uri.includes('%25')) {
      return uri.replace(/%/g, '%25');
    }
  }
  return uri;
}

/**
 * Capture a frame from the camera and save it as a JPEG image file.
 *
 * This function takes a snapshot from an expo-camera CameraView,
 * saves it to the application cache directory, and returns a
 * CapturedImage with the file URI.
 *
 * @param cameraRef - Reference to the CameraView component
 * @returns CapturedImage with URI and source = 'camera'
 * @throws MeasurementCameraError on capture or save failures
 */
export async function captureFrame(
  cameraRef: React.RefObject<CameraView | null>
): Promise<CapturedImage> {
  if (!cameraRef?.current) {
    throw new MeasurementCameraError('Camera reference is not available.');
  }

  try {
    // Take a photo using the camera ref
    const photo = await cameraRef.current.takePictureAsync({
      quality: 0.7, // Match image-service.ts compression quality
      exif: false,  // Strip EXIF metadata (security rule #9)
    });

    if (!photo?.uri) {
      throw new MeasurementCameraError(
        'Failed to capture photo: no URI returned from camera.'
      );
    }

    // Normalize the URI for Android compatibility
    const normalizedUri = normalizeFileUri(photo.uri);

    // Return in the same format as takePhoto() and pickFromGallery()
    return {
      uri: normalizedUri,
      source: 'camera', // Use 'camera' since this is a direct camera capture
    };
  } catch (error) {
    if (error instanceof MeasurementCameraError) {
      throw error;
    }

    const message =
      error instanceof Error
        ? error.message
        : 'An unexpected error occurred while capturing the photo.';

    throw new MeasurementCameraError(`Camera capture failed: ${message}`);
  }
}

