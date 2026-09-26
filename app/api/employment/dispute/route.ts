import { NextResponse } from "next/server";
import { currentUser } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user?.careerProfile) {
    return NextResponse.json({ error: "Employee authentication required" }, { status: 401 });
  }

  const body = await req.json();
  const id = String(body.employmentId ?? "").trim();
  const reason = String(body.reason ?? "").trim();
  if (!id || reason.length < 3) {
    return NextResponse.json({ error: "employmentId and a dispute reason are required" }, { status: 400 });
  }

  const row = await prisma.employmentRecord.findFirst({
    where: { id, careerProfileId: user.careerProfile.id },
  });
  if (!row) return NextResponse.json({ error: "Employment record not found" }, { status: 404 });

  const dispute = await prisma.employmentDispute.create({ data: { employmentRecordId: id, raisedByUserId: user.id, reason } });

  const updated = await prisma.employmentRecord.update({
    where: { id },
    data: { status: "DISPUTED", remarks: reason },
  });

  await prisma.notification.create({ data: { userId: user.id, type: "DISPUTE_CREATED", title: "Dispute submitted", message: "Your employment record dispute has been submitted for admin review." } });

  await prisma.auditEvent.create({
    data: {
      actorUserId: user.id,
      action: "EMPLOYMENT_RECORD_DISPUTED",
      entityType: "EmploymentRecord",
      entityId: id,
      metadata: { reason },
    },
  });

  return NextResponse.json({ ok: true, employment: updated, disputeId: dispute.id });
}
