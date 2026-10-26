import { NextRequest, NextResponse } from "next/server";
import { getDuplicateGroups } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const typeParam = searchParams.get("type") as "all" | "sha256" | "title_author" | null;
    const searchParam = searchParams.get("search") || undefined;

    const type = typeParam === "sha256" || typeParam === "title_author" ? typeParam : "all";

    const data = getDuplicateGroups({
      type,
      search: searchParam,
    });

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
