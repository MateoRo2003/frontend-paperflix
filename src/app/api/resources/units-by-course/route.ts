import { prisma } from '@/lib/prisma';
import { ok } from '@/lib/auth';

export async function GET() {
  const units = await prisma.unit.findMany({
    orderBy: [{ course: 'asc' }, { order: 'asc' }],
    include: { subject: { select: { id: true, name: true, slug: true } } },
  });

  const grouped: Record<string, unknown[]> = {};
  for (const u of units) {
    const key = u.course || 'Sin curso';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(u);
  }
  return ok(grouped);
}
