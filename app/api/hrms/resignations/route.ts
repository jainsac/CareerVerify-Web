import { NextResponse } from "next/server";
import { currentUser } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

async function getOrganization(userId: string, organizationId: string) {
  return prisma.organizationMember.findFirst({
    where: { userId, organizationId },
    select: { organizationId: true },
  });
}

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const organizationId = new URL(req.url).searchParams.get("organizationId") || "";
  if (!organizationId) return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
  if (!(await getOrganization(user.id, organizationId))) {
    return NextResponse.json({ error: "Organization access denied" }, { status: 403 });
  }

  const rows = await prisma.employmentRecord.findMany({
    where: { organizationId, resignationStatus: { in: ["SUBMITTED", "ACCEPTED", "REJECTED"] } },
    include: {
      careerProfile: { include: { user: { select: { id: true, name: true, email: true, phone: true } } } },
      companyEmployeeAccount: { select: { email: true, status: true } },
      resignationHistory: { orderBy: { createdAt: "desc" }, take: 10 },
    },
    orderBy: { resignationSubmittedAt: "desc" },
  });

  return NextResponse.json(rows);
}

export async function PATCH(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = await req.json();
  const organizationId = String(body.organizationId || "");
  const employmentId = String(body.employmentId || "");
  const action = String(body.action || "").toUpperCase();
  const reason = String(body.reason || "").trim();

  if (!organizationId || !employmentId || !["ACCEPT", "REJECT"].includes(action)) {
    return NextResponse.json({ error: "organizationId, employmentId and action (ACCEPT/REJECT) are required" }, { status: 400 });
  }
  if (!(await getOrganization(user.id, organizationId))) {
    return NextResponse.json({ error: "Organization access denied" }, { status: 403 });
  }

  const record = await prisma.employmentRecord.findFirst({
    where: { id: employmentId, organizationId },
    include: { careerProfile: { include: { user: { select: { id: true, name: true } } } } },
  });
  if (!record) return NextResponse.json({ error: "Employment record not found" }, { status: 404 });
  if (record.resignationStatus !== "SUBMITTED") {
    return NextResponse.json({ error: "Only submitted resignations can be processed." }, { status: 409 });
  }

  const nextStatus = action === "ACCEPT" ? "ACCEPTED" : "REJECTED";
  const eventAction = action === "ACCEPT" ? "RESIGNATION_ACCEPTED_BY_EMPLOYER" : "RESIGNATION_REJECTED_BY_EMPLOYER";

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.employmentRecord.update({
      where: { id: employmentId },
      data: { resignationStatus: nextStatus },
    });
    await tx.employmentResignationEvent.create({
      data: { employmentRecordId: employmentId, action: eventAction, reason: reason || null, performedByUserId: user.id },
    });
    await tx.notification.create({
      data: {
        userId: record.careerProfile.user.id,
        type: action === "ACCEPT" ? "RESIGNATION_ACCEPTED" : "RESIGNATION_REJECTED",
        title: action === "ACCEPT" ? "Resignation accepted" : "Resignation rejected",
        message: action === "ACCEPT"
          ? "Your employer has accepted your resignation."
          : "Your employer has rejected your resignation." + (reason ? " Reason: " + reason : ""),
      },
    });
    return row;
  });

  await prisma.auditEvent.create({
    data: {
      actorUserId: user.id,
      action: eventAction,
      entityType: "EmploymentRecord",
      entityId: employmentId,
      metadata: { organizationId, reason: reason || null },
    },
  });

  return NextResponse.json(updated);
}
