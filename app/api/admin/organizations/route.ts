import { NextResponse } from "next/server";
import { currentUser } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

export async function GET() {
  const user = await currentUser();
  if (user?.role !== "ADMIN") return NextResponse.json({ error: "Admin authentication required" }, { status: 403 });
  const organizations = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { members: true, employments: true } } },
  });
  return NextResponse.json(organizations.map(o => ({
    id: o.id, name: o.name, cin: o.cin, gstin: o.gstin, verifiedAt: o.verifiedAt,
    createdAt: o.createdAt, members: o._count.members, employments: o._count.employments,
  })));
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (user?.role !== "ADMIN") return NextResponse.json({ error: "Admin authentication required" }, { status: 403 });
  const body = await req.json();
  const organizationId = String(body.organizationId ?? "").trim();
  const verified = body.verified === true;
  if (!organizationId) return NextResponse.json({ error: "organizationId required" }, { status: 400 });
  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  const updated = await prisma.organization.update({
    where: { id: organizationId },
    data: { verifiedAt: verified ? new Date() : null },
  });
  await prisma.auditEvent.create({
    data: { actorUserId: user.id, action: verified ? "ORGANIZATION_VERIFIED" : "ORGANIZATION_VERIFICATION_REVOKED", entityType: "Organization", entityId: organizationId, metadata: { verified } },
  });
  return NextResponse.json({ ok: true, organization: updated });
}