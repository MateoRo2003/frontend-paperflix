import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const from = p.get('from');
  const to = p.get('to');
  const dateFilter = from || to ? {
    createdAt: {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to   ? { lte: new Date(to)   } : {}),
    },
  } : {};

  const [total, active, totalViewsAgg, bySubjectRaw] = await Promise.all([
    prisma.resource.count({ where: dateFilter }),
    prisma.resource.count({ where: { isActive: true, ...dateFilter } }),
    prisma.resource.aggregate({ _sum: { views: true }, where: dateFilter }),
    prisma.resource.groupBy({
      by: ['subjectId'],
      _count: { id: true },
      _sum: { views: true },
      where: { isActive: true, ...dateFilter },
    }),
  ]);

  const subjects = await prisma.subject.findMany({
    select: { id: true, name: true, slug: true },
  });
  const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));

  const bySubject = bySubjectRaw.map(r => ({
    subject: subjectMap[r.subjectId]?.name ?? '',
    slug: subjectMap[r.subjectId]?.slug ?? '',
    count: r._count.id,
    views: r._sum.views ?? 0,
  }));

  return ok({
    total,
    active,
    totalViews: totalViewsAgg._sum.views ?? 0,
    bySubject,
  });
}
