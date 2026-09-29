import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

function bearer(req: Request) {
  const value = req.headers.get("authorization") || "";
  return value.startsWith("Bearer ") ? value.slice(7).trim() : "";
}

export async function POST(req: Request) {
  const rawKey = bearer(req);
  if (!rawKey) return NextResponse.json({ error: "Bearer integration API key required" }, { status: 401 });

  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
  const key = await prisma.integrationApiKey.findUnique({
    where: { keyHash },
    select: { id: true, organizationId: true, scopes: true, revokedAt: true },
  });

  if (!key || key.revokedAt) return NextResponse.json({ error: "Invalid or revoked integration key" }, { status: 401 });

  const scopes = key.scopes.split(/[\s,]+/).filter(Boolean);
  if (!scopes.includes("documents:write") && !scopes.includes("hrms:write") && !scopes.includes("*")) {
    return NextResponse.json({ error: "Integration key does not have document write permission" }, { status: 403 });
  }

  const body = await req.json();
  const employmentRecordId = String(body.employmentRecordId ?? "").trim();
  const externalEmployeeId = String(body.externalEmployeeId ?? "").trim();
  const documents = Array.isArray(body.documents) ? body.documents : [];

  if ((!employmentRecordId && !externalEmployeeId) || !documents.length) {
    return NextResponse.json({ error: "employmentRecordId or externalEmployeeId and at least one document are required" }, { status: 400 });
  }

  const employment = await prisma.employmentRecord.findFirst({
    where: {
      organizationId: key.organizationId,
      ...(employmentRecordId ? { id: employmentRecordId } : { externalEmployeeId }),
    },
    select: { id: true },
  });
  if (!employment) return NextResponse.json({ error: "Employment record not found for this organization" }, { status: 404 });

  const created = [];
  for (const item of documents) {
    const documentType = String(item.documentType ?? "OTHER").trim().toUpperCase();
    const title = String(item.title ?? documentType).trim();
    if (!title) continue;
    const row = await prisma.employmentDocument.create({
      data: {
        employmentRecordId: employment.id,
        documentType,
        title,
        source: "HRMS",
        documentRef: item.documentRef ? String(item.documentRef) : null,
        storagePath: item.storagePath ? String(item.storagePath) : null,
        documentHash: item.documentHash ? String(item.documentHash) : null,
        issuedAt: item.issuedAt ? new Date(item.issuedAt) : null,
        verifiedAt: new Date(),
      },
    });
    created.push(row);
  }

  await prisma.integrationApiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });

  return NextResponse.json({ ok: true, employmentRecordId: employment.id, documents: created }, { status: 201 });
}
