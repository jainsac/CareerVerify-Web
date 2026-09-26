import { NextResponse } from "next/server";
import { currentUser } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";

export async function GET(req:Request){
 const user=await currentUser();if(!user)return NextResponse.json({error:"Authentication required"},{status:401});
 const p=new URL(req.url).searchParams,organizationId=p.get("organizationId")||"",runId=p.get("runId")||"";
 const member=await prisma.organizationMember.findFirst({where:{userId:user.id,organizationId}});if(!member)return NextResponse.json({error:"Organization access denied"},{status:403});
 if(!runId)return NextResponse.json({error:"Payroll run is required."},{status:400});
 const run=await prisma.payrollRun.findFirst({where:{id:runId,organizationId},include:{entries:{include:{payslip:true,employmentRecord:{include:{careerProfile:{include:{user:{select:{name:true,email:true}}}}}}}}}});
 if(!run)return NextResponse.json({error:"Payroll run not found."},{status:404});
 return NextResponse.json(run);
}
