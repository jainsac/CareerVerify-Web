import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user?.careerProfile) return NextResponse.json({ error: "Employee authentication required" }, { status: 401 });

  const query = new URL(req.url).searchParams.get("q")?.trim() || "";
  if (query.length < 2) return NextResponse.json([]);

  const organizations = await prisma.organization.findMany({
    where: {
      verifiedAt: { not: null },
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { cin: { contains: query, mode: "insensitive" } },
        { gstin: { contains: query, mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, cin: true, gstin: true },
    orderBy: { name: "asc" },
    take: 20,
  });

  return NextResponse.json(organizations);
}
