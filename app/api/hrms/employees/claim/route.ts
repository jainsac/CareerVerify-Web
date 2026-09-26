import crypto from "crypto";
import { NextResponse } from "next/server";
import { currentUser, hashPassword } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";

const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export async function POST(req: Request) {
  const body = await req.json();
  const token = String(body.token || "").trim();
  const password = String(body.password || "");
  if (!token) return NextResponse.json({ error: "Invitation token is required." }, { status: 400 });

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const invite = await prisma.employeeInvite.findUnique({ where: { tokenHash } });
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "This invitation is invalid, expired, or already used." }, { status: 400 });
  }

  const signedIn = await currentUser();

  if (signedIn?.careerProfile) {
    if (invite.email.toLowerCase() !== signedIn.email.toLowerCase()) {
      return NextResponse.json({ error: "This invitation was issued to a different email address." }, { status: 403 });
    }
    if (invite.employmentRecordId) return NextResponse.json({ error: "This invitation has already been provisioned." }, { status: 409 });

    const employment = await prisma.$transaction(async tx => {
      const row = await tx.employmentRecord.create({
        data: {
          careerProfileId: signedIn.careerProfile!.id,
          organizationId: invite.organizationId,
          employeeCode: invite.employeeCode || null,
          designation: invite.designation || "Employee",
          department: invite.department || null,
          joinedAt: invite.joiningDate || new Date(),
          source: "HRMS",
        },
      });
      await tx.companyEmployeeAccount.create({
        data: {
          organizationId: invite.organizationId,
          employmentRecordId: row.id,
          email: signedIn.email,
          phone: signedIn.phone || null,
          status: "ACTIVE",
          activatedAt: new Date(),
        },
      });
      await tx.employeeInvite.update({ where: { id: invite.id }, data: { acceptedAt: new Date(), employmentRecordId: row.id } });
      return row;
    });

    return NextResponse.json({ ok: true, employmentId: employment.id, careerId: signedIn.careerProfile.careerId });
  }

  if (!passwordPattern.test(password)) {
    return NextResponse.json({ error: "Password must be at least 8 characters and contain uppercase, lowercase, number and special character." }, { status: 400 });
  }
  if (!invite.employmentRecordId) {
    return NextResponse.json({ error: "This invitation requires the employee to sign in to an existing CareerVerify account before claiming it." }, { status: 400 });
  }

  const employment = await prisma.employmentRecord.findUnique({
    where: { id: invite.employmentRecordId },
    include: { careerProfile: { include: { user: true } } },
  });
  if (!employment) return NextResponse.json({ error: "Employment invitation is no longer available." }, { status: 404 });
  if (employment.careerProfile.user.email.toLowerCase() !== invite.email.toLowerCase()) {
    return NextResponse.json({ error: "Invitation identity mismatch." }, { status: 409 });
  }

  const updatedUser = await prisma.user.update({
    where: { id: employment.careerProfile.user.id },
    data: { passwordHash: await hashPassword(password), accountStatus: "ACTIVE", activatedAt: new Date() },
  });
  await prisma.employeeInvite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });

  return NextResponse.json({ ok: true, userId: updatedUser.id, careerId: employment.careerProfile.careerId });
}
