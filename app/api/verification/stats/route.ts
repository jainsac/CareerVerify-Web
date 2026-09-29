import { NextResponse } from "next/server";
import { currentUser } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

export async function GET() {
  const user = await currentUser();
  if (!user || user.role === "EMPLOYEE") {
    return NextResponse.json({ error: "Authorized employer account required" }, { status: 401 });
  }

  const memberships = await prisma.organizationMember.findMany({
    where: { userId: user.id },
    select: { organizationId: true },
  });
  const orgIds = [...new Set(memberships.map((m) => m.organizationId))];

  if (!orgIds.length) {
    return NextResponse.json({
      sent: { total: 0, accepted: 0, rejected: 0, pending: 0, expired: 0 },
      received: { total: 0, accepted: 0, rejected: 0, pending: 0, expired: 0 },
    });
  }

  const [sent, received] = await Promise.all([
    prisma.verificationRequest.findMany({
      where: { requestingOrgId: { in: orgIds } },
      select: { status: true },
    }),
    prisma.verificationRequest.findMany({
      where: { priorOrgId: { in: orgIds } },
      select: { status: true },
    }),
  ]);

  const summarize = (rows: { status: string }[]) => ({
    total: rows.length,
    accepted: rows.filter((r) => r.status === "VERIFIED" || r.status === "APPROVED").length,
    rejected: rows.filter((r) => r.status === "REJECTED").length,
    pending: rows.filter((r) => r.status === "PENDING").length,
    expired: rows.filter((r) => r.status === "EXPIRED").length,
  });

  return NextResponse.json({
    sent: summarize(sent),
    received: summarize(received),
  });
}
