import { NextResponse } from "next/server";
import { currentUser } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";

async function member(userId:string,organizationId:string){return prisma.organizationMember.findFirst({where:{userId,organizationId}})}

export async function GET(req:Request){
 const user=await currentUser();if(!user)return NextResponse.json({error:"Authentication required"},{status:401});
 const organizationId=new URL(req.url).searchParams.get("organizationId")||"";
 if(!(await member(user.id,organizationId)))return NextResponse.json({error:"Organization access denied"},{status:403});
 const [structures,runs]=await Promise.all([
  prisma.salaryStructure.findMany({where:{organizationId,active:true},include:{employmentRecord:{include:{careerProfile:{include:{user:{select:{name:true,email:true}}}}}}},orderBy:{updatedAt:"desc"}}),
  prisma.payrollRun.findMany({where:{organizationId},include:{entries:true},orderBy:{periodStart:"desc"},take:24})
 ]);
 return NextResponse.json({structures,runs});
}

export async function POST(req:Request){
 const user=await currentUser();if(!user)return NextResponse.json({error:"Authentication required"},{status:401});
 const b=await req.json(),organizationId=String(b.organizationId||""),action=String(b.action||"").toUpperCase();
 if(!(await member(user.id,organizationId)))return NextResponse.json({error:"Organization access denied"},{status:403});
 if(action==="SALARY"){
  const employmentRecordId=String(b.employmentRecordId||""),basic=Number(b.basic),hra=Number(b.hra||0),allowances=Number(b.allowances||0),deductions=Number(b.deductions||0),effectiveFrom=new Date(String(b.effectiveFrom||""));
  if(!employmentRecordId||!Number.isFinite(basic)||basic<0||Number.isNaN(effectiveFrom.getTime()))return NextResponse.json({error:"Employee, basic salary and effective date are required."},{status:400});
  const emp=await prisma.employmentRecord.findFirst({where:{id:employmentRecordId,organizationId,status:"ACTIVE"}});if(!emp)return NextResponse.json({error:"Active employee not found."},{status:404});
  return NextResponse.json(await prisma.salaryStructure.upsert({where:{employmentRecordId},create:{organizationId,employmentRecordId,basic,hra,allowances,deductions,effectiveFrom},update:{basic,hra,allowances,deductions,effectiveFrom,active:true}}));
 }
 if(action==="RUN"){
  const start=new Date(String(b.periodStart||"")),end=new Date(String(b.periodEnd||""));
  if(Number.isNaN(start.getTime())||Number.isNaN(end.getTime())||end<start)return NextResponse.json({error:"Valid payroll period is required."},{status:400});
  const existing=await prisma.payrollRun.findUnique({where:{organizationId_periodStart_periodEnd:{organizationId,periodStart:start,periodEnd:end}}});if(existing)return NextResponse.json({error:"Payroll run already exists for this period."},{status:409});
  const [employees,compliance]=await Promise.all([prisma.employmentRecord.findMany({where:{organizationId,status:"ACTIVE"},include:{salaryStructure:true}}),prisma.payrollComplianceConfig.findUnique({where:{organizationId}})]);
  const eligible=employees.filter(e=>e.salaryStructure);
  const run=await prisma.$transaction(async tx=>{
    const r=await tx.payrollRun.create({data:{organizationId,periodStart:start,periodEnd:end,status:"CALCULATED",createdByUserId:user.id,processedAt:new Date()}});
    for(const e of eligible){const s=e.salaryStructure!;const basic=Number(s.basic),hra=Number(s.hra),allowances=Number(s.allowances),gross=basic+hra+allowances;const pf=compliance?.pfEnabled?gross*Number(compliance.pfEmployeeRate)/100:0;const esi=compliance?.esiEnabled?gross*Number(compliance.esiEmployeeRate)/100:0;const pt=compliance?.professionalTaxEnabled?Number(compliance.professionalTaxFixed):0;const tds=compliance?.tdsEnabled?Number(compliance.tdsFixed):0;const other=Number(s.deductions);const deductions=pf+esi+pt+tds+other;const net=gross-deductions;const entry=await tx.payrollEntry.create({data:{payrollRunId:r.id,employmentRecordId:e.id,gross,deductions,net}});await tx.payslip.create({data:{payrollEntryId:entry.id,basic,hra,allowances,gross,pfEmployee:pf,esiEmployee:esi,professionalTax:pt,tds,otherDeductions:other,totalDeductions:deductions,netPay:net}})}
    return r;
  },{timeout:120000});
  return NextResponse.json(run,{status:201});
 }
 return NextResponse.json({error:"Unknown payroll action."},{status:400});
}

export async function PATCH(req:Request){
 const user=await currentUser();if(!user)return NextResponse.json({error:"Authentication required"},{status:401});
 const b=await req.json(),organizationId=String(b.organizationId||""),id=String(b.id||""),status=String(b.status||"").toUpperCase();
 if(!(await member(user.id,organizationId)))return NextResponse.json({error:"Organization access denied"},{status:403});
 if(!["DRAFT","CALCULATED","FINALIZED","CANCELLED"].includes(status))return NextResponse.json({error:"Invalid payroll status."},{status:400});
 const row=await prisma.payrollRun.updateMany({where:{id,organizationId,status:{not:"FINALIZED"}},data:{status,processedAt:status==="FINALIZED"?new Date():undefined}});
 return NextResponse.json({ok:row.count===1});
}
