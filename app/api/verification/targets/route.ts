import { NextResponse } from "next/server";
import { currentUser } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user || user.role === "EMPLOYEE") return NextResponse.json({ error: "Authorized employer account required" }, { status: 401 });
  const careerId = new URL(req.url).searchParams.get("careerId")?.trim() || "";
  if (!careerId) return NextResponse.json({ error: "careerId is required" }, { status: 400 });

  const profile = await prisma.careerProfile.findUnique({ where: { careerId }, select: { id: true } });
  if (!profile) return NextResponse.json({ error: "Career ID not found" }, { status: 404 });

  const employments = await prisma.employmentRecord.findMany({
    where: { careerProfileId: profile.id },
    select: {
      organization: { select: { id: true, name: true } },
      verifiedAt: true,
      designation: true,
      joinedAt: true,
      leftAt: true,
      documents: { select: { id: true, documentType: true, title: true, source: true, issuedAt: true, verifiedAt: true }, orderBy: { createdAt: "desc" } },
    },
    orderBy: { joinedAt: "desc" },
  });

  const grouped = new Map<string, {
    id:string; name:string; verified:boolean; latestEmploymentId:string; experiences:number; latestDesignation:string; joinedAt:string; leftAt:string|null; documents:unknown[];
  }>();

  for (const x of employments) {
    const current = grouped.get(x.organization.id);
    if (!current) {
      grouped.set(x.organization.id, {
        id:x.organization.id, name:x.organization.name, verified:Boolean(x.verifiedAt), latestEmploymentId:x.id, experiences:1,
        latestDesignation:x.designation, joinedAt:x.joinedAt.toISOString(), leftAt:x.leftAt?.toISOString()||null, documents:x.documents,
      });
    } else {
      current.experiences += 1;
      current.verified = current.verified || Boolean(x.verifiedAt);
      if (x.joinedAt > new Date(current.joinedAt)) {
        current.latestEmploymentId=x.id;
        current.latestDesignation=x.designation;
        current.joinedAt=x.joinedAt.toISOString();
        current.leftAt=x.leftAt?.toISOString()||null;
      }
      current.documents=[...current.documents,...x.documents];
    }
  }

  return NextResponse.json([...grouped.values()]);
}
