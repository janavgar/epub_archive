import { NextResponse } from "next/server";
import { processManager } from "@/lib/processManager";

export async function POST() {
  const result = processManager.stopProcess();
  return NextResponse.json(result);
}
