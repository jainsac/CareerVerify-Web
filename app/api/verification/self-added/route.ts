import { NextResponse } from "next/server";
import { currentUser } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

async function authorizedOrganizationIds(userId: string) {
  const memberships = await prisma.organizationMember.findMany({
    where: { userId },
    select: { organizationId: true, organization: { select: { name: true, cin: true, gstin: true } } },
  });

  const ids = new Set(memberships.map(x => x.organizationId));
  for (const membership of memberships) {
    const org = membership.organization;
    const matches = await prisma.organization.findMany({
      where: {
        OR: [
          org.cin ? { cin: org.cin } : undefined,
          org.gstin ? { gstin: org.gstin } : undefined,
          { name: { equals: org.name, mode: "insensitive" } },
        ].filter(Boolean) as Array<Record<string, string | { equals: string; mode: "insensitive" }>>,
      },
      select: { id: true },
    });
    matches.forEach(x => ids.add(x.id));
  }
  return [...ids];
}

export async function GET() {
  const user = await currentUser();
  if (!user || user.role === "EMPLOYEE") {
    return NextResponse.json({ error: "Employer access required" }, { status: 401 });
  }

  const orgIds = await authorizedOrganizationIds(user.id);
  if (!orgIds.length) return NextResponse.json([]);

  const rows = await prisma.employmentRecord.findMany({
    where: { organizationId: { in: orgIds }, source: "SELF", verifiedAt: null },
    include: {
      careerProfile: { select: { careerId: true, user: { select: { name: true } } } },
      organization: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(rows.map(x => ({
    id: x.id,
    careerId: x.careerProfile.careerId,
    employeeName: x.careerProfile.user.name,
    organization: x.organization.name,
    designation: x.designation,
    department: x.department,
    employeeCode: x.employeeCode,
    employmentType: x.employmentType,
    joinedAt: x.joinedAt,
    leftAt: x.leftAt,
    remarks: x.remarks,
  })));
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

  const orgIds = await authorizedOrganizationIds(user.id);
  const record = await prisma.employmentRecord.findFirst({
    where: { id, organizationId: { in: orgIds }, source: "SELF" },
  });

  if (!record) {
    return NextResponse.json({ error: "Self-added employment record not found or not authorized." }, { status: 404 });
  }

  if (action === "VERIFY") {
    const updated = await prisma.employmentRecord.update({
      where: { id },
      data: { verifiedAt: new Date(), status: record.status === "DISPUTED" ? "DISPUTED" : record.status },
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
