/**
 * Unit Tests — ScanRepository (Data Access Layer)
 *
 * Tests the DAL with a mocked SupabaseClient to verify:
 * 1. saveScan inserts parent and child rows and returns mapped domain models
 * 2. getScanHistory returns paginated scan structures with nested items
 * 3. getScanById retrieves a specific scan or returns null
 * 4. deleteScan removes the record by ID and user ID
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ScanRepository } from "../scan-repository";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types";

describe("ScanRepository", () => {
  let mockSupabase: any;
  let repository: ScanRepository;

  beforeEach(() => {
    mockSupabase = {
      from: vi.fn(),
      auth: {
        getUser: vi.fn(),
      },
    };
    repository = new ScanRepository(mockSupabase as unknown as SupabaseClient<Database>);
  });

  describe("saveScan", () => {
    it("successfully creates a parent scan and child scan items", async () => {
      const mockScanRow = {
        id: "scan-uuid-1",
        user_id: "550e8400-e29b-41d4-a716-446655440000",
        image_ref: null,
        image_quality: "good",
        notes: "Test note",
        created_at: "2026-10-01T12:00:00Z",
      };

      const mockItemRows = [
        {
          id: "item-uuid-1",
          scan_id: "scan-uuid-1",
          food_name: "Apple",
          canonical_name: "Apples, raw",
          confidence: 0.95,
          description: null,
          estimated_portion: "1 medium",
          serving_amount: 100,
          serving_unit: "g",
          calories: 52,
          nutrition_status: "found",
          macronutrients: { protein: 0.3, totalFat: 0.2 },
          micronutrients: { potassium: 107 },
          source: "usda_fdc",
          source_id: "1750339",
          source_url: null,
          match_confidence: "exact",
          highlights: [],
          created_at: "2026-10-01T12:00:00Z",
        },
      ];

      // Mock chain for food_scans insert
      const mockScanInsertChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockScanRow, error: null }),
      };

      // Mock chain for scan_items insert
      const mockItemsInsertChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({ data: mockItemRows, error: null }),
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "food_scans") return mockScanInsertChain;
        if (table === "scan_items") return mockItemsInsertChain;
        return {};
      });

      const savedScan = await repository.saveScan({
        userId: "550e8400-e29b-41d4-a716-446655440000",
        imageQuality: "good",
        notes: "Test note",
        items: [
          {
            foodName: "Apple",
            canonicalName: "Apples, raw",
            confidence: 0.95,
            estimatedPortion: "1 medium",
            servingAmount: 100,
            servingUnit: "g",
            calories: 52,
          },
        ],
      });

      expect(savedScan.id).toBe("scan-uuid-1");
      expect(savedScan.userId).toBe("550e8400-e29b-41d4-a716-446655440000");
      expect(savedScan.items).toHaveLength(1);
      expect(savedScan.items[0].foodName).toBe("Apple");
      expect(savedScan.items[0].calories).toBe(52);
    });

    it("cleans up orphaned parent scan if inserting items fails", async () => {
      const mockScanRow = {
        id: "scan-uuid-orphan",
        user_id: "550e8400-e29b-41d4-a716-446655440000",
        image_ref: null,
        image_quality: "good",
        notes: null,
        created_at: "2026-10-01T12:00:00Z",
      };

      const mockScanChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockScanRow, error: null }),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };

      const mockItemsChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({ data: null, error: { message: "DB write failed" } }),
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "food_scans") return mockScanChain;
        if (table === "scan_items") return mockItemsChain;
        return {};
      });

      await expect(
        repository.saveScan({
          userId: "550e8400-e29b-41d4-a716-446655440000",
          items: [
            {
              foodName: "Apple",
              canonicalName: "Apples, raw",
              confidence: 0.95,
            },
          ],
        })
      ).rejects.toThrow("Failed to save scan items: DB write failed");

      // Verify cleanup delete was called
      expect(mockScanChain.delete).toHaveBeenCalled();
      expect(mockScanChain.eq).toHaveBeenCalledWith("id", "scan-uuid-orphan");
    });
  });

  describe("getScanHistory", () => {
    it("retrieves paginated scan history and maps nested items", async () => {
      const mockScansData = [
        {
          id: "scan-1",
          user_id: "550e8400-e29b-41d4-a716-446655440000",
          image_ref: null,
          image_quality: "good",
          notes: "Breakfast",
          created_at: "2026-10-01T08:00:00Z",
          scan_items: [
            {
              id: "item-1",
              scan_id: "scan-1",
              food_name: "Oatmeal",
              canonical_name: "Oatmeal, cooked",
              confidence: 0.92,
              serving_amount: 100,
              serving_unit: "g",
              calories: 68,
              nutrition_status: "found",
              macronutrients: {},
              micronutrients: {},
              source: "usda_fdc",
              highlights: [],
              created_at: "2026-10-01T08:00:00Z",
            },
          ],
        },
      ];

      const countChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ count: 1, error: null }),
      };

      const selectChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: mockScansData, error: null }),
      };

      let countCall = true;
      mockSupabase.from.mockImplementation(() => {
        if (countCall) {
          countCall = false;
          return countChain;
        }
        return selectChain;
      });

      const result = await repository.getScanHistory({
        userId: "550e8400-e29b-41d4-a716-446655440000",
        limit: 10,
        offset: 0,
      });

      expect(result.total).toBe(1);
      expect(result.scans).toHaveLength(1);
      expect(result.scans[0].items[0].foodName).toBe("Oatmeal");
      expect(result.hasMore).toBe(false);
    });

    it("returns empty result if user has no scans", async () => {
      const countChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
      };

      mockSupabase.from.mockReturnValue(countChain);

      const result = await repository.getScanHistory({
        userId: "550e8400-e29b-41d4-a716-446655440000",
      });

      expect(result.total).toBe(0);
      expect(result.scans).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });
  });

  describe("getScanById", () => {
    it("returns a single scan when found", async () => {
      const mockScanData = {
        id: "scan-123",
        user_id: "550e8400-e29b-41d4-a716-446655440000",
        image_ref: null,
        image_quality: "good",
        notes: null,
        created_at: "2026-10-01T08:00:00Z",
        scan_items: [],
      };

      const queryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: mockScanData, error: null }),
      };

      mockSupabase.from.mockReturnValue(queryChain);

      const scan = await repository.getScanById("scan-123", "550e8400-e29b-41d4-a716-446655440000");

      expect(scan).not.toBeNull();
      expect(scan?.id).toBe("scan-123");
    });

    it("returns null when scan is not found", async () => {
      const queryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      mockSupabase.from.mockReturnValue(queryChain);

      const scan = await repository.getScanById("nonexistent-id");
      expect(scan).toBeNull();
    });
  });

  describe("deleteScan", () => {
    it("returns true when scan is deleted", async () => {
      const deleteChain = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      };
      // second .eq() call returns the resolution with count: 1
      deleteChain.eq.mockReturnValueOnce(deleteChain).mockResolvedValueOnce({ error: null, count: 1 });

      mockSupabase.from.mockReturnValue(deleteChain);

      const success = await repository.deleteScan("scan-1", "user-1");
      expect(success).toBe(true);
    });
  });
});
