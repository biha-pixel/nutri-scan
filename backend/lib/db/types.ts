/**
 * Database Types for NutriScan
 *
 * Defines TypeScript representations of the PostgreSQL database schema
 * managed by Supabase, including row shapes, insert payloads, and domain DTOs.
 */

import type { Macronutrients, Micronutrients } from "@/lib/nutrition/types";
import type { NutritionHighlight } from "@/lib/highlights/types";

// ─── Database Row Definitions (PostgreSQL Table Mapping) ────────────────────

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ProfileRow = {
  id: string; // UUID references auth.users(id)
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type ScanRow = {
  id: string; // UUID primary key
  user_id: string; // UUID foreign key to auth.users
  image_url: string | null; // Optional storage path
  created_at: string;
};

export type ScanItemRow = {
  id: string; // UUID primary key
  scan_id: string; // UUID foreign key to scans
  food_name: string;
  confidence: number;
  nutrition_source: string;
  nutrition_id: string | null;
  serving_basis: string;
  nutrients: Json;
  highlights: Json;
  created_at: string;
};

// ─── Supabase Generic Database Schema Representation ────────────────────────

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: {
          id: string;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      scans: {
        Row: ScanRow;
        Insert: {
          id?: string;
          user_id: string;
          image_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          image_url?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "scans_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      scan_items: {
        Row: ScanItemRow;
        Insert: {
          id?: string;
          scan_id: string;
          food_name: string;
          confidence: number;
          nutrition_source?: string;
          nutrition_id?: string | null;
          serving_basis?: string;
          nutrients?: Json;
          highlights?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          scan_id?: string;
          food_name?: string;
          confidence?: number;
          nutrition_source?: string;
          nutrition_id?: string | null;
          serving_basis?: string;
          nutrients?: Json;
          highlights?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "scan_items_scan_id_fkey";
            columns: ["scan_id"];
            isOneToOne: false;
            referencedRelation: "scans";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

// ─── Domain DTOs (Application Layer Interfaces) ─────────────────────────────

export interface CreateScanItemInput {
  foodName: string;
  confidence: number;
  nutritionSource?: string;
  nutritionId?: string | null;
  servingBasis?: string;
  nutrients?: {
    calories?: number | null;
    macronutrients?: Macronutrients;
    micronutrients?: Micronutrients;
  };
  highlights?: NutritionHighlight[];
}

export interface CreateScanInput {
  userId?: string | null;
  imageUrl?: string | null;
  items: CreateScanItemInput[];
}

export interface SavedScanItem {
  id: string;
  scanId: string;
  foodName: string;
  confidence: number;
  nutritionSource: string;
  nutritionId: string | null;
  servingBasis: string;
  nutrients: {
    calories?: number | null;
    macronutrients?: Macronutrients;
    micronutrients?: Micronutrients;
  };
  highlights: NutritionHighlight[];
  createdAt: string;
}

export interface SavedScan {
  id: string;
  userId: string;
  imageUrl: string | null;
  createdAt: string;
  items: SavedScanItem[];
}

export interface ScanHistoryQueryOptions {
  userId: string;
  limit?: number;
  offset?: number;
}

export interface ScanHistoryResult {
  scans: SavedScan[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}
