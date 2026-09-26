import crypto from "crypto";
import { NextResponse } from "next/server";
import { currentUser } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";

async function member(userId: string, organizationId: string) {
  return prisma.organizationMember.findFirst({ where: { userId, organizationId } });
}

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const organizationId = new URL(req.url).searchParams.get("organizationId") || "";
  if (!(await member(user.id, organizationId))) return NextResponse.json({ error: "Organization access denied" }, { status: 403 });
  const rows = await prisma.integrationApiKey.findMany({ where: { organizationId }, select: { id: true, name: true, keyPrefix: true, scopes: true, lastUsedAt: true, revokedAt: true, createdAt: true }, orderBy: { createdAt: "desc" } });
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const b = await req.json();
  const organizationId = String(b.organizationId || "");
  const name = String(b.name || "").trim();
  const scopes = Array.isArray(b.scopes) ? b.scopes.map(String).filter(Boolean) : [];
  if (!(await member(user.id, organizationId))) return NextResponse.json({ error: "Organization access denied" }, { status: 403 });
  if (!name) return NextResponse.json({ error: "Key name is required" }, { status: 400 });
  if (!scopes.length) return NextResponse.json({ error: "Select at least one scope" }, { status: 400 });

  const raw = "cv_live_" + crypto.randomBytes(32).toString("hex");
  const keyHash = crypto.createHash("sha256").update(raw).digest("hex");
  const row = await prisma.integrationApiKey.create({ data: { organizationId, name, keyPrefix: raw.slice(0, 16), keyHash, scopes: scopes.join(",") } });
  await prisma.auditEvent.create({ data: { actorUserId: user.id, action: "INTEGRATION_API_KEY_CREATED", entityType: "IntegrationApiKey", entityId: row.id, metadata: { organizationId, scopes } } });
  return NextResponse.json({ id: row.id, name: row.name, key: raw, scopes }, { status: 201 });
}

export async function PATCH(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const b = await req.json();
  const organizationId = String(b.organizationId || "");
  const id = String(b.id || "");
  if (!(await member(user.id, organizationId))) return NextResponse.json({ error: "Organization access denied" }, { status: 403 });
  const row = await prisma.integrationApiKey.updateMany({ where: { id, organizationId, revokedAt: null }, data: { revokedAt: new Date() } });
  return NextResponse.json({ ok: row.count === 1 });
}
