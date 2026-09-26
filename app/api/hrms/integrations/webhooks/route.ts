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
  return NextResponse.json(await prisma.integrationWebhook.findMany({ where: { organizationId }, select: { id: true, url: true, events: true, active: true, createdAt: true, updatedAt: true }, orderBy: { createdAt: "desc" } }));
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const b = await req.json();
  const organizationId = String(b.organizationId || "");
  const url = String(b.url || "").trim();
  const events = Array.isArray(b.events) ? b.events.map(String).filter(Boolean) : [];
  if (!(await member(user.id, organizationId))) return NextResponse.json({ error: "Organization access denied" }, { status: 403 });
  try { new URL(url); } catch { return NextResponse.json({ error: "A valid webhook URL is required." }, { status: 400 }); }
  if (!events.length) return NextResponse.json({ error: "Select at least one event." }, { status: 400 });
  const secret = "whsec_" + crypto.randomBytes(24).toString("hex");
  const secretHash = crypto.createHash("sha256").update(secret).digest("hex");
  const row = await prisma.integrationWebhook.create({ data: { organizationId, url, secretHash, events: events.join(",") } });
  await prisma.auditEvent.create({ data: { actorUserId: user.id, action: "INTEGRATION_WEBHOOK_CREATED", entityType: "IntegrationWebhook", entityId: row.id, metadata: { organizationId, events } } });
  return NextResponse.json({ id: row.id, url, events, secret }, { status: 201 });
}

export async function PATCH(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const b = await req.json();
  const organizationId = String(b.organizationId || "");
  const id = String(b.id || "");
  const active = Boolean(b.active);
  if (!(await member(user.id, organizationId))) return NextResponse.json({ error: "Organization access denied" }, { status: 403 });
  const row = await prisma.integrationWebhook.updateMany({ where: { id, organizationId }, data: { active } });
  return NextResponse.json({ ok: row.count === 1 });
}
