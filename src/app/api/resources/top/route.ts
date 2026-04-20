import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const limit = Number(p.get('limit') || 20);
  const from = p.get('from');
  const to = p.get('to');
  const dateFilter = from || to ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {};

  const resources = await prisma.resource.findMany({
    where: { isActive: true, ...dateFilter },
    orderBy: { views: 'desc' },
    take: limit,
  });
  return ok(resources);
}
