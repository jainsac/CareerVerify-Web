import { NextResponse } from "next/server";
import { currentUser } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
export async function GET(){
 const u=await currentUser(); if(!u)return NextResponse.json({error:"Authentication required"},{status:401});
 if(u.role!=="ADMIN")return NextResponse.json({error:"Admin authentication required"},{status:403});
 const rows=await prisma.employmentDispute.findMany({where:{status:"OPEN"},include:{employmentRecord:{include:{careerProfile:{select:{careerId:true,user:{select:{name:true}}}},organization:true}}},orderBy:{createdAt:"desc"}});
 return NextResponse.json(rows.map(d=>({id:d.id,reason:d.reason,createdAt:d.createdAt,careerId:d.employmentRecord.careerProfile.careerId,employeeName:d.employmentRecord.careerProfile.user.name,organization:d.employmentRecord.organization.name,employmentRecordId:d.employmentRecordId})));
}
export async function POST(req:Request){
 const u=await currentUser(); if(u?.role!=="ADMIN")return NextResponse.json({error:"Admin authentication required"},{status:403});
 const b=await req.json();const disputeId=String(b.disputeId??"").trim();const status=String(b.status??"").trim().toUpperCase();const resolution=String(b.resolution??"").trim();
 if(!disputeId||!["RESOLVED","REJECTED"].includes(status)||resolution.length<3)return NextResponse.json({error:"disputeId, valid status and resolution are required"},{status:400});
 const d=await prisma.employmentDispute.findUnique({where:{id:disputeId}});
 if(!d||d.status!=="OPEN")return NextResponse.json({error:"Open dispute not found"},{status:404});
 const updated=await prisma.employmentDispute.update({where:{id:disputeId},data:{status,resolution,resolvedByUserId:u.id,resolvedAt:new Date()}});
 if(status==="RESOLVED")await prisma.employmentRecord.update({where:{id:d.employmentRecordId},data:{status:"LEFT",remarks:resolution}});
 await prisma.auditEvent.create({data:{actorUserId:u.id,action:"EMPLOYMENT_DISPUTE_RESOLVED",entityType:"EmploymentDispute",entityId:d.id,metadata:{status,resolution}}});
 return NextResponse.json({ok:true,dispute:updated});
}