import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, ok, err } from '@/lib/auth';

// GET /subjects/:slug — find by slug
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const subject = await prisma.subject.findFirst({
    where: { slug: params.id, deletedAt: null },
    include: {
      units: { orderBy: { order: 'asc' } },
      _count: { select: { resources: true } },
    },
  });
  if (!subject) return err('Not found', 404);
  return ok(subject);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const data = await req.json();
  const subject = await prisma.subject.update({ where: { id: Number(params.id) }, data });
  return ok(subject);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(_req);
  if (auth.error) return auth.error;

  await prisma.subject.update({
    where: { id: Number(params.id) },
    data: { deletedAt: new Date(), isActive: false },
  });
  return ok({ success: true });
}
