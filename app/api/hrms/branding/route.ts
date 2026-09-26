import { NextResponse } from "next/server";
import { currentUser } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const organizationId = new URL(req.url).searchParams.get("organizationId") || "";
  const member = await prisma.organizationMember.findFirst({ where: { userId: user.id, organizationId } });
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  const branding = await prisma.organizationBranding.findUnique({ where: { organizationId } });
  return NextResponse.json(branding || { organizationId });
}

export async function PUT(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const body = await req.json();
  const organizationId = String(body.organizationId || "");
  const member = await prisma.organizationMember.findFirst({ where: { userId: user.id, organizationId } });
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const primaryColor = String(body.primaryColor || "").trim();
  const secondaryColor = String(body.secondaryColor || "").trim();
  const logoUrl = String(body.logoUrl || "").trim();
  const tagline = String(body.tagline || "").trim();

  if (primaryColor && !/^#[0-9a-fA-F]{6}$/.test(primaryColor)) return NextResponse.json({ error: "Primary color must be a hex color." }, { status: 400 });
  if (secondaryColor && !/^#[0-9a-fA-F]{6}$/.test(secondaryColor)) return NextResponse.json({ error: "Secondary color must be a hex color." }, { status: 400 });

  const branding = await prisma.organizationBranding.upsert({
    where: { organizationId },
    create: { organizationId, logoUrl: logoUrl || null, primaryColor: primaryColor || null, secondaryColor: secondaryColor || null, tagline: tagline || null },
    update: { logoUrl: logoUrl || null, primaryColor: primaryColor || null, secondaryColor: secondaryColor || null, tagline: tagline || null },
  });
  return NextResponse.json(branding);
}
