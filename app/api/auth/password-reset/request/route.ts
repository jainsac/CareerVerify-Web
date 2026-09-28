import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "../../../../../lib/prisma";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const identifier = String(body.identifier ?? "").trim();
    if (!identifier) return NextResponse.json({ error: "Email, phone number or Career ID is required." }, { status: 400 });

    const normalizedEmail = identifier.toLowerCase();
    const phone = identifier.replace(/\D/g, "");
    const user = await prisma.user.findFirst({
      where: { OR: [{ email: normalizedEmail }, { phone }, { careerProfile: { careerId: identifier.toUpperCase() } }] },
      select: { id: true, email: true, name: true },
    });

    // Always return a generic response to avoid account enumeration.
    if (!user) return NextResponse.json({ ok: true });

    const rawToken = crypto.randomBytes(32).toString("hex");
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashToken(rawToken), expiresAt: new Date(Date.now() + 30 * 60 * 1000) },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
    const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;

    if (!apiKey || !from) {
      console.error("Password reset email is not configured.");
      return NextResponse.json({ error: "Password reset service is not configured yet. Please contact the administrator." }, { status: 503 });
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [user.email],
        subject: "Reset your CareerVerify password",
        html: `<p>Hello ${user.name},</p><p>We received a request to reset your CareerVerify password.</p><p><a href="${resetUrl}">Reset your password</a></p><p>This link expires in 30 minutes and can be used once.</p><p>If you did not request this, you can ignore this email.</p>`,
      }),
    });

    if (!emailResponse.ok) {
      console.error("Password reset email failed:", await emailResponse.text());
      return NextResponse.json({ error: "We could not send the reset email. Please try again later." }, { status: 503 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Password reset request could not be completed." }, { status: 503 });
  }
}
