import { NextResponse } from "next/server";
import { currentUser } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";

export async function GET(req:Request){
 const user=await currentUser();if(!user)return NextResponse.json({error:"Authentication required"},{status:401});
 const organizationId=new URL(req.url).searchParams.get("organizationId")||"";
 const member=await prisma.organizationMember.findFirst({where:{userId:user.id,organizationId}});if(!member)return NextResponse.json({error:"Organization access denied"},{status:403});
 return NextResponse.json(await prisma.payrollComplianceConfig.findUnique({where:{organizationId}}));
}
export async function PUT(req:Request){
 const user=await currentUser();if(!user)return NextResponse.json({error:"Authentication required"},{status:401});
 const b=await req.json(),organizationId=String(b.organizationId||"");
 const member=await prisma.organizationMember.findFirst({where:{userId:user.id,organizationId}});if(!member)return NextResponse.json({error:"Organization access denied"},{status:403});
 const n=(v:any)=>{const x=Number(v||0);return Number.isFinite(x)&&x>=0?x:0};
 const row=await prisma.payrollComplianceConfig.upsert({where:{organizationId},create:{organizationId,pfEnabled:Boolean(b.pfEnabled),pfEmployeeRate:n(b.pfEmployeeRate),pfEmployerRate:n(b.pfEmployerRate),esiEnabled:Boolean(b.esiEnabled),esiEmployeeRate:n(b.esiEmployeeRate),esiEmployerRate:n(b.esiEmployerRate),professionalTaxEnabled:Boolean(b.professionalTaxEnabled),professionalTaxFixed:n(b.professionalTaxFixed),tdsEnabled:Boolean(b.tdsEnabled),tdsFixed:n(b.tdsFixed)},update:{pfEnabled:Boolean(b.pfEnabled),pfEmployeeRate:n(b.pfEmployeeRate),pfEmployerRate:n(b.pfEmployerRate),esiEnabled:Boolean(b.esiEnabled),esiEmployeeRate:n(b.esiEmployeeRate),esiEmployerRate:n(b.esiEmployerRate),professionalTaxEnabled:Boolean(b.professionalTaxEnabled),professionalTaxFixed:n(b.professionalTaxFixed),tdsEnabled:Boolean(b.tdsEnabled),tdsFixed:n(b.tdsFixed)}});
 return NextResponse.json(row);
}
