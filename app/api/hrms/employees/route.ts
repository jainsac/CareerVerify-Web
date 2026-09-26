import crypto from "crypto";
import { NextResponse } from "next/server";
import { currentUser } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { generateCareerId } from "../../../../lib/career-id";

async function orgForUser(userId: string, organizationId: string) {
  return prisma.organizationMember.findFirst({ where: { userId, organizationId } });
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();
  const organizationId = String(body.organizationId || "");
  const name = String(body.name || "").trim();
  const companyEmail = String(body.companyEmail || "").trim().toLowerCase();
  const phone = String(body.phone || "").replace(/\D/g, "");
  const designation = String(body.designation || "").trim();
  const department = String(body.department || "").trim();
  const employeeCode = String(body.employeeCode || "").trim();
  const joiningDate = new Date(body.joiningDate);

  const membership = await orgForUser(user.id, organizationId);
  if (!membership) return NextResponse.json({ error: "You are not authorized for this organization." }, { status: 403 });
  if (!name || !companyEmail || !designation || Number.isNaN(joiningDate.getTime())) {
    return NextResponse.json({ error: "Name, company email, designation and joining date are required." }, { status: 400 });
  }

  const existing = await prisma.companyEmployeeAccount.findUnique({ where: { organizationId_email: { organizationId, email: companyEmail } } });
  if (existing) return NextResponse.json({ error: "An HRMS employee account already exists for this email." }, { status: 409 });

  const careerId = await generateCareerId();
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const result = await prisma.$transaction(async tx => {
    const profile = await tx.careerProfile.create({
      data: {
        careerId,
        user: {
          create: {
            email: companyEmail,
            name,
            passwordHash: crypto.randomBytes(32).toString("hex"),
            accountStatus: "INVITED",
            invitedAt: new Date(),
          },
        },
      },
      include: { user: true },
    });

    const employment = await tx.employmentRecord.create({
      data: {
        careerProfileId: profile.id,
        organizationId,
        employeeCode: employeeCode || null,
        designation,
        department: department || null,
        joinedAt: joiningDate,
        source: "HRMS",
      },
    });

    await tx.companyEmployeeAccount.create({
      data: {
        organizationId,
        employmentRecordId: employment.id,
        email: companyEmail,
        phone: phone || null,
      },
    });

    await tx.employeeInvite.create({
      data: {
        organizationId,
        employmentRecordId: employment.id,
        email: companyEmail,
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return { careerId, employmentId: employment.id, inviteToken: token };
  });

  return NextResponse.json({
    status: "INVITED",
    careerId: result.careerId,
    employmentId: result.employmentId,
    inviteToken: result.inviteToken,
    message: "Employee provisioned. Send the invitation through your configured email/SMS provider; never send a password."
  }, { status: 201 });
}
