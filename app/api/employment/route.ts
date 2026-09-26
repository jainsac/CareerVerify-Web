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

  if (!organizationId || !designation || Number.isNaN(joinedAt.getTime())) {
    return NextResponse.json({ error: "organizationId, designation and a valid joinedAt are required" }, { status: 400 });
  }

  const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true, verifiedAt: true } });
  if (!organization) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  if (!organization.verifiedAt) return NextResponse.json({ error: "Employment can only be associated with a platform-verified organization" }, { status: 403 });

  const leftAt = body.leftAt ? new Date(body.leftAt) : undefined;
  if (leftAt && Number.isNaN(leftAt.getTime())) {
    return NextResponse.json({ error: "Invalid leftAt" }, { status: 400 });
  }
  if (leftAt && leftAt < joinedAt) {
    return NextResponse.json({ error: "leftAt cannot be earlier than joinedAt" }, { status: 400 });
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
      metadata: { organizationId },
    },
  });

  return NextResponse.json(row, { status: 201 });
}

export async function GET() {
  const user = await currentUser();
  if (!user?.careerProfile) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  return NextResponse.json(
    await prisma.employmentRecord.findMany({
      where: { careerProfileId: user.careerProfile.id },
      include: { organization: true },
      orderBy: { joinedAt: "desc" },
    }),
  );
}
