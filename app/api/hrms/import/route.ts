import { NextResponse } from "next/server";
import { currentUser } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { generateUniqueCareerId } from "../../../../lib/career-id";

type ImportRow = Record<string, unknown>;

async function access(userId: string, organizationId: string) {
  return prisma.organizationMember.findFirst({ where: { userId, organizationId } });
}

function normalize(row: ImportRow) {
  const get = (...names: string[]) => {
    const key = Object.keys(row).find(k => names.includes(k.trim().toLowerCase()));
    return key ? String(row[key] ?? "").trim() : "";
  };

  return {
    name: get("name", "full name", "employee name"),
    companyEmail: get("companyemail", "company email", "email").toLowerCase(),
    phone: get("phone", "mobile", "mobile number").replace(/\D/g, ""),
    employeeCode: get("employeecode", "employee code", "employee id"),
    designation: get("designation", "job title"),
    department: get("department", "dept"),
    joiningDate: get("joiningdate", "joining date", "date of joining", "doj"),
    employmentType: get("employmenttype", "employment type", "type"),
    externalEmployeeId: get("externalemployeeid", "external employee id", "external id")
  };
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const b = await req.json();
  const organizationId = String(b.organizationId || "");
  const rows: ImportRow[] = Array.isArray(b.rows) ? b.rows : [];

  if (!(await access(user.id, organizationId))) {
    return NextResponse.json({ error: "Organization access denied" }, { status: 403 });
  }
  if (!rows.length || rows.length > 2000) {
    return NextResponse.json({ error: "Import must contain 1-2,000 rows." }, { status: 400 });
  }

  const seenEmails = new Set<string>();
  const seenCodes = new Set<string>();
  const errors: { row: number; errors: string[] }[] = [];
  const existing = await prisma.employmentRecord.findMany({
    where: { organizationId },
    select: {
      employeeCode: true,
      externalEmployeeId: true,
      careerProfile: { select: { user: { select: { email: true } } } }
    }
  });
  const emails = new Set(existing.map(x => x.careerProfile.user.email.toLowerCase()));
  const codes = new Set(existing.map(x => x.employeeCode).filter(Boolean) as string[]);
  const external = new Set(existing.map(x => x.externalEmployeeId).filter(Boolean) as string[]);
  const valid: Record<string, unknown>[] = [];

  rows.forEach((raw: ImportRow, i: number) => {
    const x = normalize(raw);
    const e: string[] = [];
    if (!x.name) e.push("Name is required");
    if (!/^\S+@\S+\.\S+$/.test(x.companyEmail)) e.push("Valid company email is required");
    if (emails.has(x.companyEmail) || seenEmails.has(x.companyEmail)) e.push("Duplicate company email");
    if (x.employeeCode && (codes.has(x.employeeCode) || seenCodes.has(x.employeeCode))) e.push("Duplicate employee ID");
    if (x.externalEmployeeId && external.has(x.externalEmployeeId)) e.push("External employee ID already exists");
    if (!x.designation) e.push("Designation is required");
    if (!x.joiningDate || Number.isNaN(new Date(x.joiningDate).getTime())) e.push("Valid joining date is required");

    if (e.length) {
      errors.push({ row: i + 1, errors: e });
    } else {
      valid.push(x);
      seenEmails.add(x.companyEmail);
      if (x.employeeCode) seenCodes.add(x.employeeCode);
    }
  });

  return NextResponse.json({
    total: rows.length,
    valid: valid.length,
    invalid: errors.length,
    errors,
    preview: valid.slice(0, 2000)
  });
}

export async function PUT(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const b = await req.json();
  const organizationId = String(b.organizationId || "");
  const rows: ImportRow[] = Array.isArray(b.rows) ? b.rows : [];
  const fileName = String(b.fileName || "");

  if (!(await access(user.id, organizationId))) {
    return NextResponse.json({ error: "Organization access denied" }, { status: 403 });
  }
  if (!rows.length || rows.length > 2000) {
    return NextResponse.json({ error: "Import must contain 1-2,000 rows." }, { status: 400 });
  }

  const batch = await prisma.hRMSImportBatch.create({
    data: {
      organizationId,
      totalRows: rows.length,
      fileName: fileName || null,
      createdByUserId: user.id
    }
  });

  try {
    const result = await prisma.$transaction(async tx => {
      let imported = 0;

      for (let i = 0; i < rows.length; i++) {
        const x = normalize(rows[i]);
        const duplicate = await tx.employmentRecord.findFirst({
          where: {
            organizationId,
            OR: [
              x.employeeCode ? { employeeCode: x.employeeCode } : undefined,
              x.externalEmployeeId ? { externalEmployeeId: x.externalEmployeeId } : undefined,
              { careerProfile: { user: { email: x.companyEmail } } }
            ].filter(Boolean) as object[]
          },
          select: { id: true }
        });

        if (duplicate) throw new Error("Row " + (i + 1) + ": employee already exists.");

        const careerId = await generateUniqueCareerId();
        const profile = await tx.careerProfile.create({
          data: {
            careerId,
            user: {
              create: {
                name: x.name,
                email: x.companyEmail,
                phone: x.phone || null,
                passwordHash: "IMPORT_INVITE_PENDING",
                accountStatus: "INVITED",
                invitedAt: new Date()
              }
            }
          }
        });

        const employment = await tx.employmentRecord.create({
          data: {
            careerProfileId: profile.id,
            organizationId,
            employeeCode: x.employeeCode || null,
            designation: x.designation,
            department: x.department || null,
            employmentType: x.employmentType || null,
            joinedAt: new Date(x.joiningDate),
            source: "IMPORT",
            externalEmployeeId: x.externalEmployeeId || null
          }
        });

        await tx.companyEmployeeAccount.create({
          data: {
            organizationId,
            employmentRecordId: employment.id,
            email: x.companyEmail,
            phone: x.phone || null,
            status: "INVITED"
          }
        });

        imported++;
      }

      return imported;
    }, { maxWait: 10000, timeout: 120000 });

    const updated = await prisma.hRMSImportBatch.update({
      where: { id: batch.id },
      data: {
        status: "COMPLETED",
        importedRows: result,
        completedAt: new Date()
      }
    });

    await prisma.auditEvent.create({
      data: {
        actorUserId: user.id,
        action: "HRMS_BULK_IMPORT_COMPLETED",
        entityType: "HRMSImportBatch",
        entityId: batch.id,
        metadata: { organizationId, total: rows.length, imported: result }
      }
    });

    return NextResponse.json({
      batchId: updated.id,
      status: "COMPLETED",
      total: rows.length,
      imported: result,
      failed: 0
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed";

    await prisma.hRMSImportBatch.update({
      where: { id: batch.id },
      data: {
        status: "ROLLED_BACK",
        failedRows: rows.length,
        errorMessage: message,
        completedAt: new Date()
      }
    });

    await prisma.auditEvent.create({
      data: {
        actorUserId: user.id,
        action: "HRMS_BULK_IMPORT_ROLLED_BACK",
        entityType: "HRMSImportBatch",
        entityId: batch.id,
        metadata: { organizationId, total: rows.length, error: message }
      }
    });

    return NextResponse.json({
      batchId: batch.id,
      status: "ROLLED_BACK",
      total: rows.length,
      imported: 0,
      failed: rows.length,
      error: message
    }, { status: 409 });
  }
}
