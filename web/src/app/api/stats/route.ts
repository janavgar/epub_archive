import { NextResponse } from "next/server";
import { getArchiveStats } from "@/lib/db";

export async function GET() {
  try {
    const stats = getArchiveStats();
    return NextResponse.json(stats);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
