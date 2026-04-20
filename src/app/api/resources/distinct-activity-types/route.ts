import { prisma } from '@/lib/prisma';
import { ok } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const rows = await prisma.resource.findMany({ select: { activityType: true }, distinct: ['activityType'], where: { isActive: true } });
  const typeSet = new Set<string>();
  rows.forEach(r => {
    if (r.activityType) r.activityType.split(',').forEach((t: string) => {
      const trimmed = t.trim();
      if (trimmed) typeSet.add(trimmed);
    });
  });
  return ok(Array.from(typeSet).sort());
}
