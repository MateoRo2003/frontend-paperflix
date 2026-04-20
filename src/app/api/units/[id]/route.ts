import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, ok, err } from '@/lib/auth';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const unit = await prisma.unit.findUnique({ where: { id: Number(params.id) } });
  if (!unit) return err('Not found', 404);
  return ok(unit);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const data = await req.json();
  const unit = await prisma.unit.update({ where: { id: Number(params.id) }, data });
  return ok(unit);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  await prisma.unit.delete({ where: { id: Number(params.id) } });
  return ok({ success: true });
}
