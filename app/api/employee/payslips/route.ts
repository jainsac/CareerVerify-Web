import { NextResponse } from "next/server";
import { currentUser } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

const num = (value: unknown) => Number(value ?? 0);

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user?.careerProfile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const url = new URL(req.url);
  const entryId = url.searchParams.get("entryId");
  const runId = url.searchParams.get("runId");

  const entries = await prisma.payrollEntry.findMany({
    where: {
      ...(entryId ? { id: entryId } : {}),
      ...(runId ? { payrollRunId: runId } : {}),
      employmentRecord: { careerProfileId: user.careerProfile.id },
      payrollRun: { status: "FINALIZED" },
      payslip: { isNot: null },
    },
    include: {
      payslip: true,
      payrollRun: true,
      employmentRecord: {
        include: { organization: true },
      },
    },
    orderBy: { payrollRun: { periodEnd: "desc" } },
    take: entryId || runId ? 1 : 100,
  });

  const result = entries.map((entry) => ({
    id: entry.id,
    employeeCode: entry.employmentRecord.employeeCode,
    designation: entry.employmentRecord.designation,
    department: entry.employmentRecord.department,
    organizationName: entry.employmentRecord.organization.name,
    payrollRun: {
      id: entry.payrollRun.id,
      periodStart: entry.payrollRun.periodStart,
      periodEnd: entry.payrollRun.periodEnd,
      status: entry.payrollRun.status,
    },
    payslip: entry.payslip
      ? {
          id: entry.payslip.id,
          basic: num(entry.payslip.basic),
          hra: num(entry.payslip.hra),
          allowances: num(entry.payslip.allowances),
          gross: num(entry.payslip.gross),
          pfEmployee: num(entry.payslip.pfEmployee),
          esiEmployee: num(entry.payslip.esiEmployee),
          professionalTax: num(entry.payslip.professionalTax),
          tds: num(entry.payslip.tds),
          otherDeductions: num(entry.payslip.otherDeductions),
          totalDeductions: num(entry.payslip.totalDeductions),
          netPay: num(entry.payslip.netPay),
          createdAt: entry.payslip.createdAt,
        }
      : null,
  }));

  return NextResponse.json(result);
}
