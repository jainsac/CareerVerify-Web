import { NextResponse } from "next/server";
import { currentUser } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user || user.role === "EMPLOYEE") return NextResponse.json({ error: "Authorized employer account required" }, { status: 401 });
  const careerId = new URL(req.url).searchParams.get("careerId")?.trim() || "";
  if (!careerId) return NextResponse.json({ error: "careerId is required" }, { status: 400 });

  const profile = await prisma.careerProfile.findUnique({ where: { careerId }, select: { id: true } });
  if (!profile) return NextResponse.json({ error: "Career ID not found" }, { status: 404 });

  const employments = await prisma.employmentRecord.findMany({
    where: { careerProfileId: profile.id },
    select: { organization: { select: { id: true, name: true } } },
    distinct: ["organizationId"],
  });
  return NextResponse.json(employments.map(x => x.organization));
}
