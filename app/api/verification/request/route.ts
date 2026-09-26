import { NextResponse } from "next/server";
import { currentUser } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { createOpaqueToken } from "../../../../lib/tokens";

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user || user.role === "EMPLOYEE") {
    return NextResponse.json({ error: "Authorized employer account required" }, { status: 401 });
  }

  const body = await req.json();
  const careerId = String(body.careerId ?? "").trim();
  const priorOrgId = String(body.priorOrgId ?? "").trim();
  const requestingOrgId = String(body.requestingOrgId ?? "").trim();

  if (!careerId || !priorOrgId || !requestingOrgId) {
    return NextResponse.json({ error: "careerId, priorOrgId and requestingOrgId are required" }, { status: 400 });
  }

  const requestingOrganization = await prisma.organization.findUnique({ where: { id: requestingOrgId } });
  if (!requestingOrganization?.verifiedAt) return NextResponse.json({ error: "Requesting organization must be platform-verified" }, { status: 403 });

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: user.id, organizationId: requestingOrgId },
  });
  if (!membership) {
    return NextResponse.json({ error: "You are not authorized for the requesting organization" }, { status: 403 });
  }

  const [profile, priorOrg] = await Promise.all([
    prisma.careerProfile.findUnique({ where: { careerId } }),
    prisma.organization.findUnique({ where: { id: priorOrgId } }),
  ]);
  if (!profile) return NextResponse.json({ error: "Career ID not found" }, { status: 404 });
  if (!priorOrg) return NextResponse.json({ error: "Prior organization not found" }, { status: 404 });
  if (priorOrgId === requestingOrgId) {
    return NextResponse.json({ error: "Requesting and prior organization must be different" }, { status: 400 });
  }

  const existing = await prisma.verificationRequest.findFirst({ where: { careerProfileId: profile.id, requestingOrgId, priorOrgId, status: "PENDING", expiresAt: { gt: new Date() } }, select: { id: true, expiresAt: true } });
  if (existing) return NextResponse.json({ error: "An active verification request already exists", requestId: existing.id, expiresAt: existing.expiresAt }, { status: 409 });

  const employment = await prisma.employmentRecord.findFirst({
    where: { careerProfileId: profile.id, organizationId: priorOrgId },
    select: { id: true },
  });
  if (!employment) {
    return NextResponse.json({ error: "No employment record found for the selected prior organization" }, { status: 404 });
  }

  const { token, tokenHash } = createOpaqueToken();
  const expiresAt = new Date(Date.now() + 7 * 86400000);
  const row = await prisma.verificationRequest.create({
    data: {
      careerProfileId: profile.id,
      requestingOrgId,
      priorOrgId,
      tokenHash,
      expiresAt,
    },
  });

  await prisma.notification.create({ data: { userId: profile.userId, type: "VERIFICATION_REQUEST", title: "New verification request", message: "A new employer has requested employment verification for your Career ID." } });

  await prisma.auditEvent.create({
    data: {
      actorUserId: user.id,
      action: "VERIFICATION_REQUEST_CREATED",
      entityType: "VerificationRequest",
      entityId: row.id,
      metadata: { requestingOrgId, priorOrgId },
    },
  });

  return NextResponse.json({ requestId: row.id, verificationToken: token, expiresAt }, { status: 201 });
}
