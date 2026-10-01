import { NextRequest, NextResponse } from "next/server";
import { ScanRepository, createSupabaseClient } from "@/lib/db";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/scans/[id]
 *
 * Retrieves a single food scan by its unique ID.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const authHeader = request.headers.get("authorization");
    const searchParams = request.nextUrl.searchParams;

    let userId = searchParams.get("userId") || undefined;

    const supabase = createSupabaseClient(authHeader || undefined);

    if (!userId && authHeader) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        userId = user.id;
      }
    }

    const repo = new ScanRepository(supabase);
    const scan = await repo.getScanById(id, userId);

    if (!scan) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "SCAN_NOT_FOUND",
            message: `Food scan with ID '${id}' was not found`,
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: scan,
    });
  } catch (error) {
    console.error("Error in GET /api/scans/[id]:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "SCAN_FETCH_ERROR",
          message: error instanceof Error ? error.message : "Failed to retrieve scan",
        },
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/scans/[id]
 *
 * Deletes a scan and its associated items. Requires user authentication.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const authHeader = request.headers.get("authorization");
    const searchParams = request.nextUrl.searchParams;

    let userId = searchParams.get("userId");

    const supabase = createSupabaseClient(authHeader || undefined);

    if (!userId && authHeader) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        userId = user.id;
      }
    }

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required to delete a scan.",
          },
        },
        { status: 401 }
      );
    }

    const repo = new ScanRepository(supabase);
    const deleted = await repo.deleteScan(id, userId);

    if (!deleted) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "SCAN_NOT_FOUND",
            message: `Food scan with ID '${id}' was not found or you do not have permission to delete it.`,
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { deleted: true, id },
    });
  } catch (error) {
    console.error("Error in DELETE /api/scans/[id]:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "SCAN_DELETE_ERROR",
          message: error instanceof Error ? error.message : "Failed to delete scan",
        },
      },
      { status: 500 }
    );
  }
}
