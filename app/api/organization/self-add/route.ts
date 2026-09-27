import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user?.careerProfile) {
    return NextResponse.json({ error: "Employee authentication required" }, { status: 401 });
  }

  const body = await req.json();
  const name = String(body.name ?? "").trim();
  const cin = String(body.cin ?? "").trim().toUpperCase();
  const gstin = String(body.gstin ?? "").trim().toUpperCase();

  if (name.length < 2) {
    return NextResponse.json({ error: "Company name is required" }, { status: 400 });
  }

  const existing = await prisma.organization.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      ...(cin || gstin ? { OR: [{ cin: cin || undefined }, { gstin: gstin || undefined }] } : {}),
    },
    select: { id: true, name: true, cin: true, gstin: true, verifiedAt: true },
  });

  if (existing) return NextResponse.json({ organization: existing });

  const organization = await prisma.organization.create({
    data: {
      name,
      cin: cin || undefined,
      gstin: gstin || undefined,
    },
    select: { id: true, name: true, cin: true, gstin: true, verifiedAt: true },
  });

  await prisma.auditEvent.create({
    data: {
      actorUserId: user.id,
      action: "EMPLOYEE_COMPANY_ADDED",
      entityType: "Organization",
      entityId: organization.id,
      metadata: { source: "EMPLOYEE_EXPERIENCE", cin: cin || null, gstin: gstin || null },
    },
  });

  return NextResponse.json({ organization }, { status: 201 });
}
