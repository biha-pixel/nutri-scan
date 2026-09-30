/**
 * Types for the image capture and selection feature.
 *
 * These types define the shape of data that flows through the image service
 * and into the scan screen. They are used by both the service layer and the UI.
 */

/**
 * Where the image came from — the user either took a photo with the camera
 * or picked an existing image from their photo gallery.
 */
export type ImageSource = 'camera' | 'gallery';

/**
 * The result of successfully capturing or selecting an image.
 *
 * - `uri` is the file address on the device (e.g., "file:///data/.../photo.jpg").
 *   We use this to display the preview and (later) to upload to the backend.
 * - `source` tells the UI whether the image came from the camera or gallery,
 *   which affects labeling ("Retake" vs "Reselect").
 */
export interface CapturedImage {
  uri: string;
  source: ImageSource;
}

/**
 * Every permission request can land in one of these states.
 *
 * - 'granted'       — The user said yes. We can proceed.
 * - 'denied'        — The user said no (but might change their mind in settings).
 * - 'undetermined'  — The user has never been asked yet.
 */
export type PermissionStatus = 'granted' | 'denied' | 'undetermined';

/**
 * The result of a permission check.
 *
 * `canAskAgain` matters because on some devices, once the user denies a
 * permission, the OS won't show the dialog again — the app must send
 * the user to the system Settings screen instead.
 */
export interface PermissionResult {
  status: PermissionStatus;
  canAskAgain: boolean;
}
