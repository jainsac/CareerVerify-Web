import { NextResponse } from "next/server";
import crypto from "crypto";
import { currentUser } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
export async function POST(req:Request){
 const u=await currentUser(); if(!u?.careerProfile)return NextResponse.json({error:"Employee authentication required"},{status:401});
 const b=await req.json(); const employmentRecordId=String(b.employmentRecordId??"").trim(); const documentRef=String(b.documentRef??"").trim();
 if(!employmentRecordId||!documentRef)return NextResponse.json({error:"employmentRecordId and documentRef are required"},{status:400});
 const e=await prisma.employmentRecord.findFirst({where:{id:employmentRecordId,careerProfileId:u.careerProfile.id}});
 if(!e)return NextResponse.json({error:"Employment record not found"},{status:404});
 const documentHash=crypto.createHash("sha256").update(documentRef).digest("hex");
 const rawToken=crypto.randomBytes(32).toString("hex");
 const verificationTokenHash=crypto.createHash("sha256").update(rawToken).digest("hex");
 const letter=await prisma.experienceLetter.upsert({where:{employmentRecordId:e.id},create:{employmentRecordId:e.id,documentRef,documentHash,verificationTokenHash},update:{documentRef,documentHash,verificationTokenHash,revokedAt:null}});
 await prisma.employmentRecord.update({where:{id:e.id},data:{experienceLetterRef:letter.id}});
 await prisma.auditEvent.create({data:{actorUserId:u.id,action:"EXPERIENCE_LETTER_REGISTERED",entityType:"ExperienceLetter",entityId:letter.id}});
 const base=process.env.NEXT_PUBLIC_APP_URL||"http://localhost:3000";
 return NextResponse.json({ok:true,letterId:letter.id,documentHash,verificationUrl:base+"/verify/letter/"+rawToken});
}
export async function GET(){
 const u=await currentUser(); if(!u?.careerProfile)return NextResponse.json({error:"Authentication required"},{status:401});
 const rows=await prisma.experienceLetter.findMany({where:{employmentRecord:{careerProfileId:u.careerProfile.id}},include:{employmentRecord:{include:{organization:true}}}});
 return NextResponse.json(rows.map(x=>({id:x.id,employmentRecordId:x.employmentRecordId,organization:x.employmentRecord.organization.name,designation:x.employmentRecord.designation,issuedAt:x.issuedAt,revokedAt:x.revokedAt,documentHash:x.documentHash})));
}