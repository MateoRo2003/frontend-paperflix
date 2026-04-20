import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, ok, err } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const subjectId = req.nextUrl.searchParams.get('subjectId');
  const units = await prisma.unit.findMany({
    where: subjectId ? { subjectId: Number(subjectId) } : {},
    orderBy: { order: 'asc' },
  });
  return ok(units);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const data = await req.json();
  if (!data.name || !data.subjectId) return err('name y subjectId requeridos');

  const unit = await prisma.unit.create({ data });
  return ok(unit, 201);
}
