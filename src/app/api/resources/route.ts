import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, ok, err } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const page = Number(p.get('page') || 1);
  const limit = Number(p.get('limit') || 20);
  const subjectId = p.get('subjectId');
  const unitId = p.get('unitId');
  const course = p.get('course');
  const activityType = p.get('activityType');
  const oaCode = p.get('oaCode');
  const search = p.get('search');

  const where: Record<string, unknown> = { isActive: true };
  if (subjectId) where.subjectId = Number(subjectId);
  if (unitId) where.unitId = Number(unitId);
  if (course) where.course = course;
  if (activityType) where.activityType = { contains: activityType, mode: 'insensitive' };
  if (oaCode) where.oaCode = oaCode;
  if (search) where.OR = [
    { title: { contains: search, mode: 'insensitive' } },
    { description: { contains: search, mode: 'insensitive' } },
  ];

  const [data, total] = await Promise.all([
    prisma.resource.findMany({
      where,
      orderBy: { id: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { subject: { select: { id: true, name: true } } },
    }),
    prisma.resource.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);
  return ok({ data, total, page, limit, totalPages, pages: totalPages });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const data = await req.json();
  if (!data.title || !data.subjectId) return err('title y subjectId requeridos');

  const resource = await prisma.resource.create({ data });
  return ok(resource, 201);
}
