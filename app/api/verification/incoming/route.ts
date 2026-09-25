import { NextResponse } from "next/server";
import { currentUser } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

export async function GET() {
  const user = await currentUser();
  if (!user || user.role === "EMPLOYEE") return NextResponse.json({ error: "Authorized employer account required" }, { status: 401 });
  const memberships = await prisma.organizationMember.findMany({ where: { userId: user.id }, select: { organizationId: true } });
  const orgIds = memberships.map(m => m.organizationId);
  if (!orgIds.length) return NextResponse.json([]);
  const rows = await prisma.verificationRequest.findMany({
    where: { priorOrgId: { in: orgIds } },
    include: { careerProfile: { select: { careerId: true, user: { select: { name: true } } } }, response: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(rows.map(r => ({
    id: r.id, careerId: r.careerProfile.careerId, employeeName: r.careerProfile.user.name,
    requestingOrgId: r.requestingOrgId, priorOrgId: r.priorOrgId, status: r.status,
    expiresAt: r.expiresAt, consentedAt: r.consentedAt, respondedAt: r.respondedAt,
    response: r.response ? { verified: r.response.verified, designation: r.response.designation, joinedAt: r.response.joinedAt, leftAt: r.response.leftAt, notes: r.response.notes } : null,
  })));
}
