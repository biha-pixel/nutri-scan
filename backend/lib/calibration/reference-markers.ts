/**
 * Reference Marker Specifications
 *
 * Physical dimensions of known reference markers used for 2D scale calibration.
 * These are backend constants matching the frontend's REFERENCE_MARKER_SPECS.
 */

export type ReferenceMarkerType =
  | 'credit_card'
  | 'us_quarter'
  | 'us_penny'
  | 'one_euro_coin'
  | 'ruler'
  | 'custom';

export interface ReferenceMarkerDimensions {
  widthMm: number;
  heightMm: number;
  shape: 'rectangular' | 'circular';
  country?: string;
}

/**
 * Standard reference marker specifications with known, verified dimensions.
 * These match the frontend's REFERENCE_MARKER_SPECS exactly.
 */
export const REFERENCE_MARKER_SPECS: Record<
  Exclude<ReferenceMarkerType, 'custom'>,
  ReferenceMarkerDimensions
> = {
  credit_card: {
    widthMm: 85.6,
    heightMm: 53.98,
    shape: 'rectangular',
    country: 'ISO',
  },
  us_quarter: {
    widthMm: 24.26,
    heightMm: 24.26,
    shape: 'circular',
    country: 'US',
  },
  us_penny: {
    widthMm: 19.05,
    heightMm: 19.05,
    shape: 'circular',
    country: 'US',
  },
  one_euro_coin: {
    widthMm: 23.25,
    heightMm: 23.25,
    shape: 'circular',
    country: 'EU',
  },
  ruler: {
    widthMm: 300,
    heightMm: 30,
    shape: 'rectangular',
  },
};
