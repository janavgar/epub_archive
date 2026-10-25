import { NextResponse } from "next/server";
import { getErrorBooks } from "@/lib/db";

export async function GET() {
  try {
    const errorBooks = getErrorBooks();
    return NextResponse.json({
      count: errorBooks.length,
      books: errorBooks,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
