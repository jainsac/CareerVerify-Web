import { NextResponse } from "next/server";
import { currentUser } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const memberships = await prisma.organizationMember.findMany({
    where: { userId: user.id },
    include: { organization: true },
  });

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    careerId: user.careerProfile?.careerId ?? null,
    careerProfile: user.careerProfile ? { id: user.careerProfile.id, careerId: user.careerProfile.careerId } : null,
    organizations: memberships.map(m => ({ ...m.organization, membershipRole: m.role })),
  });
}
