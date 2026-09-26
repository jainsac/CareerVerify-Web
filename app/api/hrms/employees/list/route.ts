import { NextResponse } from "next/server";
import { currentUser } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const organizationId = new URL(req.url).searchParams.get("organizationId") || "";
  const member = await prisma.organizationMember.findFirst({ where: { userId: user.id, organizationId } });
  if (!member) return NextResponse.json({ error: "Organization access denied" }, { status: 403 });

  const rows = await prisma.employmentRecord.findMany({
    where: { organizationId },
    include: { careerProfile: { select: { careerId: true, user: { select: { name: true, email: true } } } } },
    orderBy: { joinedAt: "desc" },
  });
  return NextResponse.json(rows);
}
