import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await currentUser();
  if (!user || user.role === "EMPLOYEE") {
    return NextResponse.json({ error: "Employer access required" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const [memberships, owned] = await Promise.all([
    prisma.organizationMember.findMany({ where: { userId: user.id }, select: { organizationId: true } }),
    prisma.organization.findMany({ where: { createdByUserId: user.id }, select: { id: true } }),
  ]);

  const orgIds = [...new Set([...memberships.map(x => x.organizationId), ...owned.map(x => x.id)])];
  const accountOrganizations = await prisma.organization.findMany({
    where: { id: { in: orgIds } },
    select: { id: true, name: true },
  });
  const orgNames = accountOrganizations.map(x => x.name);

  if (!orgIds.length) {
    return NextResponse.json({ total: 0, verification: 0, corrections: 0, additionalInfo: 0 }, { headers: { "Cache-Control": "no-store" } });
  }

  const [verification, corrections, additionalInfo] = await Promise.all([
    prisma.verificationRequest.count({
      where: { priorOrgId: { in: orgIds }, status: "PENDING" },
    }),
    prisma.employmentIssueRequest.count({
      where: {
        status: "PENDING",
        employmentRecord: {
          OR: [
            { organizationId: { in: orgIds } },
            { organization: { createdByUserId: user.id } },
            ...(orgNames.length ? [{ organization: { name: { in: orgNames, mode: "insensitive" } } }] : []),
          ],
        },
      },
    }),
    prisma.additionalInformationRequest.count({
      where: {
        status: "PENDING",
        employmentRecord: {
          OR: [
            { organizationId: { in: orgIds } },
            { organization: { createdByUserId: user.id } },
            ...(orgNames.length ? [{ organization: { name: { in: orgNames, mode: "insensitive" } } }] : []),
          ],
        },
      },
    }),
  ]);

  return NextResponse.json(
    { total: verification + corrections + additionalInfo, verification, corrections, additionalInfo },
    { headers: { "Cache-Control": "no-store" } },
  );
}
