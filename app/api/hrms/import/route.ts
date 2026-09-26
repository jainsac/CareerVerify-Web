import { NextResponse } from "next/server";
import { currentUser } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { generateUniqueCareerId } from "../../../../lib/career-id";

const fields = ["name","companyEmail","phone","employeeCode","designation","department","joiningDate","employmentType","externalEmployeeId"] as const;

async function access(userId:string, organizationId:string) {
  return prisma.organizationMember.findFirst({ where:{ userId, organizationId } });
}

function normalize(row:Record<string,unknown>) {
  const get=(...names:string[])=>{const key=Object.keys(row).find(k=>names.includes(k.trim().toLowerCase()));return key?String(row[key]??"").trim():""};
  return {
    name:get("name","full name","employee name"),
    companyEmail:get("companyemail","company email","email").toLowerCase(),
    phone:get("phone","mobile","mobile number").replace(/\D/g,""),
    employeeCode:get("employeecode","employee code","employee id"),
    designation:get("designation","job title"),
    department:get("department","dept"),
    joiningDate:get("joiningdate","joining date","date of joining","doj"),
    employmentType:get("employmenttype","employment type","type"),
    externalEmployeeId:get("externalemployeeid","external employee id","external id"),
  };
}

export async function POST(req:Request) {
  const user=await currentUser();
  if(!user)return NextResponse.json({error:"Authentication required"},{status:401});
  const body=await req.json();
  const organizationId=String(body.organizationId||"");
  const rows=Array.isArray(body.rows)?body.rows:[];
  if(!(await access(user.id,organizationId)))return NextResponse.json({error:"Organization access denied"},{status:403});
  if(!rows.length)return NextResponse.json({error:"No rows supplied."},{status:400});
  if(rows.length>2000)return NextResponse.json({error:"Maximum 2,000 rows per import batch."},{status:400});

  const seenEmails=new Set<string>(),seenCodes=new Set<string>(),valid:Record<string,unknown>[]=[];const errors:{row:number;errors:string[]}[]=[];
  const existing=await prisma.employmentRecord.findMany({where:{organizationId},select:{employeeCode:true,externalEmployeeId:true,careerProfile:{select:{user:{select:{email:true}}}}}});
  const existingEmails=new Set(existing.map(x=>x.careerProfile.user.email.toLowerCase()));
  const existingCodes=new Set(existing.map(x=>x.employeeCode).filter(Boolean) as string[]);
  const existingExternal=new Set(existing.map(x=>x.externalEmployeeId).filter(Boolean) as string[]);

  rows.forEach((raw,i)=>{
    const x=normalize(raw);const e:string[]=[];
    if(!x.name)e.push("Name is required");
    if(!x.companyEmail||!/^\S+@\S+\.\S+$/.test(x.companyEmail))e.push("Valid company email is required");
    if(x.companyEmail&&(existingEmails.has(x.companyEmail)||seenEmails.has(x.companyEmail)))e.push("Duplicate company email");
    if(x.employeeCode&&(existingCodes.has(x.employeeCode)||seenCodes.has(x.employeeCode)))e.push("Duplicate employee ID");
    if(x.externalEmployeeId&&(existingExternal.has(x.externalEmployeeId)))e.push("External employee ID already exists");
    if(!x.designation)e.push("Designation is required");
    if(!x.joiningDate||Number.isNaN(new Date(x.joiningDate).getTime()))e.push("Valid joining date is required");
    if(e.length)errors.push({row:i+1,errors:e});else{valid.push(x);seenEmails.add(x.companyEmail);if(x.employeeCode)seenCodes.add(x.employeeCode)}
  });
  return NextResponse.json({total:rows.length,valid:valid.length,invalid:errors.length,errors,preview:valid.slice(0,50),fields});
}

export async function PUT(req:Request) {
  const user=await currentUser();
  if(!user)return NextResponse.json({error:"Authentication required"},{status:401});
  const body=await req.json();const organizationId=String(body.organizationId||"");const rows=Array.isArray(body.rows)?body.rows:[];
  if(!(await access(user.id,organizationId)))return NextResponse.json({error:"Organization access denied"},{status:403});
  if(!rows.length||rows.length>2000)return NextResponse.json({error:"Import must contain 1-2,000 rows."},{status:400});

  let imported=0;const failed:{row:number;error:string}[]=[];
  for(let i=0;i<rows.length;i++){const x=normalize(rows[i]);try{
    if(!x.name||!x.companyEmail||!x.designation||Number.isNaN(new Date(x.joiningDate).getTime()))throw new Error("Required fields are missing or invalid.");
    const duplicate=await prisma.employmentRecord.findFirst({where:{organizationId,OR:[{employeeCode:x.employeeCode||undefined},{externalEmployeeId:x.externalEmployeeId||undefined},{careerProfile:{user:{email:x.companyEmail}}}]},select:{id:true}});
    if(duplicate)throw new Error("Employee already exists in this organization.");
    const careerId=await generateUniqueCareerId();
    await prisma.$transaction(async tx=>{
      const profile=await tx.careerProfile.create({data:{careerId,user:{create:{name:x.name,email:x.companyEmail,phone:x.phone||null,passwordHash:"IMPORT_INVITE_PENDING",accountStatus:"INVITED",invitedAt:new Date()}}}});
      const employment=await tx.employmentRecord.create({data:{careerProfileId:profile.id,organizationId,employeeCode:x.employeeCode||null,designation:x.designation,department:x.department||null,employmentType:x.employmentType||null,joinedAt:new Date(x.joiningDate),source:"IMPORT",externalEmployeeId:x.externalEmployeeId||null}});
      await tx.companyEmployeeAccount.create({data:{organizationId,employmentRecordId:employment.id,email:x.companyEmail,phone:x.phone||null,status:"INVITED"}});
    });imported++;
  }catch(err){failed.push({row:i+1,error:err instanceof Error?err.message:"Import failed"});}}
  await prisma.auditEvent.create({data:{actorUserId:user.id,action:"HRMS_BULK_IMPORT",entityType:"Organization",entityId:organizationId,metadata:{total:rows.length,imported,failed:failed.length}}});
  return NextResponse.json({total:rows.length,imported,failed});
}
