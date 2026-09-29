import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await currentUser();
  if (!user || user.role === "EMPLOYEE") return NextResponse.json({ error: "Employer access required" }, { status: 401 });

  const memberships = await prisma.organizationMember.findMany({ where: { userId: user.id }, select: { organizationId: true } });
  const orgIds = memberships.map(x => x.organizationId);
  if (!orgIds.length) return NextResponse.json([]);

  const rows = await prisma.additionalInformationRequest.findMany({
    where: { employmentRecord: { organizationId: { in: orgIds } } },
    include: {
      employmentRecord: {
        select: {
          organizationId: true,
          designation: true,
          joinedAt: true,
          leftAt: true,
          careerProfile: { select: { careerId: true, user: { select: { name: true } } } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const requesterIds = [...new Set(rows.map(x => x.requestingOrgId))];
  const orgs = await prisma.organization.findMany({ where: { id: { in: requesterIds } }, select: { id: true, name: true } });
  const names = new Map(orgs.map(x => [x.id, x.name]));

  return NextResponse.json(rows.map(x => ({
    id:x.id, careerId:x.employmentRecord.careerProfile.careerId, employeeName:x.employmentRecord.careerProfile.user.name,
    designation:x.employmentRecord.designation, joinedAt:x.employmentRecord.joinedAt, leftAt:x.employmentRecord.leftAt,
    requestingOrganization:names.get(x.requestingOrgId)||"Unknown organization", question:x.question, status:x.status,
    response:x.response, createdAt:x.createdAt, respondedAt:x.respondedAt,
  })));
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user || user.role === "EMPLOYEE") return NextResponse.json({ error: "Employer access required" }, { status: 401 });

  const body = await req.json();
  const employmentRecordId = String(body.employmentRecordId ?? "").trim();
  const requestingOrgId = String(body.requestingOrgId ?? "").trim();
  const question = String(body.question ?? "").trim();
  if (!employmentRecordId || !requestingOrgId || question.length < 3) return NextResponse.json({ error: "employmentRecordId, requestingOrgId and question are required" }, { status: 400 });

  const requester = await prisma.organizationMember.findFirst({ where: { userId: user.id, organizationId: requestingOrgId } });
  if (!requester) return NextResponse.json({ error: "You are not authorized for the requesting organization" }, { status: 403 });

  const employment = await prisma.employmentRecord.findUnique({ where: { id: employmentRecordId }, select: { id:true, careerProfileId:true, organizationId:true, verifiedAt:true } });
  if (!employment) return NextResponse.json({ error: "Employment record not found" }, { status: 404 });
  if (!employment.verifiedAt) return NextResponse.json({ error: "Additional information can only be requested for a verified experience" }, { status: 409 });
  if (employment.organizationId === requestingOrgId) return NextResponse.json({ error: "Requesting and prior organization must be different" }, { status: 400 });

  const row = await prisma.additionalInformationRequest.create({ data: { employmentRecordId, requestingOrgId, requestingUserId:user.id, question } });
  const members = await prisma.organizationMember.findMany({ where: { organizationId: employment.organizationId }, select: { userId:true } });
  if (members.length) await prisma.notification.createMany({ data: members.map(m=>({userId:m.userId,type:"ADDITIONAL_INFORMATION_REQUEST",title:"Additional employment information requested",message:"A new employer has requested additional information about a verified employment record."})) });
  return NextResponse.json({ ok:true, requestId:row.id }, { status:201 });
}

export async function PATCH(req: Request) {
  const user = await currentUser();
  if (!user || user.role === "EMPLOYEE") return NextResponse.json({ error: "Prior employer access required" }, { status: 401 });
  const body = await req.json();
  const id=String(body.requestId??"").trim(), response=String(body.response??"").trim();
  if(!id||response.length<1) return NextResponse.json({error:"requestId and response are required"},{status:400});
  const row=await prisma.additionalInformationRequest.findUnique({where:{id},include:{employmentRecord:{select:{organizationId: true}}}});
  if(!row)return NextResponse.json({error:"Request not found"},{status:404});
  const membership=await prisma.organizationMember.findFirst({where:{userId:user.id,organizationId:row.employmentRecord.organizationId}});
  if(!membership)return NextResponse.json({error:"You are not authorized for the prior employer"},{status:403});
  if(row.status!=="PENDING")return NextResponse.json({error:"Request is already closed"},{status:409});
  const updated=await prisma.additionalInformationRequest.update({where:{id},data:{status:"RESPONDED",response,respondedByUserId:user.id,respondedAt:new Date()}});
  const profile=await prisma.employmentRecord.findUnique({where:{id:row.employmentRecordId},select:{careerProfile:{select:{userId:true}}}});
  if(profile) await prisma.notification.create({data:{userId:profile.careerProfile.userId,type:"ADDITIONAL_INFORMATION_RESPONSE",title:"Additional employment information provided",message:"A prior employer has responded to an additional information request."}});
  return NextResponse.json({ok:true,request:updated});
}
