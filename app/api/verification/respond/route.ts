import { NextResponse } from "next/server";
import crypto from "crypto";
import { currentUser } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user || user.role === "EMPLOYEE") {
    return NextResponse.json({ error: "Authorized prior-employer account required" }, { status: 401 });
  }

  const body = await req.json();
  const token = String(body.token ?? "").trim();
  if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 });

  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const request = await prisma.verificationRequest.findUnique({
    where: { tokenHash: hash },
    include: { response: true },
  });

  if (!request || request.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invalid or expired verification request" }, { status: 404 });
  }
  if (!request.consentedAt) {
    return NextResponse.json({ error: "Employee consent is required before verification" }, { status: 403 });
  }

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: user.id, organizationId: request.priorOrgId },
  });
  if (!membership) {
    return NextResponse.json({ error: "You are not authorized to respond for the prior organization" }, { status: 403 });
  }
  if (request.status !== "PENDING" || request.response) {
    return NextResponse.json({ error: "Verification request is no longer actionable" }, { status: 409 });
  }

  const approved = body.approved === true;
  const response = await prisma.verificationResponse.upsert({
    where: { requestId: request.id },
    create: {
      requestId: request.id,
      verified: approved,
      designation: body.designation ? String(body.designation) : undefined,
      joinedAt: body.joinedAt ? new Date(body.joinedAt) : undefined,
      leftAt: body.leftAt ? new Date(body.leftAt) : undefined,
      notes: body.notes ? String(body.notes) : undefined,
    },
    update: {
      verified: approved,
      designation: body.designation ? String(body.designation) : undefined,
      joinedAt: body.joinedAt ? new Date(body.joinedAt) : undefined,
      leftAt: body.leftAt ? new Date(body.leftAt) : undefined,
      notes: body.notes ? String(body.notes) : undefined,
    },
  });

  const status = approved ? "VERIFIED" : "REJECTED";
  await prisma.verificationRequest.update({
    where: { id: request.id },
    data: { status, respondedAt: new Date() },
  });

  await prisma.auditEvent.create({
    data: {
      actorUserId: user.id,
      action: "VERIFICATION_RESPONSE_SUBMITTED",
      entityType: "VerificationRequest",
      entityId: request.id,
      metadata: { verified: approved },
    },
  });

  return NextResponse.json({ ok: true, responseId: response.id, status });
}
