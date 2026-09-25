import { NextResponse } from "next/server";
import { generateUniqueCareerId } from "@/lib/career-id";

export async function GET() {
  const careerId = await generateUniqueCareerId();
  return NextResponse.json({ careerId });
}
