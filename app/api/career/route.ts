import { NextResponse, type NextRequest } from "next/server";
import { fetchCareer } from "@/lib/career";

/**
 * GET /api/career?ea_id=...&platform=pc
 * Thin wrapper over fetchCareer for optional client-side refreshes.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const eaId = searchParams.get("ea_id") ?? "";
  const platform = searchParams.get("platform") ?? "pc";
  const stats = await fetchCareer(eaId, platform);
  return NextResponse.json(stats);
}
