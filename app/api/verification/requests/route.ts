import { NextResponse } from "next/server";
import { currentUser } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

export async function GET() {
  const user = await currentUser();
  if (!user?.careerProfile) return NextResponse.json({ error: "Employee authentication required" }, { status: 401 });

  const rows = await prisma.verificationRequest.findMany({
    where: { careerProfileId: user.careerProfile.id },
    include: {
      response: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const orgIds = [...new Set(rows.flatMap(r => [r.requestingOrgId, r.priorOrgId]))];
  const orgs = await prisma.organization.findMany({ where: { id: { in: orgIds } }, select: { id: true, name: true } });
  const names = new Map(orgs.map(o => [o.id, o.name]));

  return NextResponse.json(rows.map(r => ({
    id: r.id,
    status: r.status,
    expiresAt: r.expiresAt,
    consentedAt: r.consentedAt,
    respondedAt: r.respondedAt,
    requestingOrganization: names.get(r.requestingOrgId) ?? "Unknown organization",
    priorOrganization: names.get(r.priorOrgId) ?? "Unknown organization",
    response: r.response ? {
      verified: r.response.verified,
      designation: r.response.designation,
      joinedAt: r.response.joinedAt,
      leftAt: r.response.leftAt,
      notes: r.response.notes,
    } : null,
  })));
}
