import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, ok } from '@/lib/auth';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const body = await req.json();
  // Never allow overwriting status through this endpoint
  const { status, id: _id, createdAt, ...safeData } = body;
  const updated = await prisma.suggestion.update({
    where: { id: Number(params.id) },
    data: safeData,
  });
  return ok(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  await prisma.suggestion.delete({ where: { id: Number(params.id) } });
  return ok({ success: true });
}
