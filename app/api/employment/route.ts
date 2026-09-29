import { NextResponse } from "next/server";
import { currentUser } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user?.careerProfile) {
    return NextResponse.json({ error: "Employee authentication required" }, { status: 401 });
  }

  const body = await req.json();
  const organizationId = String(body.organizationId ?? "").trim();
  const designation = String(body.designation ?? "").trim();
  const joinedAt = new Date(body.joinedAt ?? "");
  const source = String(body.source ?? "SELF").trim().toUpperCase();

  if (!organizationId || !designation || Number.isNaN(joinedAt.getTime())) {
    return NextResponse.json({ error: "organizationId, designation and a valid joinedAt are required" }, { status: 400 });
  }
  if (source !== "SELF") {
    return NextResponse.json({ error: "Employee-created experience records must use the self-added flow" }, { status: 400 });
  }

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, verifiedAt: true },
  });
  if (!organization) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

  const leftAt = body.leftAt ? new Date(body.leftAt) : undefined;
  if (leftAt && Number.isNaN(leftAt.getTime())) {
    return NextResponse.json({ error: "Invalid leftAt" }, { status: 400 });
  }
  if (leftAt && leftAt < joinedAt) {
    return NextResponse.json({ error: "leftAt cannot be earlier than joinedAt" }, { status: 400 });
  }

  const duplicate = await prisma.employmentRecord.findFirst({
    where: {
      careerProfileId: user.careerProfile.id,
      organizationId,
      joinedAt,
      leftAt: leftAt ?? null,
      designation,
    },
    select: { id: true },
  });
  if (duplicate) {
    return NextResponse.json({ error: "This employment record already exists in your Career Profile" }, { status: 409 });
  }

  const row = await prisma.employmentRecord.create({
    data: {
      careerProfileId: user.careerProfile.id,
      organizationId,
      employeeCode: body.employeeCode ? String(body.employeeCode) : undefined,
      designation,
      department: body.department ? String(body.department) : undefined,
      employmentType: body.employmentType ? String(body.employmentType) : undefined,
      joinedAt,
      leftAt,
      status: leftAt ? "LEFT" : "ACTIVE",
      source: "SELF",
      experienceLetterRef: body.experienceLetterRef ? String(body.experienceLetterRef) : undefined,
      remarks: body.remarks ? String(body.remarks) : undefined,
    },
  });

  await prisma.auditEvent.create({
    data: {
      actorUserId: user.id,
      action: "EMPLOYMENT_RECORD_CREATED",
      entityType: "EmploymentRecord",
      entityId: row.id,
      metadata: { organizationId, source: "SELF", organizationVerified: Boolean(organization.verifiedAt) },
    },
  });

  return NextResponse.json(row, { status: 201 });
}

export async function PATCH(req: Request) {
  const user = await currentUser();
  if (!user?.careerProfile) return NextResponse.json({ error: "Employee authentication required" }, { status: 401 });

  const body = await req.json();
  const id = String(body.employmentRecordId ?? "").trim();
  const designation = String(body.designation ?? "").trim();
  const department = String(body.department ?? "").trim();
  const employmentType = String(body.employmentType ?? "").trim();
  const joinedAt = new Date(body.joinedAt ?? "");
  const leftAt = body.leftAt ? new Date(body.leftAt) : null;
  const remarks = String(body.remarks ?? "").trim();

  if (!id || !designation || Number.isNaN(joinedAt.getTime())) {
    return NextResponse.json({ error: "employmentRecordId, designation and valid joinedAt are required" }, { status: 400 });
  }
  if (leftAt && Number.isNaN(leftAt.getTime())) return NextResponse.json({ error: "Invalid leftAt" }, { status: 400 });
  if (leftAt && leftAt < joinedAt) return NextResponse.json({ error: "leftAt cannot be earlier than joinedAt" }, { status: 400 });

  const record = await prisma.employmentRecord.findFirst({
    where: { id, careerProfileId: user.careerProfile.id },
    select: { id: true, organizationId: true, verifiedAt: true, editUnlockedAt: true },
  });
  if (!record) return NextResponse.json({ error: "Employment record not found" }, { status: 404 });

  if (record.verifiedAt && !record.editUnlockedAt) {
    return NextResponse.json({ error: "This verified experience is locked. Raise a correction request with the employer first." }, { status: 409 });
  }

  const updated = await prisma.employmentRecord.update({
    where: { id },
    data: {
      designation,
      department: department || null,
      employmentType: employmentType || null,
      joinedAt,
      leftAt,
      status: leftAt ? "LEFT" : "ACTIVE",
      remarks: remarks || null,
      verifiedAt: null,
      editUnlockedAt: null,
      editUnlockReason: null,
      reverificationPendingAt: new Date(),
    },
  });

  const members = await prisma.organizationMember.findMany({ where: { organizationId: record.organizationId }, select: { userId: true } });
  if (members.length) {
    await prisma.notification.createMany({
      data: members.map(m => ({
        userId: m.userId,
        type: "EMPLOYMENT_REVERIFICATION_REQUIRED",
        title: "Corrected employment record needs re-verification",
        message: "An employee has updated a previously verified experience after an approved correction request. Please review and re-verify it.",
      })),
    });
  }

  await prisma.auditEvent.create({
    data: {
      actorUserId: user.id,
      action: "VERIFIED_EMPLOYMENT_EDITED_AFTER_CORRECTION_APPROVAL",
      entityType: "EmploymentRecord",
      entityId: id,
      metadata: { organizationId: record.organizationId },
    },
  });

  return NextResponse.json({ ok: true, employment: updated, reverificationRequired: true });
}

export async function GET() {
  const user = await currentUser();
  if (!user?.careerProfile) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  return NextResponse.json(
    await prisma.employmentRecord.findMany({
      where: { careerProfileId: user.careerProfile.id },
      include: {
        organization: true,
        documents: { orderBy: { createdAt: "desc" } },
        issueRequests: { orderBy: { createdAt: "desc" }, take: 5 },
      },
      orderBy: { joinedAt: "desc" },
    }),
  );
}
