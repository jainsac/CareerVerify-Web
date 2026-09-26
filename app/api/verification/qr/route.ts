import { NextResponse } from "next/server";
import crypto from "crypto";
import { currentUser } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
export async function POST() {
  const user = await currentUser();
  if (!user?.careerProfile) return NextResponse.json({ error: "Employee authentication required" }, { status: 401 });
  const raw = crypto.randomBytes(32).toString("hex");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  const token = await prisma.publicVerificationToken.create({ data: { careerProfileId: user.careerProfile.id, tokenHash: hash } });
  await prisma.auditEvent.create({ data: { actorUserId: user.id, action: "PUBLIC_VERIFICATION_TOKEN_CREATED", entityType: "PublicVerificationToken", entityId: token.id } });
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return NextResponse.json({ reference: raw, url: base + "/verify/profile/" + raw });
}
