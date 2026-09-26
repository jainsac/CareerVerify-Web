import { NextResponse } from "next/server";
import { currentUser } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";

async function authorized(userId: string, organizationId: string) {
  return prisma.organizationMember.findFirst({ where: { userId, organizationId } });
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const body = await req.json();
  const employmentId = String(body.employmentId || "");
  const reason = String(body.reason || "").trim();
  const employment = await prisma.employmentRecord.findUnique({ where: { id: employmentId } });
  if (!employment) return NextResponse.json({ error: "Employment record not found." }, { status: 404 });
  if (!(await authorized(user.id, employment.organizationId))) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  if (employment.status !== "ACTIVE") return NextResponse.json({ error: "Only an active employment can be exited." }, { status: 400 });

  const now = new Date();
  const updated = await prisma.$transaction(async tx => {
    const record = await tx.employmentRecord.update({
      where: { id: employmentId },
      data: { status: "LEFT", leftAt: body.exitDate ? new Date(body.exitDate) : now, exitRecordedAt: now, exitReason: reason || null, exitRevokedAt: null, exitRevokedByUserId: null, exitRevokeReason: null },
    });
    await tx.employmentExitEvent.create({ data: { employmentRecordId: employmentId, action: "EXIT_RECORDED", reason: reason || null, performedByUserId: user.id } });
    return record;
  });
  return NextResponse.json(updated);
}

export async function PATCH(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const body = await req.json();
  const employmentId = String(body.employmentId || "");
  const reason = String(body.reason || "").trim();
  const employment = await prisma.employmentRecord.findUnique({ where: { id: employmentId } });
  if (!employment) return NextResponse.json({ error: "Employment record not found." }, { status: 404 });
  if (!(await authorized(user.id, employment.organizationId))) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  if (employment.status !== "LEFT") return NextResponse.json({ error: "Only an exited employment can have its exit revoked." }, { status: 400 });
  if (!reason) return NextResponse.json({ error: "Exit revoke reason is required." }, { status: 400 });

  const now = new Date();
  const updated = await prisma.$transaction(async tx => {
    const record = await tx.employmentRecord.update({
      where: { id: employmentId },
      data: { status: "ACTIVE", leftAt: null, exitRevokedAt: now, exitRevokedByUserId: user.id, exitRevokeReason: reason },
    });
    await tx.employmentExitEvent.create({ data: { employmentRecordId: employmentId, action: "EXIT_REVOKED", reason, performedByUserId: user.id } });
    return record;
  });
  return NextResponse.json(updated);
}
