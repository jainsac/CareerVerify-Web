import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "../../../../lib/prisma";
export async function GET(_:Request,{params}:{params:Promise<{token:string}>}) {
  const {token}=await params;
  const hash=crypto.createHash("sha256").update(token).digest("hex");
  const row=await prisma.publicVerificationToken.findUnique({where:{tokenHash:hash},include:{careerProfile:{include:{employments:{where:{status:"ACTIVE"},include:{organization:true},orderBy:{joinedAt:"desc"}}}}}});
  if(!row || row.revokedAt || (row.expiresAt && row.expiresAt<new Date())) return NextResponse.json({error:"Verification reference is invalid or expired"},{status:404});
  return NextResponse.json({careerId:row.careerProfile.careerId,employments:row.careerProfile.employments.map(e=>({organization:e.organization.name,designation:e.designation,department:e.department,joinedAt:e.joinedAt,leftAt:e.leftAt,status:e.status}))});
}