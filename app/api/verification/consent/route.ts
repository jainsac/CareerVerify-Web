import { NextResponse } from "next/server";
import { currentUser } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user?.careerProfile) return NextResponse.json({ error: "Employee authentication required" }, { status: 401 });

  const body = await req.json();
  const requestId = String(body.requestId ?? "").trim();
  if (!requestId || body.consent !== true) return NextResponse.json({ error: "requestId and explicit consent are required" }, { status: 400 });

  const request = await prisma.verificationRequest.findFirst({
    where: { id: requestId, careerProfileId: user.careerProfile.id },
  });
  if (!request || request.expiresAt < new Date()) return NextResponse.json({ error: "Verification request not found or expired" }, { status: 404 });
  if (request.status !== "PENDING") return NextResponse.json({ error: "Verification request is no longer pending" }, { status: 409 });

  const updated = await prisma.verificationRequest.update({
    where: { id: request.id },
    data: { consentedAt: new Date() },
  });

  await prisma.auditEvent.create({
    data: {
      actorUserId: user.id,
      action: "VERIFICATION_CONSENT_GRANTED",
      entityType: "VerificationRequest",
      entityId: request.id,
      metadata: { consent: true },
    },
  });

  return NextResponse.json({ ok: true, consentedAt: updated.consentedAt });
}
