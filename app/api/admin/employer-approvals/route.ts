import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { currentUser } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const id = new URL(req.url).searchParams.get("organizationId");
  if (id) {
    const org = await prisma.organization.findUnique({ where: { id } });
    if (!org?.certificatePath) return NextResponse.json({ error: "Certificate not found" }, { status: 404 });
    const result = await get(org.certificatePath, { access: "private" });
    if (!result) return NextResponse.json({ error: "Certificate could not be read" }, { status: 404 });
    return new Response(result.stream, { headers: { "Content-Type": result.blob.contentType || "application/octet-stream", "Content-Disposition": "inline; filename=employer-certificate" } });
  }
  const rows = await prisma.organization.findMany({
    where: { verificationStatus: "PENDING" },
    include: { createdByUser: { select: { name: true, email: true, phone: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(rows.map(o => ({
    id:o.id,name:o.name,cin:o.cin,gstin:o.gstin,verificationStatus:o.verificationStatus,
    certificateAvailable:Boolean(o.certificatePath),createdAt:o.createdAt,owner:o.createdByUser,
  })));
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const body = await req.json();
  const organizationId = String(body.organizationId ?? "").trim();
  const action = body.action === "APPROVE" ? "APPROVE" : body.action === "REJECT" ? "REJECT" : "";
  const note = String(body.note ?? "").trim();
  if (!organizationId || !action) return NextResponse.json({ error: "organizationId and action are required" }, { status: 400 });
  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  if (action === "APPROVE") {
    const updated = await prisma.organization.update({ where:{id:org.id}, data:{ verificationStatus:"APPROVED", verifiedAt:new Date(), reviewedAt:new Date(), reviewNote:note||null }});
    await prisma.auditEvent.create({ data:{ actorUserId:user.id, action:"EMPLOYER_ACCOUNT_APPROVED", entityType:"Organization", entityId:org.id, metadata:{note:note||null} }});
    return NextResponse.json({ok:true,organization:updated});
  }
  const updated = await prisma.organization.update({ where:{id:org.id}, data:{ verificationStatus:"REJECTED", verifiedAt:null, reviewedAt:new Date(), reviewNote:note||null }});
  await prisma.auditEvent.create({ data:{ actorUserId:user.id, action:"EMPLOYER_ACCOUNT_REJECTED", entityType:"Organization", entityId:org.id, metadata:{note:note||null} }});
  return NextResponse.json({ok:true,organization:updated});
}
