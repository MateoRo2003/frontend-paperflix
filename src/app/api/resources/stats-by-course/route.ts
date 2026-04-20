import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const from = p.get('from'); const to = p.get('to');
  const dateFilter = from || to ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {};

  const rows = await prisma.resource.groupBy({
    by: ['course'],
    _sum: { views: true },
    _count: { id: true },
    where: { isActive: true, ...dateFilter },
    orderBy: { _sum: { views: 'desc' } },
  });
  return ok(rows.map(r => ({ course: r.course, views: r._sum.views ?? 0, count: r._count.id })));
}
