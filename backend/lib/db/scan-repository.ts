/**
 * Food Scan Repository
 *
 * Data Access Layer (DAL) for managing food scans and scan items in PostgreSQL.
 *
 * Responsibilities:
 * 1. Validate inputs and database results using Zod
 * 2. Execute structured queries via Supabase client
 * 3. Map raw relational database rows to domain DTOs
 * 4. Ensure transactional integrity when saving scans and associated items
 */

import { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "./types";
import type { Macronutrients, Micronutrients } from "@/lib/nutrition/types";
import type { NutritionHighlight } from "@/lib/highlights/types";
import type {
  CreateScanInput,
  SavedScan,
  SavedScanItem,
  ScanHistoryQueryOptions,
  ScanHistoryResult,
  ScanRow,
  ScanItemRow,
} from "./types";
import {
  CreateScanInputSchema,
  ScanHistoryQuerySchema,
} from "./schemas";
import { createSupabaseClient } from "./client";

export class ScanRepository {
  private client: SupabaseClient<Database>;

  constructor(client?: SupabaseClient<Database>) {
    this.client = client || createSupabaseClient();
  }

  /**
   * Saves a completed food scan and its identified items.
   *
   * Step 1: Validate input against Zod schema
   * Step 2: Insert parent row into `scans`
   * Step 3: Insert child rows into `scan_items` referencing the parent scan ID
   * Step 4: Return normalized domain object
   */
  async saveScan(input: CreateScanInput): Promise<SavedScan> {
    const validated = CreateScanInputSchema.parse(input);

    if (!validated.userId) {
      throw new Error("User ID is required to persist scan records to the database.");
    }

    // 1. Insert parent scan record
    const { data: scanRow, error: scanError } = await this.client
      .from("scans")
      .insert({
        user_id: validated.userId,
        image_url: validated.imageUrl || null,
      })
      .select()
      .single();

    if (scanError || !scanRow) {
      throw new Error(`Failed to save food scan: ${scanError?.message || "Unknown error"}`);
    }

    // 2. Prepare child scan item records
    const itemRowsToInsert = validated.items.map((item) => ({
      scan_id: scanRow.id,
      food_name: item.foodName,
      confidence: item.confidence,
      nutrition_source: item.nutritionSource || "usda_fdc",
      nutrition_id: item.nutritionId || null,
      serving_basis: item.servingBasis || "100g",
      nutrients: (item.nutrients || {}) as unknown as Json,
      highlights: (item.highlights || []) as unknown as Json,
    }));

    // 3. Insert child items
    const { data: itemRows, error: itemsError } = await this.client
      .from("scan_items")
      .insert(itemRowsToInsert)
      .select();

    if (itemsError || !itemRows) {
      // Clean up orphaned parent scan if items insertion fails
      await this.client.from("scans").delete().eq("id", scanRow.id);
      throw new Error(`Failed to save scan items: ${itemsError?.message || "Unknown error"}`);
    }

    return this.mapToSavedScan(scanRow as ScanRow, itemRows as ScanItemRow[]);
  }

  /**
   * Retrieves paginated scan history for an authenticated user.
   */
  async getScanHistory(options: ScanHistoryQueryOptions): Promise<ScanHistoryResult> {
    const validated = ScanHistoryQuerySchema.parse(options);
    const { userId, limit, offset } = validated;

    // 1. Fetch total count
    const { count, error: countError } = await this.client
      .from("scans")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    if (countError) {
      throw new Error(`Failed to count scans: ${countError.message}`);
    }

    const total = count || 0;

    if (total === 0) {
      return {
        scans: [],
        total: 0,
        limit,
        offset,
        hasMore: false,
      };
    }

    // 2. Fetch paginated scans with nested items
    const { data, error: fetchError } = await this.client
      .from("scans")
      .select(
        `
        id,
        user_id,
        image_url,
        created_at,
        scan_items (
          id,
          scan_id,
          food_name,
          confidence,
          nutrition_source,
          nutrition_id,
          serving_basis,
          nutrients,
          highlights,
          created_at
        )
      `
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (fetchError) {
      throw new Error(`Failed to fetch scan history: ${fetchError.message}`);
    }

    const scans: SavedScan[] = (data || []).map((row) => {
      const items = (row.scan_items as unknown as ScanItemRow[]) || [];
      return this.mapToSavedScan(row as unknown as ScanRow, items);
    });

    return {
      scans,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    };
  }

  /**
   * Retrieves a single scan by ID.
   */
  async getScanById(scanId: string, userId?: string): Promise<SavedScan | null> {
    let query = this.client
      .from("scans")
      .select(
        `
        id,
        user_id,
        image_url,
        created_at,
        scan_items (
          id,
          scan_id,
          food_name,
          confidence,
          nutrition_source,
          nutrition_id,
          serving_basis,
          nutrients,
          highlights,
          created_at
        )
      `
      )
      .eq("id", scanId);

    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw new Error(`Failed to retrieve scan ${scanId}: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    const items = (data.scan_items as unknown as ScanItemRow[]) || [];
    return this.mapToSavedScan(data as unknown as ScanRow, items);
  }

  /**
   * Deletes a scan and its associated items.
   */
  async deleteScan(scanId: string, userId: string): Promise<boolean> {
    const { error, count } = await this.client
      .from("scans")
      .delete({ count: "exact" })
      .eq("id", scanId)
      .eq("user_id", userId);

    if (error) {
      throw new Error(`Failed to delete scan: ${error.message}`);
    }

    return (count || 0) > 0;
  }

  // ─── Private Row to DTO Mappers ───────────────────────────────────────────

  private mapToSavedScan(scanRow: ScanRow, itemRows: ScanItemRow[]): SavedScan {
    return {
      id: scanRow.id,
      userId: scanRow.user_id,
      imageUrl: scanRow.image_url,
      createdAt: scanRow.created_at,
      items: itemRows.map((item) => this.mapToSavedScanItem(item)),
    };
  }

  private mapToSavedScanItem(itemRow: ScanItemRow): SavedScanItem {
    const nutrientsObj = (typeof itemRow.nutrients === "object" && itemRow.nutrients !== null
      ? itemRow.nutrients
      : {}) as Record<string, unknown>;

    return {
      id: itemRow.id,
      scanId: itemRow.scan_id,
      foodName: itemRow.food_name,
      confidence: Number(itemRow.confidence),
      nutritionSource: itemRow.nutrition_source,
      nutritionId: itemRow.nutrition_id,
      servingBasis: itemRow.serving_basis,
      nutrients: {
        calories: typeof nutrientsObj.calories === "number" ? nutrientsObj.calories : null,
        macronutrients: (nutrientsObj.macronutrients || {
          protein: null,
          totalFat: null,
          saturatedFat: null,
          carbohydrates: null,
          fiber: null,
          sugar: null,
        }) as Macronutrients,
        micronutrients: (nutrientsObj.micronutrients || {
          sodium: null,
          cholesterol: null,
          potassium: null,
          vitaminA: null,
          vitaminC: null,
          calcium: null,
          iron: null,
        }) as Micronutrients,
      },
      highlights: (Array.isArray(itemRow.highlights)
        ? itemRow.highlights
        : []) as unknown as NutritionHighlight[],
      createdAt: itemRow.created_at,
    };
  }
}

// ─── Convenience Helper Functions ────────────────────────────────────────────

export async function saveCompletedScan(
  input: CreateScanInput,
  client?: SupabaseClient<Database>
): Promise<SavedScan> {
  const repo = new ScanRepository(client);
  return repo.saveScan(input);
}

export async function getScanHistory(
  options: ScanHistoryQueryOptions,
  client?: SupabaseClient<Database>
): Promise<ScanHistoryResult> {
  const repo = new ScanRepository(client);
  return repo.getScanHistory(options);
}

export async function getScanById(
  scanId: string,
  userId?: string,
  client?: SupabaseClient<Database>
): Promise<SavedScan | null> {
  const repo = new ScanRepository(client);
  return repo.getScanById(scanId, userId);
}

export async function deleteScan(
  scanId: string,
  userId: string,
  client?: SupabaseClient<Database>
): Promise<boolean> {
  const repo = new ScanRepository(client);
  return repo.deleteScan(scanId, userId);
}
