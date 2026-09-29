import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await currentUser();
  if (!user || user.role === "EMPLOYEE") return NextResponse.json({ error: "Employer access required" }, { status: 401 });

  const memberships = await prisma.organizationMember.findMany({
    where: { userId: user.id },
    select: { organizationId: true },
  });
  const ownedOrganizations = await prisma.organization.findMany({
    where: { createdByUserId: user.id },
    select: { id: true },
  });
  const orgIds = [...new Set([
    ...memberships.map(x => x.organizationId),
    ...ownedOrganizations.map(x => x.id),
  ])];
  const accountOrganizations = await prisma.organization.findMany({
    where: { id: { in: orgIds } },
    select: { id: true, name: true },
  });
  const orgNames = accountOrganizations.map(x => x.name);
  if (!orgIds.length) return NextResponse.json([]);

  const issueRows = await prisma.employmentIssueRequest.findMany({
    where: {
      status: "PENDING",
      employmentRecord: {
        OR: [
          { organizationId: { in: orgIds } },
          { organization: { name: { in: orgNames, mode: "insensitive" } } },
        ],
      },
    },
    include: {
      employmentRecord: {
        include: {
          organization: { select: { name: true } },
          careerProfile: { select: { careerId: true, user: { select: { name: true } } } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const reverificationRows = await prisma.employmentRecord.findMany({
    where: {
      OR: [
        { organizationId: { in: orgIds } },
        { organization: { name: { in: orgNames, mode: "insensitive" } } },
      ],
      reverificationPendingAt: { not: null },
    },
    include: {
      organization: { select: { name: true } },
      careerProfile: { select: { careerId: true, user: { select: { name: true } } } },
      documents: { orderBy: { createdAt: "desc" } },
    },
    orderBy: { reverificationPendingAt: "desc" },
  });

  return NextResponse.json([
    ...issueRows.map(x => ({
      id: x.id,
      kind: "CORRECTION_REQUEST",
      employmentRecordId: x.employmentRecordId,
      careerId: x.employmentRecord.careerProfile.careerId,
      employeeName: x.employmentRecord.careerProfile.user.name,
      organization: x.employmentRecord.organization.name,
      designation: x.employmentRecord.designation,
      department: x.employmentRecord.department,
      employmentType: x.employmentRecord.employmentType,
      joinedAt: x.employmentRecord.joinedAt,
      leftAt: x.employmentRecord.leftAt,
      concern: x.concern,
      pendingSince: x.createdAt,
    })),
    ...reverificationRows.map(x => ({
      id: x.id,
      kind: "REVERIFICATION",
      employmentRecordId: x.id,
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
    })),
  ]);
}

export async function PATCH(req: Request) {
  const user = await currentUser();
  if (!user || user.role === "EMPLOYEE") return NextResponse.json({ error: "Employer access required" }, { status: 401 });

  const body = await req.json();
  const requestId = String(body.requestId ?? "").trim();
  const employmentRecordId = String(body.employmentRecordId ?? "").trim();
  const approved = body.approved === true;
  const notes = String(body.notes ?? "").trim();

  // First handle the employee's correction request.
  if (requestId) {
    const issue = await prisma.employmentIssueRequest.findUnique({
      where: { id: requestId },
      include: { employmentRecord: { select: { id: true, organizationId: true, careerProfileId: true, verifiedAt: true } } },
    });
    if (issue) {
      const membership = await prisma.organizationMember.findFirst({
        where: { userId: user.id, organizationId: issue.employmentRecord.organizationId },
      });
      const owned = await prisma.organization.findFirst({
        where: { id: issue.employmentRecord.organizationId, createdByUserId: user.id },
        select: { id: true },
      });
      const accountOrg = await prisma.organization.findFirst({
        where: {
          id: issue.employmentRecord.organizationId,
          name: { in: orgNames, mode: "insensitive" },
        },
        select: { id: true },
      });
      if (!membership && !owned && !accountOrg) return NextResponse.json({ error: "You are not authorized for this employer" }, { status: 403 });
      if (issue.status !== "PENDING") return NextResponse.json({ error: "This correction request is already closed" }, { status: 409 });

      const now = new Date();
      await prisma.employmentIssueRequest.update({
        where: { id: issue.id },
        data: {
          status: approved ? "ACCEPTED" : "REJECTED",
          employerResponse: notes || null,
          reviewedByUserId: user.id,
          reviewedAt: now,
        },
      });

      if (approved) {
        await prisma.employmentRecord.update({
          where: { id: issue.employmentRecord.id },
          data: {
            editUnlockedAt: now,
            editUnlockReason: notes || "Employer accepted the employee's correction request.",
          },
        });
      }

      const profile = await prisma.careerProfile.findUnique({
        where: { id: issue.employmentRecord.careerProfileId },
        select: { userId: true },
      });
      if (profile) {
        await prisma.notification.create({
          data: {
            userId: profile.userId,
            type: "EMPLOYMENT_CORRECTION_RESULT",
            title: approved ? "Correction request accepted" : "Correction request rejected",
            message: approved
              ? "Your employer accepted the correction request. You can now edit the experience and submit it for re-verification."
              : "Your employer rejected the correction request." + (notes ? " Response: " + notes : ""),
          },
        });
      }

      await prisma.auditEvent.create({
        data: {
          actorUserId: user.id,
          action: approved ? "EMPLOYMENT_CORRECTION_REQUEST_ACCEPTED" : "EMPLOYMENT_CORRECTION_REQUEST_REJECTED",
          entityType: "EmploymentIssueRequest",
          entityId: issue.id,
          metadata: { employmentRecordId: issue.employmentRecord.id, response: notes || null },
        },
      });

      return NextResponse.json({ ok: true, correctionAccepted: approved, editUnlocked: approved });
    }
  }

  // Handle a corrected experience that is now waiting for re-verification.
  if (!employmentRecordId) return NextResponse.json({ error: "requestId or employmentRecordId is required" }, { status: 400 });

  const row = await prisma.employmentRecord.findUnique({
    where: { id: employmentRecordId },
    select: { id: true, organizationId: true, careerProfileId: true },
  });
  if (!row) return NextResponse.json({ error: "Employment record not found" }, { status: 404 });

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: user.id, organizationId: row.organizationId },
  });
  const owned = await prisma.organization.findFirst({
    where: { id: row.organizationId, createdByUserId: user.id },
    select: { id: true },
  });
  if (!membership && !owned) return NextResponse.json({ error: "You are not authorized for this employer" }, { status: 403 });

  if (!approved) {
    const updated = await prisma.employmentRecord.update({
      where: { id: employmentRecordId },
      data: {
        reverificationPendingAt: null,
        editUnlockedAt: null,
        editUnlockReason: notes || "Employer did not re-verify the corrected experience.",
      },
    });
    return NextResponse.json({ ok: true, employment: updated, verified: false });
  }

  const updated = await prisma.employmentRecord.update({
    where: { id: employmentRecordId },
    data: {
      verifiedAt: new Date(),
      reverificationPendingAt: null,
      editUnlockedAt: null,
      editUnlockReason: null,
    },
  });

  await prisma.auditEvent.create({
    data: {
      actorUserId: user.id,
      action: "CORRECTED_EMPLOYMENT_REVERIFIED",
      entityType: "EmploymentRecord",
      entityId: employmentRecordId,
      metadata: { notes: notes || null, organizationId: row.organizationId },
    },
  });

  const profile = await prisma.careerProfile.findUnique({
    where: { id: row.careerProfileId },
    select: { userId: true },
  });
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
