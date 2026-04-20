import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, ok } from '@/lib/auth';

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { ids } = await req.json();
  await Promise.all(
    (ids as number[]).map((id, order) => prisma.slide.update({ where: { id }, data: { order } }))
  );
  return ok({ success: true });
}
