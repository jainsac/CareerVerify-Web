import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function access(userId:string, organizationId:string){return prisma.organizationMember.findFirst({where:{userId,organizationId}})}

export async function POST(req:Request){
  const user=await currentUser();
  if(!user)return NextResponse.json({error:"Authentication required"},{status:401});
  const form=await req.formData();
  const organizationId=String(form.get("organizationId")||"");
  const file=form.get("file");
  if(!(await access(user.id,organizationId)))return NextResponse.json({error:"Organization access denied"},{status:403});
  if(!(file instanceof File))return NextResponse.json({error:"CSV or Excel file is required."},{status:400});
  if(file.size>10*1024*1024)return NextResponse.json({error:"File must be 10 MB or smaller."},{status:400});
  const name=file.name.toLowerCase();
  if(!name.endsWith(".csv")&&!name.endsWith(".xlsx")&&!name.endsWith(".xls"))return NextResponse.json({error:"Only CSV, XLSX and XLS files are supported."},{status:400});
  const buffer=Buffer.from(await file.arrayBuffer());
  const workbook=XLSX.read(buffer,{type:"buffer",cellDates:true});
  const sheet=workbook.Sheets[workbook.SheetNames[0]];
  if(!sheet)return NextResponse.json({error:"The file has no readable worksheet."},{status:400});
  const rows=XLSX.utils.sheet_to_json<Record<string,unknown>>(sheet,{defval:"",raw:false});
  if(!rows.length)return NextResponse.json({error:"The worksheet contains no employee rows."},{status:400});
  if(rows.length>2000)return NextResponse.json({error:"Maximum 2,000 rows per import batch."},{status:400});
  return NextResponse.json({fileName:file.name,worksheet:workbook.SheetNames[0],total:rows.length,headers:Object.keys(rows[0]),rows});
}
