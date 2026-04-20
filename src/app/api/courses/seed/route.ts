import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, ok } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const distinct = await prisma.resource.findMany({ select: { course: true }, distinct: ['course'] });
  let inserted = 0;
  for (const { course } of distinct) {
    if (!course) continue;
    const exists = await prisma.course.findFirst({ where: { name: course } });
    if (!exists) { await prisma.course.create({ data: { name: course } }); inserted++; }
  }
  return ok({ inserted });
}
