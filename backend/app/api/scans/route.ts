import { NextRequest, NextResponse } from "next/server";
import {
  ScanRepository,
  createSupabaseClient,
  CreateScanInputSchema,
  ScanHistoryQuerySchema,
} from "@/lib/db";

/**
 * GET /api/scans
 *
 * Retrieves paginated scan history for the authenticated user.
 * Supports query parameters:
 *  - limit: number (default 20, max 50)
 *  - offset: number (default 0)
 *  - userId: string (optional query param if running in dev/test, or extracted from Bearer token)
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const searchParams = request.nextUrl.searchParams;

    let userId = searchParams.get("userId");

    // Initialize Supabase client
    const supabase = createSupabaseClient(authHeader || undefined);

    // If no explicit userId was passed in query, try to get it from Supabase auth
    if (!userId && authHeader) {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!authError && user) {
        userId = user.id;
      }
    }

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required to retrieve scan history. Provide a Bearer token or userId parameter.",
          },
        },
        { status: 401 }
      );
    }

    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const validation = ScanHistoryQuerySchema.safeParse({ userId, limit, offset });
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: validation.error.errors.map((e) => e.message).join(", "),
          },
        },
        { status: 400 }
      );
    }

    const repo = new ScanRepository(supabase);
    const history = await repo.getScanHistory(validation.data);

    return NextResponse.json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error("Error in GET /api/scans:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "SCAN_FETCH_ERROR",
          message: error instanceof Error ? error.message : "Failed to retrieve scan history",
        },
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/scans
 *
 * Saves a completed scan with its items into the database.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const body = await request.json();

    const supabase = createSupabaseClient(authHeader || undefined);

    // If authenticated, attach user ID if not provided
    if (!body.userId && authHeader) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        body.userId = user.id;
      }
    }

    const validation = CreateScanInputSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: validation.error.errors.map((e) => e.message).join(", "),
          },
        },
        { status: 400 }
      );
    }

    const repo = new ScanRepository(supabase);
    const savedScan = await repo.saveScan(validation.data);

    return NextResponse.json(
      {
        success: true,
        data: savedScan,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in POST /api/scans:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "SCAN_SAVE_ERROR",
          message: error instanceof Error ? error.message : "Failed to save food scan",
        },
      },
      { status: 500 }
    );
  }
}
