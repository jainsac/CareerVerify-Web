import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "../../../../lib/prisma";
import { hashPassword, signSession, sessionCookie } from "../../../../lib/auth";
import { generateUniqueCareerId } from "../../../../lib/career-id";

const phonePattern = /^\d{10}$/;
const allowedCertificateTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
const maxCertificateSize = 10 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const phone = String(form.get("phone") ?? "").replace(/\D/g, "");
    const password = String(form.get("password") ?? "");
    const role = form.get("role") === "EMPLOYER" ? "EMPLOYER" : "EMPLOYEE";

    if (name.length < 2) return NextResponse.json({ error: "Please enter your full name." }, { status: 400 });
    if (!email.includes("@")) return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    if (!phonePattern.test(phone)) return NextResponse.json({ error: "Please enter a valid 10-digit phone number." }, { status: 400 });
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password)) return NextResponse.json({ error: "Password must be at least 8 characters and include upper, lower, number and special character." }, { status: 400 });

    const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { phone }] }, select: { email: true, phone: true } });
    if (existing?.email === email) return NextResponse.json({ error: "This email is already registered. Please sign in instead." }, { status: 409 });
    if (existing?.phone === phone) return NextResponse.json({ error: "This phone number is already registered. Please sign in instead." }, { status: 409 });

    let certificatePath: string | undefined;
    let companyName = "";
    let cin = "";
    let gstin = "";

    if (role === "EMPLOYER") {
      companyName = String(form.get("companyName") ?? "").trim();
      cin = String(form.get("cin") ?? "").trim().toUpperCase();
      gstin = String(form.get("gstin") ?? "").trim().toUpperCase();
      const certificate = form.get("certificate");

      if (companyName.length < 2) return NextResponse.json({ error: "Company name is required for employer registration." }, { status: 400 });
      if (!cin && !gstin) return NextResponse.json({ error: "CIN or GSTIN is required for employer registration." }, { status: 400 });
      if (!(certificate instanceof File) || certificate.size === 0) return NextResponse.json({ error: "Company registration certificate is mandatory." }, { status: 400 });
      if (certificate.size > maxCertificateSize) return NextResponse.json({ error: "Certificate must be 10 MB or smaller." }, { status: 400 });
      if (!allowedCertificateTypes.has(certificate.type)) return NextResponse.json({ error: "Certificate must be a PDF, JPG or PNG file." }, { status: 400 });

      const duplicate = await prisma.organization.findFirst({ where: { OR: [{ cin: cin || undefined }, { gstin: gstin || undefined }] }, select: { id: true } });
      if (duplicate) return NextResponse.json({ error: "An organization with this CIN/GSTIN already exists." }, { status: 409 });

      const blob = await put(`employer-certificates/${Date.now()}-${certificate.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`, certificate, { access: "private", addRandomSuffix: true });
      certificatePath = blob.pathname;
    }

    const careerId = role === "EMPLOYEE" ? await generateUniqueCareerId() : undefined;
    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone,
        passwordHash: await hashPassword(password),
        role,
        careerProfile: careerId ? { create: { careerId } } : undefined,
        ...(role === "EMPLOYER"
          ? {
              employerOrganizationRequests: {
                create: {
                  name: companyName,
                  cin: cin || undefined,
                  gstin: gstin || undefined,
                  certificatePath,
                  verificationStatus: "PENDING",
                },
              },
            }
          : {}),
      },
    });

    const res = NextResponse.json({ ok: true, userId: user.id, careerId, employerVerification: role === "EMPLOYER" ? "PENDING" : undefined });
    res.cookies.set(sessionCookie, signSession(user.id), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 604800 });
    return res;
  } catch (error) {
    console.error("Registration error:", error);
    const prismaCode = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code) : "";
    if (prismaCode === "P2002") return NextResponse.json({ error: "This email, phone, or company identifier is already registered." }, { status: 409 });
    return NextResponse.json({ error: "Registration could not be completed because the database/service is unavailable. Please try again." }, { status: 503 });
  }
}
