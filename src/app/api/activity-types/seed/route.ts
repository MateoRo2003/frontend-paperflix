import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, ok } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  // Extract all raw activity_type values, split by comma, and collect unique individual types
  const rawList = await prisma.resource.findMany({ select: { activityType: true }, distinct: ['activityType'] });

  const individualTypes = new Set<string>();
  for (const { activityType } of rawList) {
    if (!activityType) continue;
    // Split by comma and add each trimmed individual type
    activityType.split(',').forEach(t => {
      const trimmed = t.trim();
      if (trimmed) individualTypes.add(trimmed);
    });
  }

  let inserted = 0;
  for (const name of Array.from(individualTypes)) {
    const exists = await prisma.activityType.findFirst({ where: { name } });
    if (!exists) { await prisma.activityType.create({ data: { name } }); inserted++; }
  }
  return ok({ inserted });
}

