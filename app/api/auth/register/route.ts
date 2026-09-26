import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { hashPassword, signSession, sessionCookie } from "../../../../lib/auth";
import { generateUniqueCareerId } from "../../../../lib/career-id";

export async function POST(req: Request) {
  try {
    const b = await req.json();
    const name = String(b.name ?? "").trim();
    const email = String(b.email ?? "").trim().toLowerCase();
    const password = String(b.password ?? "");
    const role = b.role === "EMPLOYER" ? "EMPLOYER" : "EMPLOYEE";

    if (name.length < 2) {
      return NextResponse.json({ error: "Please enter your full name." }, { status: 400 });
    }
    if (!email.includes("@")) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters. Uppercase letters and special characters are not required." },
        { status: 400 },
      );
    }

    if (await prisma.user.findUnique({ where: { email } })) {
      return NextResponse.json({ error: "This email is already registered. Please sign in instead." }, { status: 409 });
    }

    const careerId = role === "EMPLOYEE" ? await generateUniqueCareerId() : undefined;
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: await hashPassword(password),
        role,
        careerProfile: careerId ? { create: { careerId } } : undefined,
      },
    });

    const res = NextResponse.json({ ok: true, userId: user.id, careerId });
    res.cookies.set(sessionCookie, signSession(user.id), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 604800,
    });
    return res;
  } catch (error) {
    console.error("Registration error:", error);

    const prismaCode =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";

    if (prismaCode === "P2002") {
      return NextResponse.json(
        { error: "This email is already registered. Please use another email or sign in." },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: "Registration could not be completed because the database/service is unavailable. Please try again." },
      { status: 503 },
    );
  }
}
