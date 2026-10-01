import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await currentUser();
  if (!user || user.role === "EMPLOYEE") return NextResponse.json({ error: "Employer access required" }, { status: 401 });

  const [memberships, owned] = await Promise.all([
    prisma.organizationMember.findMany({ where: { userId: user.id }, select: { organizationId: true } }),
    prisma.organization.findMany({ where: { createdByUserId: user.id }, select: { id: true } }),
  ]);

  const orgIds = [...new Set([...memberships.map(x => x.organizationId), ...owned.map(x => x.id)])];
  if (!orgIds.length) return NextResponse.json({ total: 0, verification: 0, corrections: 0, additionalInfo: 0 });

  const [verification, corrections, additionalInfo] = await Promise.all([
    prisma.verificationRequest.count({ where: { priorOrgId: { in: orgIds }, status: "PENDING" } }),
    prisma.employmentIssueRequest.count({
      where: {
        status: "PENDING",
        employmentRecord: { organizationId: { in: orgIds } },
      },
    }),
    prisma.additionalInformationRequest.count({
      where: {
        status: "PENDING",
        employmentRecord: { organizationId: { in: orgIds } },
      },
    }),
  ]);

  return NextResponse.json({
    total: verification + corrections + additionalInfo,
    verification,
    corrections,
    additionalInfo,
  });
}
