import { NextResponse } from "next/server";
import { currentUser } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

export async function GET() {
  const user = await currentUser();
  if (!user || user.role === "EMPLOYEE") {
    return NextResponse.json({ error: "Employer access required" }, { status: 401 });
  }

  const memberships = await prisma.organizationMember.findMany({
    where: { userId: user.id },
    select: { organizationId: true, organization: { select: { name: true } } },
  });

  const orgIds = memberships.map((x) => x.organizationId);
  const orgNames = memberships.map((x) => x.organization.name);

  if (!orgIds.length) return NextResponse.json([]);

  // During onboarding, an employee may have added the company before the employer
  // account was registered. Match the pending self-added record to the employer's
  // organization by exact case-insensitive company name as a migration bridge.
  const rows = await prisma.employmentRecord.findMany({
    where: {
      source: "SELF",
      verifiedAt: null,
      OR: [
        { organizationId: { in: orgIds } },
        { organization: { name: { in: orgNames, mode: "insensitive" } } },
      ],
    },
    include: {
      careerProfile: { select: { careerId: true, user: { select: { name: true } } } },
      organization: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    rows.map((x) => ({
      id: x.id,
      careerId: x.careerProfile.careerId,
      employeeName: x.careerProfile.user.name,
      organization: x.organization.name,
      organizationId: x.organization.id,
      designation: x.designation,
      department: x.department,
      employeeCode: x.employeeCode,
      employmentType: x.employmentType,
      joinedAt: x.joinedAt,
      leftAt: x.leftAt,
      remarks: x.remarks,
    })),
  );
}

export async function PATCH(req: Request) {
  const user = await currentUser();
  if (!user || user.role === "EMPLOYEE") {
    return NextResponse.json({ error: "Employer access required" }, { status: 401 });
  }

  const b = await req.json();
  const id = String(b.employmentId ?? "").trim();
  const action = b.action === "VERIFY" ? "VERIFY" : b.action === "REJECT" ? "REJECT" : "";

  if (!id || !action) {
    return NextResponse.json({ error: "employmentId and action are required" }, { status: 400 });
  }

  const memberships = await prisma.organizationMember.findMany({
    where: { userId: user.id },
    select: { organizationId: true, organization: { select: { name: true } } },
  });

  const orgIds = memberships.map((x) => x.organizationId);
  const orgNames = memberships.map((x) => x.organization.name);

  const record = await prisma.employmentRecord.findUnique({
    where: { id },
    include: { organization: { select: { name: true } } },
  });

  if (
    !record ||
    record.source !== "SELF" ||
    !(
      orgIds.includes(record.organizationId) ||
      orgNames.some((name) => name.toLowerCase() === record.organization.name.toLowerCase())
    )
  ) {
    return NextResponse.json({ error: "You are not authorized for this employment record" }, { status: 403 });
  }

  if (action === "VERIFY") {
    const updated = await prisma.employmentRecord.update({
      where: { id },
      data: { verifiedAt: new Date() },
    });

    await prisma.auditEvent.create({
      data: {
        actorUserId: user.id,
        action: "SELF_ADDED_EMPLOYMENT_VERIFIED",
        entityType: "EmploymentRecord",
        entityId: id,
        metadata: { organizationId: record.organizationId },
      },
    });

    return NextResponse.json({ ok: true, employment: updated });
  }

  await prisma.employmentRecord.update({
    where: { id },
    data: {
      status: "DISPUTED",
      remarks: record.remarks
        ? record.remarks + "\nEmployer rejected self-added record."
        : "Employer rejected self-added record.",
    },
  });

  await prisma.auditEvent.create({
    data: {
      actorUserId: user.id,
      action: "SELF_ADDED_EMPLOYMENT_REJECTED",
      entityType: "EmploymentRecord",
      entityId: id,
      metadata: { organizationId: record.organizationId, reason: String(b.reason ?? "") },
    },
  });

  return NextResponse.json({ ok: true });
}
