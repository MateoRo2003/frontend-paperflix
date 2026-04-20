import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, ok } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const distinct = await prisma.resource.findMany({ select: { activityType: true }, distinct: ['activityType'] });
  let inserted = 0;
  for (const { activityType } of distinct) {
    if (!activityType) continue;
    const exists = await prisma.activityType.findFirst({ where: { name: activityType } });
    if (!exists) { await prisma.activityType.create({ data: { name: activityType } }); inserted++; }
  }
  return ok({ inserted });
}
