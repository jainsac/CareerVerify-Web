import { NextResponse } from "next/server";
import { currentUser } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";

export async function PATCH(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();
  const name = String(body.name ?? "").trim();
  const phone = String(body.phone ?? "").replace(/\D/g, "");

  if (name.length < 2) return NextResponse.json({ error: "Please enter your full name." }, { status: 400 });
  if (phone && !/^\d{10}$/.test(phone)) return NextResponse.json({ error: "Phone number must contain 10 digits." }, { status: 400 });

  try {
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { name, phone: phone || null },
      select: { id: true, name: true, email: true, phone: true },
    });
    return NextResponse.json(updated);
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? String((error as {code?: unknown}).code) : "";
    if (code === "P2002") return NextResponse.json({ error: "This phone number is already registered." }, { status: 409 });
    return NextResponse.json({ error: "Profile could not be updated." }, { status: 500 });
  }
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const memberships = await prisma.organizationMember.findMany({
    where: { userId: user.id },
    include: { organization: true },
  });

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    careerId: user.careerProfile?.careerId ?? null,
    careerProfile: user.careerProfile ? { id: user.careerProfile.id, careerId: user.careerProfile.careerId } : null,
    organizations: memberships.map(m => ({ ...m.organization, membershipRole: m.role })),
  });
}
