import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { verifyPassword, signSession, sessionCookie } from "../../../../lib/auth";

export async function POST(req: Request) {
  try {
    const b = await req.json();
    const identifier = String(b.identifier ?? b.email ?? "").trim();
    const password = String(b.password ?? "");
    const normalizedEmail = identifier.toLowerCase();
    const phone = identifier.replace(/\D/g, "");
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: normalizedEmail },
          { phone: phone },
          { careerProfile: { careerId: identifier.toUpperCase() } },
        ],
      },
    });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json({ error: "Invalid email, phone number, Career ID, or password." }, { status: 401 });
    }
    const res = NextResponse.json({ ok: true, role: user.role });
    res.cookies.set(sessionCookie, signSession(user.id), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 604800 });
    return res;
  } catch {
    return NextResponse.json({ error: "Sign in could not be completed. Please try again." }, { status: 503 });
  }
}
