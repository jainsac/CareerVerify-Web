import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { currentUser } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
export async function POST(req:Request){
 const u=await currentUser(); if(!u?.careerProfile)return NextResponse.json({error:"Employee authentication required"},{status:401});
 const form=await req.formData(); const employmentRecordId=String(form.get("employmentRecordId")??""); const file=form.get("file");
 if(!employmentRecordId||!(file instanceof File))return NextResponse.json({error:"employmentRecordId and PDF file are required"},{status:400});
 if(file.type!=="application/pdf")return NextResponse.json({error:"Only PDF experience letters are supported"},{status:400});
 if(file.size>10*1024*1024)return NextResponse.json({error:"Maximum file size is 10 MB"},{status:400});
 const e=await prisma.employmentRecord.findFirst({where:{id:employmentRecordId,careerProfileId:u.careerProfile.id}});
 if(!e)return NextResponse.json({error:"Employment record not found"},{status:404});
 if(!process.env.BLOB_READ_WRITE_TOKEN)return NextResponse.json({error:"Private document storage is not configured yet"},{status:503});
 const blob=await put("experience-letters/"+u.careerProfile.id+"/"+crypto.randomUUID()+".pdf",file,{access:"private",addRandomSuffix:false});
 return NextResponse.json({ok:true,storagePath:blob.pathname,url:blob.url});
}