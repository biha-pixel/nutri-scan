/**
 * Food Density & Unit Weight Lookup Library
 *
 * Provides:
 * 1. Bulk density (g/cm³) for estimating mass from volume (2D area × height)
 * 2. Standard unit weights (grams) for discrete items (apples, bananas, eggs, etc.)
 *
 * These values are based on USDA food composition data and standard
 * culinary references. They enable mass estimation without a scale.
 */

/**
 * Food density in grams per cubic centimeter (g/cm³).
 *
 * Used to convert volume estimates (2D area × height) into mass:
 *   estimatedGrams = volumeCm³ × densityGcm³
 *
 * Densities vary widely by food type and preparation:
 * - Dry grains: ~0.75–0.85 (loose pack)
 * - Leafy vegetables: ~0.25–0.35 (very low density, high water/air)
 * - Cooked meats: ~1.05 (slightly denser than water)
 * - Soups/curries: ~1.00 (similar to water)
 * - Baked goods: ~0.40–0.55 (lots of air pockets)
 * - Root vegetables: ~0.85–0.90 (denser, more starch/fiber)
 */
export const FOOD_DENSITY_GCMS: Record<string, number> = {
  // Grains & starches
  rice: 0.8,
  cooked_rice: 0.8,
  pasta: 0.75,
  cooked_pasta: 0.8,
  quinoa: 0.8,
  oats: 0.75,
  cooked_oats: 0.8,
  couscous: 0.75,

  // Proteins
  chicken_breast: 1.05,
  cooked_chicken: 1.05,
  fish: 1.05,
  cooked_fish: 1.05,
  beef: 1.05,
  cooked_beef: 1.05,
  pork: 1.05,
  cooked_pork: 1.05,
  tofu: 1.05,
  tempeh: 1.05,

  // Legumes
  beans: 0.8,
  cooked_beans: 0.8,
  lentils: 0.8,
  cooked_lentils: 0.8,

  // Liquids & soups
  soup: 1.0,
  curry: 1.0,
  gravy: 1.0,
  sauce: 1.0,
  broth: 1.0,
  stew: 1.0,
  liquid: 1.0,

  // Vegetables
  salad: 0.3,
  leafy_greens: 0.25,
  spinach: 0.25,
  lettuce: 0.25,
  cabbage: 0.35,
  broccoli: 0.35,
  cauliflower: 0.35,
  chopped_vegetables: 0.35,

  // Root vegetables
  potato: 0.85,
  cooked_potato: 0.85,
  mashed_potato: 0.85,
  sweet_potato: 0.85,
  carrot: 0.85,
  onion: 0.85,
  garlic: 0.85,

  // Baked goods
  bread: 0.5,
  cake: 0.45,
  cookie: 0.5,
  muffin: 0.45,
  pastry: 0.55,
  donut: 0.45,

  // Fruits (as prepared slices or chunks)
  fruit: 0.5,
  apple_slices: 0.5,
  banana_slices: 0.5,
  berries: 0.45,

  // Dairy
  cheese: 1.0,
  yogurt: 1.0,
  ice_cream: 0.6,
};

/**
 * Standard unit weights (in grams) for common discrete items.
 *
 * Used for foods counted by units (e.g., "2 apples", "1 egg", "3 slices of bread").
 * Values are based on USDA FoodData Central and culinary references.
 *
 * Each entry has three size tiers: small, medium (default), and large.
 * For items without clear size variation, we provide a single "standard" value.
 *
 * Examples:
 * - Apple: 149g (small), 182g (medium), 223g (large)
 * - Banana: 101g (small), 118g (medium), 136g (large)
 * - Egg: 50g (medium), 57g (large)
 */
export const UNIT_WEIGHTS_GRAMS: Record<
  string,
  { small?: number; medium: number; large?: number }
> = {
  // Fruits
  apple: { small: 149, medium: 182, large: 223 },
  banana: { small: 101, medium: 118, large: 136 },
  orange: { small: 96, medium: 131, large: 168 },
  lemon: { small: 58, medium: 88, large: 112 },
  lime: { small: 44, medium: 58, large: 68 },
  strawberry: { small: 7, medium: 12, large: 18 },
  blueberry: { small: 1.4, medium: 1.4, large: 1.4 }, // ~per berry
  grape: { small: 5, medium: 5, large: 5 }, // ~per grape
  watermelon_slice: { small: 280, medium: 480, large: 700 },
  mango: { small: 200, medium: 310, large: 400 },
  peach: { small: 130, medium: 150, large: 185 },
  pear: { small: 148, medium: 178, large: 230 },
  kiwi: { small: 69, medium: 76, large: 85 },

  // Vegetables
  carrot: { small: 61, medium: 72, large: 95 },
  cucumber: { small: 201, medium: 301, large: 401 },
  tomato: { small: 91, medium: 123, large: 182 },
  bell_pepper: { small: 119, medium: 149, large: 186 },
  onion: { small: 70, medium: 150, large: 230 },
  potato: { small: 85, medium: 173, large: 280 },
  sweet_potato: { small: 100, medium: 150, large: 200 },
  broccoli_stalk: { small: 55, medium: 91, large: 140 },
  cauliflower_floret: { small: 20, medium: 30, large: 45 },

  // Proteins
  egg: { medium: 50, large: 57 },
  egg_large: { medium: 57 },
  chicken_breast: { small: 120, medium: 170, large: 220 },
  chicken_thigh: { small: 150, medium: 200, large: 250 },
  fish_fillet: { small: 100, medium: 150, large: 200 },

  // Breads & grains
  bread_slice: { small: 25, medium: 30, large: 40 },
  bagel: { medium: 89 },
  english_muffin: { medium: 57 },
  croissant: { medium: 56 },
  pancake: { small: 38, medium: 61, large: 76 },
  waffle: { medium: 75 },
  rice_cup_cooked: { medium: 158 },
  pasta_cup_cooked: { medium: 140 },
  oatmeal_cup_cooked: { medium: 234 },

  // Dairy
  yogurt_container: { small: 100, medium: 170, large: 227 },
  cheese_slice: { medium: 21 },
  cheese_block: { small: 50, medium: 100, large: 150 },
  milk_cup: { medium: 240 },
  butter_pat: { medium: 14 },

  // Nuts & seeds
  almond: { medium: 1.4 }, // ~per nut
  walnut: { medium: 4 }, // ~per piece
  peanut: { medium: 1 }, // ~per peanut
  peanut_butter_tbsp: { medium: 16 },

  // Condiments & misc
  olive_oil_tbsp: { medium: 14 },
  honey_tbsp: { medium: 21 },
  jam_tbsp: { medium: 20 },
  peanut_butter_serving: { medium: 32 },
};

/**
 * Get density for a food based on its name and geometry category.
 *
 * Falls back to default density (0.75 g/cm³) if no match found.
 *
 * @param foodName - Food name or category (case-insensitive)
 * @param geometryCategory - Optional geometry category (discrete_unit, amorphous_mound, etc.)
 * @returns Density in g/cm³
 */
export function getFoodDensity(foodName: string, geometryCategory?: string): number {
  const normalized = foodName.toLowerCase().trim();

  // Direct lookup
  if (FOOD_DENSITY_GCMS[normalized]) {
    return FOOD_DENSITY_GCMS[normalized];
  }

  // Fuzzy matching: check if food name contains any known category
  for (const [category, density] of Object.entries(FOOD_DENSITY_GCMS)) {
    if (normalized.includes(category) || category.includes(normalized)) {
      return density;
    }
  }

  // Fallback based on geometry category
  if (geometryCategory === 'liquid_or_bowl') {
    return 1.0; // Default to water density for liquids
  }
  if (geometryCategory === 'discrete_unit') {
    return 0.75; // Conservative estimate for countable items
  }

  // Default fallback
  return 0.75;
}

/**
 * Get standard unit weight for a food item at a given size tier.
 *
 * @param foodName - Food name (case-insensitive)
 * @param sizeTier - Size tier: 'small', 'medium' (default), or 'large'
 * @returns Weight in grams, or null if not found
 */
export function getUnitWeight(
  foodName: string,
  sizeTier: 'small' | 'medium' | 'large' = 'medium'
): number | null {
  const normalized = foodName.toLowerCase().trim();

  // Direct lookup
  if (UNIT_WEIGHTS_GRAMS[normalized]) {
    const entry = UNIT_WEIGHTS_GRAMS[normalized];

    // Try exact size tier match
    if (sizeTier === 'small' && entry.small !== undefined) {
      return entry.small;
    }
    if (sizeTier === 'medium' && entry.medium !== undefined) {
      return entry.medium;
    }
    if (sizeTier === 'large' && entry.large !== undefined) {
      return entry.large;
    }

    // Fallback to medium if requested tier not available
    return entry.medium;
  }

  // Fuzzy matching: check if food name contains any known entry
  for (const [key, entry] of Object.entries(UNIT_WEIGHTS_GRAMS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      if (sizeTier === 'small' && entry.small !== undefined) {
        return entry.small;
      }
      if (sizeTier === 'medium' && entry.medium !== undefined) {
        return entry.medium;
      }
      if (sizeTier === 'large' && entry.large !== undefined) {
        return entry.large;
      }
      return entry.medium;
    }
  }

  // Not found
  return null;
}

/**
 * Default values for fallback estimation.
 */
export const FALLBACK_DENSITY_GCMS = 0.75; // g/cm³
export const FALLBACK_UNIT_WEIGHT_GRAMS = 150; // grams
