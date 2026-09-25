import { NextResponse } from "next/server";
import { currentUser } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";

export async function POST(req: Request) {
  const u = await currentUser();
  if (!u || u.role === "EMPLOYEE") return NextResponse.json({ error: "Employer authentication required" }, { status: 401 });
  const b = await req.json();
  const name = String(b.name ?? "").trim();
  const cin = String(b.cin ?? "").trim().toUpperCase();
  const gstin = String(b.gstin ?? "").trim().toUpperCase();
  if (name.length < 2) return NextResponse.json({ error: "Company name is required" }, { status: 400 });
  if (!cin && !gstin) return NextResponse.json({ error: "CIN or GSTIN is required" }, { status: 400 });
  const duplicate = await prisma.organization.findFirst({ where: { OR: [{ cin: cin || undefined }, { gstin: gstin || undefined }] } });
  if (duplicate) return NextResponse.json({ error: "An organization with this CIN/GSTIN already exists" }, { status: 409 });
  const org = await prisma.organization.create({ data: { name, cin: cin || undefined, gstin: gstin || undefined, members: { create: { userId: u.id, role: "OWNER" } } } });
  await prisma.auditEvent.create({ data: { actorUserId: u.id, action: "ORGANIZATION_CREATED", entityType: "Organization", entityId: org.id, metadata: { cin: cin || null, gstin: gstin || null } } });
  return NextResponse.json({ ok: true, organization: org }, { status: 201 });
}
export async function GET() {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const memberships = await prisma.organizationMember.findMany({ where: { userId: u.id }, include: { organization: true } });
  return NextResponse.json(memberships.map(x => x.organization));
}