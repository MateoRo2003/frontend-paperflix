import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, ok, err } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  return ok(await prisma.slide.update({ where: { id: Number(params.id) }, data: await req.json() }));
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  await prisma.slide.delete({ where: { id: Number(params.id) } });
  return ok({ success: true });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const data = await req.json();
  if (!data.title) return err('title requerido');
  return ok(await prisma.slide.update({ where: { id: Number(params.id) }, data }));
}
