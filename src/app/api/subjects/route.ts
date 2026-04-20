import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, ok, err } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const all = req.nextUrl.searchParams.get('all') === 'true';
  const subjects = await prisma.subject.findMany({
    where: all ? {} : { isActive: true, deletedAt: null },
    orderBy: { order: 'asc' },
    include: { _count: { select: { resources: true } } },
  });
  return ok(subjects);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const data = await req.json();
  if (!data.name || !data.slug) return err('name y slug requeridos');

  const subject = await prisma.subject.create({ data });
  return ok(subject, 201);
}
