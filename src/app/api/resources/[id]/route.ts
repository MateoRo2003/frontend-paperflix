import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, ok, err } from '@/lib/auth';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const resource = await prisma.resource.findUnique({ where: { id: Number(params.id) } });
  if (!resource) return err('Not found', 404);
  return ok(resource);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const data = await req.json();
  const resource = await prisma.resource.update({ where: { id: Number(params.id) }, data });
  return ok(resource);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  await prisma.resource.delete({ where: { id: Number(params.id) } });
  return ok({ success: true });
}
