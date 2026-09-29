import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await currentUser();
  if (!user?.careerProfile) return NextResponse.json({ error: "Employee authentication required" }, { status: 401 });

  const rows = await prisma.employmentIssueRequest.findMany({
    where: { raisedByUserId: user.id },
    include: { employmentRecord: { select: { organization: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(rows.map(x => ({
    id: x.id,
    employmentRecordId: x.employmentRecordId,
    organization: x.employmentRecord.organization.name,
    concern: x.concern,
    status: x.status,
    employerResponse: x.employerResponse,
    reviewedAt: x.reviewedAt,
    createdAt: x.createdAt,
  })));
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user?.careerProfile) return NextResponse.json({ error: "Employee authentication required" }, { status: 401 });

  const body = await req.json();
  const employmentRecordId = String(body.employmentRecordId ?? "").trim();
  const concern = String(body.concern ?? "").trim();

  if (!employmentRecordId || concern.length < 5) {
    return NextResponse.json({ error: "employmentRecordId and a clear concern are required" }, { status: 400 });
  }

  const record = await prisma.employmentRecord.findFirst({
    where: { id: employmentRecordId, careerProfileId: user.careerProfile.id },
    select: { id: true, verifiedAt: true, organizationId: true, organization: { select: { name: true } } },
  });
  if (!record) return NextResponse.json({ error: "Employment record not found" }, { status: 404 });
  if (!record.verifiedAt) return NextResponse.json({ error: "Issue requests are available only for verified experiences" }, { status: 409 });

  const pending = await prisma.employmentIssueRequest.findFirst({
    where: { employmentRecordId, raisedByUserId: user.id, status: "PENDING" },
    select: { id: true },
  });
  if (pending) return NextResponse.json({ error: "A correction request is already pending for this experience", requestId: pending.id }, { status: 409 });

  const row = await prisma.employmentIssueRequest.create({
    data: { employmentRecordId, raisedByUserId: user.id, concern },
  });

  const members = await prisma.organizationMember.findMany({
    where: { organizationId: record.organizationId },
    select: { userId: true },
  });
  const owner = await prisma.organization.findUnique({
    where: { id: record.organizationId },
    select: { createdByUserId: true },
  });
  const recipientIds = [...new Set([
    ...members.map(m => m.userId),
    ...(owner?.createdByUserId ? [owner.createdByUserId] : []),
  ])];
  if (recipientIds.length) {
    await prisma.notification.createMany({
      data: recipientIds.map(userId => ({
        userId: m.userId,
        type: "EMPLOYMENT_CORRECTION_REQUEST",
        title: "Employee requested an experience correction",
        message: "An employee has reported an issue with a verified employment record and requested your review.",
      })),
    });
  }

  await prisma.auditEvent.create({
    data: {
      actorUserId: user.id,
      action: "EMPLOYMENT_CORRECTION_REQUEST_CREATED",
      entityType: "EmploymentIssueRequest",
      entityId: row.id,
      metadata: { employmentRecordId, organizationId: record.organizationId },
    },
  });

  return NextResponse.json({ ok: true, requestId: row.id }, { status: 201 });
}

export async function PATCH(req: Request) {
  const user = await currentUser();
  if (!user || user.role === "EMPLOYEE") return NextResponse.json({ error: "Employer access required" }, { status: 401 });

  const body = await req.json();
  const id = String(body.requestId ?? "").trim();
  const action = body.action === "ACCEPT" ? "ACCEPT" : body.action === "REJECT" ? "REJECT" : "";
  const response = String(body.response ?? "").trim();

  if (!id || !action) return NextResponse.json({ error: "requestId and action are required" }, { status: 400 });

  const row = await prisma.employmentIssueRequest.findUnique({
    where: { id },
    include: { employmentRecord: { select: { id: true, organizationId: true, careerProfileId: true } } },
  });
  if (!row) return NextResponse.json({ error: "Correction request not found" }, { status: 404 });

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: user.id, organizationId: row.employmentRecord.organizationId },
  });
  if (!membership) return NextResponse.json({ error: "You are not authorized for this employer" }, { status: 403 });
  if (row.status !== "PENDING") return NextResponse.json({ error: "This correction request is already closed" }, { status: 409 });

  const now = new Date();
  const updated = await prisma.employmentIssueRequest.update({
    where: { id },
    data: {
      status: action,
      employerResponse: response || null,
      reviewedByUserId: user.id,
      reviewedAt: now,
    },
  });

  if (action === "ACCEPT") {
    await prisma.employmentRecord.update({
      where: { id: row.employmentRecord.id },
      data: { editUnlockedAt: now, editUnlockReason: response || "Employer accepted the employee's correction request." },
    });
  }

  const profile = await prisma.careerProfile.findUnique({ where: { id: row.employmentRecord.careerProfileId }, select: { userId: true } });
  if (profile) {
    await prisma.notification.create({
      data: {
        userId: profile.userId,
        type: "EMPLOYMENT_CORRECTION_RESULT",
        title: action === "ACCEPT" ? "Correction request accepted" : "Correction request rejected",
        message: action === "ACCEPT"
          ? "Your employer accepted the correction request. You can now edit the experience and submit it for re-verification."
          : "Your employer rejected the correction request." + (response ? " Response: " + response : ""),
      },
    });
  }

  await prisma.auditEvent.create({
    data: {
      actorUserId: user.id,
      action: action === "ACCEPT" ? "EMPLOYMENT_CORRECTION_REQUEST_ACCEPTED" : "EMPLOYMENT_CORRECTION_REQUEST_REJECTED",
      entityType: "EmploymentIssueRequest",
      entityId: id,
      metadata: { employmentRecordId: row.employmentRecord.id, response: response || null },
    },
  });

  return NextResponse.json({ ok: true, request: updated, editUnlocked: action === "ACCEPT" });
}
