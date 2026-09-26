import { NextResponse } from "next/server";
import { currentUser } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";

async function notifyEmployer(orgId: string, type: string, title: string, message: string) {
  const members = await prisma.organizationMember.findMany({ where: { organizationId: orgId }, select: { userId: true } });
  if (members.length) {
    await prisma.notification.createMany({
      data: members.map(m => ({ userId: m.userId, type, title, message })),
    });
  }
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user?.careerProfile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const body = await req.json();
  const employmentId = String(body.employmentId || "");
  const reason = String(body.reason || "").trim();
  const record = await prisma.employmentRecord.findFirst({ where: { id: employmentId, careerProfileId: user.careerProfile.id } });
  if (!record) return NextResponse.json({ error: "Employment record not found." }, { status: 404 });
  if (record.status !== "ACTIVE") return NextResponse.json({ error: "Resignation can only be submitted for active employment." }, { status: 400 });
  if (record.resignationStatus === "SUBMITTED") return NextResponse.json({ error: "A resignation is already submitted." }, { status: 409 });

  const updated = await prisma.$transaction(async tx => {
    const x = await tx.employmentRecord.update({
      where: { id: employmentId },
      data: { resignationStatus: "SUBMITTED", resignationSubmittedAt: new Date(), resignationReason: reason || null, resignationNoticeDate: body.noticeDate ? new Date(body.noticeDate) : null },
    });
    await tx.employmentResignationEvent.create({ data: { employmentRecordId: employmentId, action: "RESIGNATION_SUBMITTED", reason: reason || null, performedByUserId: user.id } });
    return x;
  });
  await notifyEmployer(record.organizationId, "RESIGNATION_SUBMITTED", "Employee resignation submitted", "An employee has submitted a resignation request.");
  return NextResponse.json(updated);
}

export async function PATCH(req: Request) {
  const user = await currentUser();
  if (!user?.careerProfile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const body = await req.json();
  const employmentId = String(body.employmentId || "");
  const reason = String(body.reason || "").trim();
  const record = await prisma.employmentRecord.findFirst({ where: { id: employmentId, careerProfileId: user.careerProfile.id } });
  if (!record) return NextResponse.json({ error: "Employment record not found." }, { status: 404 });
  if (record.status !== "ACTIVE") return NextResponse.json({ error: "A resignation can only be withdrawn while employment is active." }, { status: 400 });
  if (record.resignationStatus !== "SUBMITTED") return NextResponse.json({ error: "There is no active resignation to revoke." }, { status: 400 });
  if (!reason) return NextResponse.json({ error: "Please provide a reason for withdrawing the resignation." }, { status: 400 });

  const updated = await prisma.$transaction(async tx => {
    const x = await tx.employmentRecord.update({
      where: { id: employmentId },
      data: { resignationStatus: "WITHDRAWN", resignationWithdrawnAt: new Date() },
    });
    await tx.employmentResignationEvent.create({ data: { employmentRecordId: employmentId, action: "RESIGNATION_WITHDRAWN_BY_EMPLOYEE", reason, performedByUserId: user.id } });
    return x;
  });
  await notifyEmployer(record.organizationId, "RESIGNATION_WITHDRAWN", "Resignation withdrawn", "An employee has withdrawn a previously submitted resignation.");
  return NextResponse.json(updated);
}
