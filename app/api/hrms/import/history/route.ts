import { NextResponse } from "next/server";
import { currentUser } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";

async function access(userId:string, organizationId:string){return prisma.organizationMember.findFirst({where:{userId,organizationId}})}

export async function GET(req:Request){
 const user=await currentUser(); if(!user)return NextResponse.json({error:"Authentication required"},{status:401});
 const organizationId=new URL(req.url).searchParams.get("organizationId")||"";
 if(!(await access(user.id,organizationId)))return NextResponse.json({error:"Organization access denied"},{status:403});
 const rows=await prisma.hRMSImportBatch.findMany({where:{organizationId},orderBy:{createdAt:"desc"},take:50});
 return NextResponse.json(rows);
}
