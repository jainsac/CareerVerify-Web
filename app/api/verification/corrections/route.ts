import { NextResponse } from "next/server";
import { currentUser } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

export async function GET() {
  const user = await currentUser();
  if (!user || user.role === "EMPLOYEE") return NextResponse.json({ error: "Employer access required" }, { status: 401 });

  const memberships = await prisma.organizationMember.findMany({ where: { userId: user.id }, select: { organizationId: true } });
  const orgIds = memberships.map(x => x.organizationId);
  if (!orgIds.length) return NextResponse.json([]);

  const rows = await prisma.employmentRecord.findMany({
    where: { organizationId: { in: orgIds }, reverificationPendingAt: { not: null } },
    include: {
      organization: { select: { name: true } },
      careerProfile: { select: { careerId: true, user: { select: { name: true } } } },
      documents: { orderBy: { createdAt: "desc" } },
    },
    orderBy: { reverificationPendingAt: "desc" },
  });

  return NextResponse.json(rows.map(x => ({
    id: x.id,
    careerId: x.careerProfile.careerId,
    employeeName: x.careerProfile.user.name,
    organization: x.organization.name,
    designation: x.designation,
    department: x.department,
    employmentType: x.employmentType,
    joinedAt: x.joinedAt,
    leftAt: x.leftAt,
    documents: x.documents,
    pendingSince: x.reverificationPendingAt,
  })));
}

export async function PATCH(req: Request) {
  const user = await currentUser();
  if (!user || user.role === "EMPLOYEE") return NextResponse.json({ error: "Employer access required" }, { status: 401 });

  const body = await req.json();
  const id = String(body.employmentRecordId ?? "").trim();
  const approved = body.approved === true;
  const notes = String(body.notes ?? "").trim();

  const row = await prisma.employmentRecord.findUnique({ where: { id }, select: { id: true, organizationId: true, careerProfileId: true } });
  if (!row) return NextResponse.json({ error: "Employment record not found" }, { status: 404 });

  const membership = await prisma.organizationMember.findFirst({ where: { userId: user.id, organizationId: row.organizationId } });
  if (!membership) return NextResponse.json({ error: "You are not authorized for this employer" }, { status: 403 });

  if (!approved) {
    const updated = await prisma.employmentRecord.update({
      where: { id },
      data: { reverificationPendingAt: null, editUnlockedAt: null, editUnlockReason: notes || "Employer did not re-verify the corrected experience." },
    });
    return NextResponse.json({ ok: true, employment: updated, verified: false });
  }

  const updated = await prisma.employmentRecord.update({
    where: { id },
    data: { verifiedAt: new Date(), reverificationPendingAt: null, editUnlockedAt: null, editUnlockReason: null },
  });

  await prisma.auditEvent.create({
    data: {
      actorUserId: user.id,
      action: "CORRECTED_EMPLOYMENT_REVERIFIED",
      entityType: "EmploymentRecord",
      entityId: id,
      metadata: { notes: notes || null, organizationId: row.organizationId },
    },
  });

  const profile = await prisma.careerProfile.findUnique({ where: { id: row.careerProfileId }, select: { userId: true } });
  if (profile) {
    await prisma.notification.create({
      data: {
        userId: profile.userId,
        type: "EMPLOYMENT_REVERIFICATION_RESULT",
        title: "Corrected experience verified",
        message: "Your employer has re-verified the corrected employment experience.",
      },
    });
  }

  return NextResponse.json({ ok: true, employment: updated, verified: true });
}
