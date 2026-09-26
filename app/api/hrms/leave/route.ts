import { NextResponse } from "next/server";
import { currentUser } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";

async function member(userId:string, organizationId:string){return prisma.organizationMember.findFirst({where:{userId,organizationId}})}

export async function GET(req:Request){
 const user=await currentUser();if(!user)return NextResponse.json({error:"Authentication required"},{status:401});
 const p=new URL(req.url).searchParams,organizationId=p.get("organizationId")||"";
 if(!(await member(user.id,organizationId)))return NextResponse.json({error:"Organization access denied"},{status:403});
 const [policies,requests]=await Promise.all([
  prisma.leavePolicy.findMany({where:{organizationId,active:true},orderBy:{name:"asc"}}),
  prisma.leaveRequest.findMany({where:{organizationId},include:{policy:true,employmentRecord:{include:{careerProfile:{include:{user:{select:{name:true,email:true}}}}}}},orderBy:{createdAt:"desc"},take:500})
 ]);
 return NextResponse.json({policies,requests});
}

export async function POST(req:Request){
 const user=await currentUser();if(!user)return NextResponse.json({error:"Authentication required"},{status:401});
 const b=await req.json(),organizationId=String(b.organizationId||""),action=String(b.action||"").toUpperCase();
 if(!(await member(user.id,organizationId)))return NextResponse.json({error:"Organization access denied"},{status:403});
 if(action==="POLICY"){
  const name=String(b.name||"").trim(),leaveType=String(b.leaveType||"").trim().toUpperCase(),annualLimit=Number(b.annualLimit);
  if(!name||!leaveType||!Number.isInteger(annualLimit)||annualLimit<0)return NextResponse.json({error:"Policy name, type and annual limit are required."},{status:400});
  const row=await prisma.leavePolicy.upsert({where:{organizationId_leaveType:{organizationId,leaveType}},create:{organizationId,name,leaveType,annualLimit,carryForward:Boolean(b.carryForward)},update:{name,annualLimit,carryForward:Boolean(b.carryForward),active:true}});
  return NextResponse.json(row);
 }
 const employmentRecordId=String(b.employmentRecordId||""),policyId=String(b.policyId||""),start=new Date(String(b.startDate||"")),end=new Date(String(b.endDate||""));
 const days=Number(b.days);
 if(!employmentRecordId||!policyId||Number.isNaN(start.getTime())||Number.isNaN(end.getTime())||!Number.isFinite(days)||days<=0)return NextResponse.json({error:"Employee, leave policy, dates and days are required."},{status:400});
 const emp=await prisma.employmentRecord.findFirst({where:{id:employmentRecordId,organizationId,status:"ACTIVE"}});if(!emp)return NextResponse.json({error:"Active employee not found."},{status:404});
 const policy=await prisma.leavePolicy.findFirst({where:{id:policyId,organizationId,active:true}});if(!policy)return NextResponse.json({error:"Leave policy not found."},{status:404});
 const row=await prisma.leaveRequest.create({data:{organizationId,employmentRecordId,policyId,startDate:start,endDate:end,days,reason:b.reason?String(b.reason):null}});
 return NextResponse.json(row,{status:201});
}

export async function PATCH(req:Request){
 const user=await currentUser();if(!user)return NextResponse.json({error:"Authentication required"},{status:401});
 const b=await req.json(),organizationId=String(b.organizationId||""),id=String(b.id||""),status=String(b.status||"").toUpperCase(),note=String(b.note||"").trim();
 if(!(await member(user.id,organizationId)))return NextResponse.json({error:"Organization access denied"},{status:403});
 if(!["APPROVED","REJECTED","CANCELLED"].includes(status))return NextResponse.json({error:"Invalid leave status."},{status:400});
 const row=await prisma.leaveRequest.updateMany({where:{id,organizationId,status:"PENDING"},data:{status,decidedByUserId:user.id,decisionNote:note||null}});
 return NextResponse.json({ok:row.count===1});
}
