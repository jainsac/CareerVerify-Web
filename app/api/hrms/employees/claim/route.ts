import crypto from "crypto";
import { NextResponse } from "next/server";
import { currentUser } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user?.careerProfile) return NextResponse.json({ error: "Sign in to your CareerVerify account before accepting this invitation." }, { status: 401 });

  const body = await req.json();
  const token = String(body.token || "").trim();
  if (!token) return NextResponse.json({ error: "Invitation token is required." }, { status: 400 });

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const invite = await prisma.employeeInvite.findUnique({ where: { tokenHash } });
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "This invitation is invalid, expired, or already used." }, { status: 400 });
  }
  if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
    return NextResponse.json({ error: "This invitation was issued to a different email address." }, { status: 403 });
  }

  const employment = await prisma.$transaction(async tx => {
    const row = await tx.employmentRecord.create({
      data: {
        careerProfileId: user.careerProfile!.id,
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
        email: user.email,
        phone: user.phone || null,
        status: "ACTIVE",
        activatedAt: new Date(),
      },
    });
    await tx.employeeInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date(), employmentRecordId: row.id },
    });
    return row;
  });

  await prisma.notification.create({
    data: {
      userId: user.id,
      type: "HRMS_INVITE_ACCEPTED",
      title: "Company HRMS account linked",
      message: "Your company HRMS employment relationship has been linked to your permanent CareerVerify identity.",
    },
  });

  return NextResponse.json({ ok: true, employmentId: employment.id, careerId: user.careerProfile.careerId });
}
