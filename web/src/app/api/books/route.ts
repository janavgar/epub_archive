import { NextRequest, NextResponse } from "next/server";
import { getBooks } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const category = searchParams.get("category") || undefined;
    const status = searchParams.get("status") || undefined;
    const clusterIdStr = searchParams.get("cluster");
    const clusterId = clusterIdStr !== null && clusterIdStr !== undefined ? parseInt(clusterIdStr, 10) : undefined;
    const limit = parseInt(searchParams.get("limit") || "60", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const result = getBooks({
      search,
      category,
      status,
      clusterId,
      limit,
      offset,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
