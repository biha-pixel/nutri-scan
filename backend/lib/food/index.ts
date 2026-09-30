/**
 * Food Recognition Module
 *
 * This module exports the public API of the food recognition layer.
 * Import from "@/lib/food" to use the service.
 */

// Types
export type {
  FoodItem,
  FoodRecognitionResult,
  FoodRecognitionError,
} from "./types";

// Abstraction (interface)
export type { VisionProvider } from "./vision-provider";

// Service layer
export { FoodAnalysisService } from "./analysis-service";

// Concrete implementation
export { GeminiVisionProvider } from "./gemini-provider";

// Validation schemas
export { FoodItemSchema, FoodRecognitionResultSchema } from "./schemas";
