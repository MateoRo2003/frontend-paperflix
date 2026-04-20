import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, ok } from '@/lib/auth';

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { items } = await req.json();
  await Promise.all(
    items.map(({ id, order }: { id: number; order: number }) =>
      prisma.unit.update({ where: { id }, data: { order } })
    )
  );
  return ok({ success: true });
}
